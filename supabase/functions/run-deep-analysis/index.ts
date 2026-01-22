import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API_VERSION = "0.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeepAnalysisRequest {
  scan_id: string;
  symbols: string[];
  timeframe?: string;
  concurrency?: number; // Max concurrent requests (default: 2)
}

interface DeepAnalysisResult {
  scan_id: string;
  total: number;
  completed: number;
  failed: number;
  results: Array<{
    symbol: string;
    success: boolean;
    evidence_score?: number;
    primary_pattern?: string;
    error?: string;
    retries?: number;
  }>;
  api_version: string;
}

// Rate-limit config
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function analyzeWithRetry(
  symbol: string,
  timeframe: string,
  supabaseUrl: string,
  authHeader: string | null,
  supabaseKey: string
): Promise<{ success: boolean; data?: any; error?: string; retries: number }> {
  let lastError: string = '';
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-elliott-wave`;
      const response = await fetch(analyzeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader || `Bearer ${supabaseKey}`,
          'apikey': supabaseKey
        },
        body: JSON.stringify({ symbol, timeframe })
      });

      // Handle rate limiting with exponential backoff
      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
          console.log(`Rate limited for ${symbol}, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await sleep(backoffMs);
          continue;
        }
        lastError = 'Rate limited after max retries';
        break;
      }

      if (!response.ok) {
        lastError = `Analysis failed: ${response.status}`;
        if (attempt < MAX_RETRIES && response.status >= 500) {
          const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
          console.log(`Server error for ${symbol}, retrying in ${backoffMs}ms`);
          await sleep(backoffMs);
          continue;
        }
        break;
      }

      const analysisData = await response.json();

      if (analysisData.error) {
        lastError = analysisData.error;
        break;
      }

      return { success: true, data: analysisData, retries: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
      if (attempt < MAX_RETRIES) {
        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        console.log(`Error for ${symbol}: ${lastError}, retrying in ${backoffMs}ms`);
        await sleep(backoffMs);
        continue;
      }
    }
  }

  return { success: false, error: lastError, retries: MAX_RETRIES };
}

async function processSymbolBatch(
  symbols: string[],
  timeframe: string,
  scan_id: string,
  supabase: any,
  supabaseUrl: string,
  authHeader: string | null,
  supabaseKey: string
): Promise<DeepAnalysisResult['results']> {
  const results: DeepAnalysisResult['results'] = [];

  for (const symbol of symbols) {
    console.log(`Analyzing ${symbol}...`);
    
    const { success, data, error, retries } = await analyzeWithRetry(
      symbol,
      timeframe,
      supabaseUrl,
      authHeader,
      supabaseKey
    );

    if (success && data) {
      const analysis = data.analysis;
      const evidenceScore = analysis?.evidence_score ?? null;
      const primaryPattern = analysis?.primary_count?.pattern ?? null;

      // Store successful analysis
      const { error: insertError } = await supabase
        .from('deep_analyses')
        .upsert({
          scan_id,
          symbol,
          timeframe,
          analysis_json: data,
          evidence_score: evidenceScore,
          primary_pattern: primaryPattern
        }, {
          onConflict: 'scan_id,symbol,timeframe'
        });

      if (insertError) {
        console.error(`Failed to store analysis for ${symbol}:`, insertError);
      }

      results.push({
        symbol,
        success: true,
        evidence_score: evidenceScore,
        primary_pattern: primaryPattern,
        retries
      });
    } else {
      // Persist failure to deep_analyses
      const failureData = {
        error: error || 'Unknown error',
        status: 'failed',
        retries,
        timestamp: new Date().toISOString()
      };

      await supabase
        .from('deep_analyses')
        .upsert({
          scan_id,
          symbol,
          timeframe,
          analysis_json: failureData,
          evidence_score: null,
          primary_pattern: null
        }, {
          onConflict: 'scan_id,symbol,timeframe'
        });

      // Also update scan_symbols.error if exists
      await supabase
        .from('scan_symbols')
        .update({ error: error || 'Deep analysis failed' })
        .eq('scan_id', scan_id)
        .eq('symbol', symbol);

      results.push({
        symbol,
        success: false,
        error,
        retries
      });
    }

    // Small delay between requests even on success
    await sleep(300);
  }

  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: DeepAnalysisRequest = await req.json();
    const { 
      scan_id, 
      symbols, 
      timeframe = '1D',
      concurrency = 2 
    } = body;

    if (!scan_id) {
      throw new Error('scan_id is required');
    }

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      throw new Error('symbols array is required');
    }

    // Clamp concurrency to reasonable bounds
    const effectiveConcurrency = Math.min(Math.max(concurrency, 1), 5);

    // Get auth token from request
    const authHeader = req.headers.get('authorization');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[v${API_VERSION}] Running deep analysis for ${symbols.length} symbols, scan_id=${scan_id}, concurrency=${effectiveConcurrency}`);

    // Split symbols into batches for concurrent processing
    const batches: string[][] = [];
    for (let i = 0; i < symbols.length; i += effectiveConcurrency) {
      batches.push(symbols.slice(i, i + effectiveConcurrency));
    }

    const allResults: DeepAnalysisResult['results'] = [];
    
    // Process batches with concurrency limit
    for (const batch of batches) {
      const batchPromises = batch.map(symbol => 
        processSymbolBatch(
          [symbol],
          timeframe,
          scan_id,
          supabase,
          supabaseUrl,
          authHeader,
          supabaseKey
        )
      );

      const batchResults = await Promise.all(batchPromises);
      allResults.push(...batchResults.flat());
    }

    const completed = allResults.filter(r => r.success).length;
    const failed = allResults.filter(r => !r.success).length;

    // Update scan status
    await supabase
      .from('scans')
      .update({
        completed_count: completed,
        completed_at: new Date().toISOString(),
        status: failed === symbols.length ? 'failed' : 'completed'
      })
      .eq('id', scan_id);

    const result: DeepAnalysisResult = {
      scan_id,
      total: symbols.length,
      completed,
      failed,
      results: allResults,
      api_version: API_VERSION
    };

    console.log(`Deep analysis complete: ${completed} completed, ${failed} failed`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Deep analysis error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        api_version: API_VERSION
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
