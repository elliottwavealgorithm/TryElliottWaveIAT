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
import { Settings2, ChevronLeft, AlertTriangle, CreditCard } from 'lucide-react';
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

  const analyzeSymbol = useCallback(async (symbol: string, userAdjustments?: WaveAdjustment[]) => {
    setSelectedSymbol(symbol);
    setIsLoading(true);
    setSelectedAlternateIndex(null);
    setLlmStatus(null);
    
    try {
      // Fetch candles
      const { data: ohlcvData } = await supabase.functions.invoke('fetch-ohlcv', {
        body: { symbol, range: '2y', interval: '1d' }
      });
      
      if (ohlcvData?.candles) {
        setCandles(ohlcvData.candles);
      }

      // Run Elliott Wave analysis with auto major degree mode
      const { data, error } = await supabase.functions.invoke('analyze-elliott-wave', {
        body: { 
          symbol, 
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
        
        if (!data.llm_status.ok) {
          if (data.llm_status.error_type === 'rate_limit') {
            toast.error(`Rate limited — try again in ${data.llm_status.retry_after_seconds || 60}s`);
          } else if (data.llm_status.error_type === 'payment_required') {
            toast.error('LLM credits required — add credits in Lovable workspace');
          } else {
            toast.error(data.llm_status.error_message || 'Analysis failed');
          }
          return;
        }
      }

      if (data?.major_degree) {
        setMajorDegree(data.major_degree);
      }

      if (data?.analysis) {
        setAnalysis(data.analysis);
        setFundamentals(data.fundamentals || null);
        
        if (data.pivots || data.requested_pivots?.meso) {
          setPivots(data.pivots || data.requested_pivots?.meso || []);
        }
        
        toast.success(`${data.major_degree?.degree || 'Analysis'} complete for ${symbol}`);
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

  return (
    <>
      <Helmet>
        <title>Elliott Wave Screener | GOX</title>
        <meta name="description" content="AI-powered Elliott Wave screening and analysis for portfolio teams" />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        {/* LLM Status Banner */}
        {llmStatus && !llmStatus.ok && (
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
              {majorDegree && (
                <Badge variant="outline" className="text-xs">
                  {majorDegree.degree} • {majorDegree.years_of_data.toFixed(0)}y
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">Auto Major Degree Mode</span>
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
            
            {/* Chart Area */}
            <div className="flex-1 p-4">
              {selectedSymbol && candles.length > 0 ? (
                <LightweightChart 
                  candles={candles}
                  symbol={selectedSymbol}
                  analysis={analysis}
                  selectedAlternateIndex={selectedAlternateIndex}
                  height={600}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Select a symbol to view chart
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
