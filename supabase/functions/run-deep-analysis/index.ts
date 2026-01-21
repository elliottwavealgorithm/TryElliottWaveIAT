import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API_VERSION = "0.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeepAnalysisRequest {
  scan_id: string;
  symbols: string[];
  timeframe?: string;
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
  }>;
  api_version: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: DeepAnalysisRequest = await req.json();
    const { scan_id, symbols, timeframe = '1D' } = body;

    if (!scan_id) {
      throw new Error('scan_id is required');
    }

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      throw new Error('symbols array is required');
    }

    // Get auth token from request
    const authHeader = req.headers.get('authorization');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[v${API_VERSION}] Running deep analysis for ${symbols.length} symbols, scan_id=${scan_id}`);

    const results: DeepAnalysisResult['results'] = [];
    let completed = 0;
    let failed = 0;

    // Process symbols sequentially to avoid rate limiting
    for (const symbol of symbols) {
      try {
        console.log(`Analyzing ${symbol}...`);
        
        // Call analyze-elliott-wave edge function
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

        if (!response.ok) {
          throw new Error(`Analysis failed: ${response.status}`);
        }

        const analysisData = await response.json();

        if (analysisData.error) {
          throw new Error(analysisData.error);
        }

        const analysis = analysisData.analysis;
        const evidenceScore = analysis?.evidence_score ?? null;
        const primaryPattern = analysis?.primary_count?.pattern ?? null;

        // Store in deep_analyses table
        const { error: insertError } = await supabase
          .from('deep_analyses')
          .insert({
            scan_id,
            symbol,
            timeframe,
            analysis_json: analysisData,
            evidence_score: evidenceScore,
            primary_pattern: primaryPattern
          });

        if (insertError) {
          console.error(`Failed to store analysis for ${symbol}:`, insertError);
        }

        results.push({
          symbol,
          success: true,
          evidence_score: evidenceScore,
          primary_pattern: primaryPattern
        });
        completed++;

      } catch (error) {
        console.error(`Error analyzing ${symbol}:`, error);
        results.push({
          symbol,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        failed++;
      }

      // Small delay between requests
      await new Promise(r => setTimeout(r, 500));
    }

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
      results,
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
