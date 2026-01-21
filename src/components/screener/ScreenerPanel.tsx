import { useState, useCallback } from 'react';
import { ScanForm, ScanParams } from './ScanForm';
import { RankingsTable } from './RankingsTable';
import { supabase } from '@/integrations/supabase/client';
import { SymbolMetrics, ScanResult } from '@/types/analysis';
import { toast } from 'sonner';

interface ScreenerPanelProps {
  onSymbolSelect: (symbol: string) => void;
  selectedSymbol?: string;
}

export function ScreenerPanel({ onSymbolSelect, selectedSymbol }: ScreenerPanelProps) {
  const [rankings, setRankings] = useState<SymbolMetrics[]>([]);
  const [topSymbols, setTopSymbols] = useState<string[]>([]);
  const [scanId, setScanId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isRunningDeep, setIsRunningDeep] = useState(false);

  const runScan = useCallback(async (params: ScanParams) => {
    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke<ScanResult>('scan-universe', {
        body: {
          symbols: params.symbols,
          base_timeframe: '1D',
          topN: params.topN,
          include_fundamentals: params.include_fundamentals,
          include_structure_score: params.include_structure_score
        }
      });

      if (error) throw error;
      if (!data) throw new Error('No data returned');

      setRankings(data.rankings);
      setTopSymbols(data.top_symbols);
      setScanId(data.scan_id);
      toast.success(`Scanned ${data.processed} symbols`);
    } catch (error) {
      console.error('Scan error:', error);
      toast.error('Failed to scan universe');
    } finally {
      setIsScanning(false);
    }
  }, []);

  const runDeepAnalysis = useCallback(async (symbols: string[]) => {
    if (!scanId || symbols.length === 0) return;
    
    setIsRunningDeep(true);
    try {
      const { data, error } = await supabase.functions.invoke('run-deep-analysis', {
        body: { scan_id: scanId, symbols, timeframe: '1D' }
      });

      if (error) throw error;

      toast.success(`Deep analysis complete: ${data.completed}/${data.total}`);
    } catch (error) {
      console.error('Deep analysis error:', error);
      toast.error('Failed to run deep analysis');
    } finally {
      setIsRunningDeep(false);
    }
  }, [scanId]);

  return (
    <div className="space-y-4">
      <ScanForm onRunScan={runScan} isScanning={isScanning} />
      
      <RankingsTable
        rankings={rankings}
        selectedSymbol={selectedSymbol}
        onSymbolSelect={onSymbolSelect}
        onRunDeepAnalysis={runDeepAnalysis}
        isRunningDeep={isRunningDeep}
        topSymbols={topSymbols}
      />
    </div>
  );
}
