import { useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { ScreenerPanel } from '@/components/screener/ScreenerPanel';
import { AnalysisPanel } from '@/components/analysis/AnalysisPanel';
import { LightweightChart } from '@/components/charts/LightweightChart';
import { WaveAdjustmentDialog } from '@/components/charts/WaveAdjustmentDialog';
import { supabase } from '@/integrations/supabase/client';
import { ElliottAnalysisResult, FundamentalsSnapshot, Candle, Pivot, WaveAdjustment } from '@/types/analysis';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings2, ChevronLeft, AlertTriangle, CreditCard, Clock, TrendingUp, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LLMStatus {
  ok: boolean;
  status_code: number;
  error_type?: string;
  error_message?: string;
  retry_after_seconds?: number;
}

interface MajorDegree {
  degree: string;
  timeframe_used: string;
  years_of_data: number;
  why_this_degree: string;
}

export default function Screener() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [analysis, setAnalysis] = useState<ElliottAnalysisResult | null>(null);
  const [fundamentals, setFundamentals] = useState<FundamentalsSnapshot | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [pivots, setPivots] = useState<Pivot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAlternateIndex, setSelectedAlternateIndex] = useState<number | null>(null);
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [llmStatus, setLlmStatus] = useState<LLMStatus | null>(null);
  const [majorDegree, setMajorDegree] = useState<MajorDegree | null>(null);
  const [analysisTimeframe, setAnalysisTimeframe] = useState<string>('');
  const [isStructureOnly, setIsStructureOnly] = useState(false);

  const analyzeSymbol = useCallback(async (symbol: string, userAdjustments?: WaveAdjustment[]) => {
    setSelectedSymbol(symbol);
    setIsLoading(true);
    setSelectedAlternateIndex(null);
    setLlmStatus(null);
    setIsStructureOnly(false);
    
    try {
      // Run Elliott Wave analysis with auto timeframe mode
      // Backend returns candles as single source of truth
      const { data, error } = await supabase.functions.invoke('analyze-elliott-wave', {
        body: { 
          symbol, 
          timeframe: 'auto',
          mode: 'auto_major_degree',
          user_adjustments: userAdjustments ? {
            force_wave_labels: userAdjustments,
            notes: 'User manual adjustment'
          } : undefined
        }
      });

      if (error) throw error;

      // Handle LLM status
      if (data?.llm_status) {
        setLlmStatus(data.llm_status);
      }

      // Check for structure-only fallback
      if (data?.structure_only) {
        setIsStructureOnly(true);
        toast.warning('LLM unavailable. Showing structure-only result.');
      }

      // Set candles from response (single source of truth)
      if (data?.candles) {
        setCandles(data.candles);
      }

      // Set pivots from response
      if (data?.pivots) {
        setPivots(data.pivots);
      }

      // Set analysis timeframe
      if (data?.analysis_timeframe_selected) {
        setAnalysisTimeframe(data.analysis_timeframe_selected);
      }

      // Set major degree
      if (data?.major_degree) {
        setMajorDegree(data.major_degree);
      }

      // Set analysis
      if (data?.analysis) {
        setAnalysis(data.analysis);
        setFundamentals(data.fundamentals || null);
        
        if (!data.structure_only) {
          toast.success(`${data.major_degree?.degree || 'Analysis'} complete for ${symbol}`);
        }
      }

      // Handle LLM errors with toasts
      if (data?.llm_status && !data.llm_status.ok && !data.structure_only) {
        if (data.llm_status.error_type === 'rate_limit') {
          toast.error(`Rate limited — try again in ${data.llm_status.retry_after_seconds || 60}s`);
        } else if (data.llm_status.error_type === 'payment_required') {
          toast.error('LLM credits required — add credits in Lovable workspace');
        }
      }

    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze symbol');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSelectAlternate = useCallback((index: number | null) => {
    setSelectedAlternateIndex(index);
  }, []);

  const handleAdjustmentConfirm = useCallback(async (adjustments: WaveAdjustment[]) => {
    if (!selectedSymbol) return;
    
    setIsAdjusting(true);
    setAdjustmentDialogOpen(false);
    
    try {
      await analyzeSymbol(selectedSymbol, adjustments);
      toast.success('Analysis updated with your adjustments');
    } catch (error) {
      toast.error('Failed to apply adjustments');
    } finally {
      setIsAdjusting(false);
    }
  }, [selectedSymbol, analyzeSymbol]);

  const formatTimeframe = (tf: string) => {
    const map: Record<string, string> = {
      '1mo': '1M',
      '1wk': '1W',
      '1d': '1D',
      '4h': '4H',
      '1h': '1H',
    };
    return map[tf] || tf.toUpperCase();
  };

  return (
    <>
      <Helmet>
        <title>Elliott Wave Screener | GOX</title>
        <meta name="description" content="AI-powered Elliott Wave screening and analysis for portfolio teams" />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        {/* Structure-Only Banner */}
        {isStructureOnly && (
          <div className="px-4 py-2 flex items-center justify-between text-sm bg-amber-500/20 text-amber-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>LLM unavailable (rate limited). Showing structure-only result with chart data.</span>
              {llmStatus?.retry_after_seconds && (
                <span className="text-xs opacity-75">
                  (retry in {llmStatus.retry_after_seconds}s)
                </span>
              )}
            </div>
          </div>
        )}

        {/* LLM Status Banner (only if not structure-only) */}
        {!isStructureOnly && llmStatus && !llmStatus.ok && (
          <div className={`px-4 py-2 flex items-center justify-between text-sm ${
            llmStatus.error_type === 'rate_limit' 
              ? 'bg-amber-500/20 text-amber-300' 
              : 'bg-red-500/20 text-red-300'
          }`}>
            <div className="flex items-center gap-2">
              {llmStatus.error_type === 'payment_required' ? (
                <CreditCard className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <span>{llmStatus.error_message}</span>
              {llmStatus.retry_after_seconds && (
                <span className="text-xs opacity-75">
                  (retry in {llmStatus.retry_after_seconds}s)
                </span>
              )}
            </div>
          </div>
        )}

        {/* Header */}
        <header className="border-b border-border/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/">
                <Button variant="ghost" size="sm">
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              </Link>
              <h1 className="text-xl font-bold">GOX Screener</h1>
              
              {/* Read-only Status Pills */}
              {analysisTimeframe && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTimeframe(analysisTimeframe)}
                </Badge>
              )}
              {majorDegree && (
                <Badge variant="outline" className="text-xs gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {majorDegree.degree}
                </Badge>
              )}
              {analysis?.key_levels?.invalidation && (
                <Badge variant="secondary" className="text-xs gap-1 bg-amber-500/20 text-amber-400 border-amber-500/30">
                  INV: ${analysis.key_levels.invalidation.toFixed(2)}
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">Auto Timeframe Mode</span>
          </div>
        </header>

        {/* Main Layout */}
        <div className="flex h-[calc(100vh-57px)]">
          {/* Left: Screener */}
          <div className="w-80 border-r border-border/50 p-4 overflow-y-auto">
            <ScreenerPanel 
              onSymbolSelect={(s) => analyzeSymbol(s)}
              selectedSymbol={selectedSymbol}
            />
          </div>

          {/* Center: Chart */}
          <div className="flex-1 flex flex-col">
            {/* Chart Toolbar */}
            {selectedSymbol && (
              <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{selectedSymbol}</span>
                  {analysis?.primary_count?.pattern && (
                    <span className="text-xs text-muted-foreground">
                      {analysis.primary_count.pattern}
                    </span>
                  )}
                  {isStructureOnly && (
                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/30">
                      Structure Only
                    </Badge>
                  )}
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setAdjustmentDialogOpen(true)}
                  disabled={pivots.length === 0 || isLoading}
                >
                  <Settings2 className="h-4 w-4 mr-2" />
                  Adjust Count
                </Button>
              </div>
            )}
            
            {/* Chart Area - LightweightChart is the PRIMARY analysis chart */}
            <div className="flex-1 p-2">
              {selectedSymbol ? (
                candles.length > 0 ? (
                  <LightweightChart 
                    candles={candles}
                    symbol={selectedSymbol}
                    analysis={analysis}
                    selectedAlternateIndex={selectedAlternateIndex}
                    height={Math.max(420, window.innerHeight - 200)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-[420px] text-muted-foreground border border-dashed border-border/50 rounded-lg">
                    {isLoading ? (
                      <span>Loading chart data...</span>
                    ) : (
                      <>
                        <AlertCircle className="h-8 w-8 mb-2 text-amber-400" />
                        <span>No candles returned from backend</span>
                      </>
                    )}
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center h-[420px] text-muted-foreground border border-dashed border-border/50 rounded-lg">
                  Select a symbol to view analysis chart
                </div>
              )}
            </div>
          </div>

          {/* Right: Analysis Panel */}
          <div className="w-96 border-l border-border/50 p-4 overflow-hidden">
            <AnalysisPanel 
              analysis={analysis}
              fundamentals={fundamentals}
              isLoading={isLoading || isAdjusting}
              onRefresh={() => selectedSymbol && analyzeSymbol(selectedSymbol)}
              onSelectAlternate={handleSelectAlternate}
              selectedAlternateIndex={selectedAlternateIndex}
            />
          </div>
        </div>
      </div>

      {/* Adjustment Dialog */}
      <WaveAdjustmentDialog
        open={adjustmentDialogOpen}
        onOpenChange={setAdjustmentDialogOpen}
        pivots={pivots}
        symbol={selectedSymbol}
        onConfirm={handleAdjustmentConfirm}
        isLoading={isAdjusting}
      />
    </>
  );
}
