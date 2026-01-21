import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { ScreenerPanel } from '@/components/screener/ScreenerPanel';
import { AnalysisPanel } from '@/components/analysis/AnalysisPanel';
import { LightweightChart } from '@/components/charts/LightweightChart';
import { supabase } from '@/integrations/supabase/client';
import { ElliottAnalysisResult, FundamentalsSnapshot, Candle } from '@/types/analysis';
import { toast } from 'sonner';

export default function Screener() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [analysis, setAnalysis] = useState<ElliottAnalysisResult | null>(null);
  const [fundamentals, setFundamentals] = useState<FundamentalsSnapshot | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const analyzeSymbol = async (symbol: string) => {
    setSelectedSymbol(symbol);
    setIsLoading(true);
    
    try {
      // Fetch candles
      const { data: ohlcvData } = await supabase.functions.invoke('fetch-ohlcv', {
        body: { symbol, range: '2y', interval: '1d' }
      });
      
      if (ohlcvData?.candles) {
        setCandles(ohlcvData.candles);
      }

      // Run Elliott Wave analysis
      const { data, error } = await supabase.functions.invoke('analyze-elliott-wave', {
        body: { symbol, timeframe: '1D' }
      });

      if (error) throw error;

      if (data?.analysis) {
        setAnalysis(data.analysis);
        setFundamentals(data.fundamentals || null);
        toast.success(`Analysis complete for ${symbol}`);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze symbol');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Elliott Wave Screener | GOX</title>
        <meta name="description" content="AI-powered Elliott Wave screening and analysis for portfolio teams" />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">GOX Screener</h1>
            <span className="text-xs text-muted-foreground">Elliott Wave + Fundamentals</span>
          </div>
        </header>

        {/* Main Layout */}
        <div className="flex h-[calc(100vh-57px)]">
          {/* Left: Screener */}
          <div className="w-80 border-r border-border/50 p-4 overflow-y-auto">
            <ScreenerPanel 
              onSymbolSelect={analyzeSymbol}
              selectedSymbol={selectedSymbol}
            />
          </div>

          {/* Center: Chart */}
          <div className="flex-1 p-4">
            {selectedSymbol && candles.length > 0 ? (
              <LightweightChart 
                candles={candles}
                symbol={selectedSymbol}
                analysis={analysis}
                height={600}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Select a symbol to view chart
              </div>
            )}
          </div>

          {/* Right: Analysis Panel */}
          <div className="w-96 border-l border-border/50 p-4 overflow-hidden">
            <AnalysisPanel 
              analysis={analysis}
              fundamentals={fundamentals}
              isLoading={isLoading}
              onRefresh={() => selectedSymbol && analyzeSymbol(selectedSymbol)}
            />
          </div>
        </div>
      </div>
    </>
  );
}
