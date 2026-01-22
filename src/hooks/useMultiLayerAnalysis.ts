import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  MultiLayerAnalysis, 
  WaveLayer, 
  WaveDegree, 
  NEXT_LOWER_DEGREE,
  ElliottAnalysisResult,
  Candle,
  Pivot,
  FundamentalsSnapshot,
  WaveAdjustment
} from '@/types/analysis';
import { toast } from 'sonner';
import { LLMStatusState } from '@/components/ui/llm-status-indicator';

interface LLMStatus {
  ok: boolean;
  status_code: number;
  error_type?: string;
  error_message?: string;
  retry_after_seconds?: number;
}

interface MajorDegree {
  degree: WaveDegree;
  timeframe_used: string;
  years_of_data: number;
  why_this_degree: string;
}

interface UseMultiLayerAnalysisReturn {
  multiLayer: MultiLayerAnalysis | null;
  activeLayerIds: Set<string>;
  candles: Candle[];
  pivots: Pivot[];
  fundamentals: FundamentalsSnapshot | null;
  isLoading: boolean;
  llmStatusState: LLMStatusState;
  lastSuccessfulCall: Date | null;
  retryAfterSeconds: number | undefined;
  isStructureOnly: boolean;
  analyzeSymbol: (symbol: string, userAdjustments?: WaveAdjustment[]) => Promise<void>;
  addSmallerDegreeLayer: () => Promise<void>;
  toggleLayer: (layerId: string) => void;
  setActiveLayerIds: (ids: Set<string>) => void;
}

// Convert API response to WaveLayer
function apiResponseToWaveLayer(
  data: any,
  degree: WaveDegree,
  timeframe: string
): WaveLayer {
  const analysis = data.analysis as ElliottAnalysisResult;
  const isStructure = data.structure_only || !data.llm_status?.ok;
  
  return {
    layer_id: `${degree.charAt(0)}-${timeframe}`,
    degree,
    timeframe,
    status: isStructure ? 'structure_only' : analysis?.status || 'inconclusive',
    waves: analysis?.primary_count?.waves || [],
    key_levels: analysis?.key_levels,
    cage_features: analysis?.cage_features || data.computed_features?.cage_features,
    summary: analysis?.summary,
    analyzed_at: new Date().toISOString(),
    source: isStructure ? 'structure' : 'llm',
  };
}

export function useMultiLayerAnalysis(): UseMultiLayerAnalysisReturn {
  const [multiLayer, setMultiLayer] = useState<MultiLayerAnalysis | null>(null);
  const [activeLayerIds, setActiveLayerIds] = useState<Set<string>>(new Set());
  const [candles, setCandles] = useState<Candle[]>([]);
  const [pivots, setPivots] = useState<Pivot[]>([]);
  const [fundamentals, setFundamentals] = useState<FundamentalsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [llmStatusState, setLlmStatusState] = useState<LLMStatusState>('ok');
  const [lastSuccessfulCall, setLastSuccessfulCall] = useState<Date | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | undefined>();
  const [isStructureOnly, setIsStructureOnly] = useState(false);
  
  // Track current symbol for layer additions
  const currentSymbolRef = useRef<string>('');

  const updateLLMStatus = useCallback((llmStatus: LLMStatus | null, isStructure: boolean) => {
    if (isStructure || (llmStatus && !llmStatus.ok)) {
      if (llmStatus?.error_type === 'rate_limit') {
        setLlmStatusState('rate_limited');
        setRetryAfterSeconds(llmStatus.retry_after_seconds);
        // Auto-clear after timeout
        if (llmStatus.retry_after_seconds) {
          setTimeout(() => {
            setLlmStatusState('ok');
            setRetryAfterSeconds(undefined);
          }, (llmStatus.retry_after_seconds + 5) * 1000);
        }
      } else {
        setLlmStatusState('degraded');
      }
    } else {
      setLlmStatusState('ok');
      setLastSuccessfulCall(new Date());
      setRetryAfterSeconds(undefined);
    }
  }, []);

  const analyzeSymbol = useCallback(async (symbol: string, userAdjustments?: WaveAdjustment[]) => {
    currentSymbolRef.current = symbol;
    setIsLoading(true);
    setIsStructureOnly(false);
    
    try {
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

      // Update LLM status
      updateLLMStatus(data?.llm_status, data?.structure_only);

      // Set structure-only flag
      if (data?.structure_only) {
        setIsStructureOnly(true);
        toast.warning('LLM unavailable. Showing structure-only result.');
      }

      // Set candles and pivots
      if (data?.candles) setCandles(data.candles);
      if (data?.pivots) setPivots(data.pivots);
      if (data?.fundamentals) setFundamentals(data.fundamentals);

      // Build multi-layer structure from response
      const majorDegree = data?.major_degree as MajorDegree;
      const degree = (majorDegree?.degree || 'Primary') as WaveDegree;
      const timeframe = majorDegree?.timeframe_used || data?.analysis_timeframe_selected || '1d';
      
      const baseLayer = apiResponseToWaveLayer(data, degree, timeframe);
      
      const newMultiLayer: MultiLayerAnalysis = {
        symbol,
        base_layer_id: baseLayer.layer_id,
        layers: [baseLayer],
        historical_low: data?.historical_low || { date: '', price: 0 },
      };

      setMultiLayer(newMultiLayer);
      setActiveLayerIds(new Set([baseLayer.layer_id]));

      if (!data?.structure_only) {
        toast.success(`${degree} analysis complete for ${symbol}`);
      }

    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze symbol');
    } finally {
      setIsLoading(false);
    }
  }, [updateLLMStatus]);

  const addSmallerDegreeLayer = useCallback(async () => {
    if (!multiLayer || multiLayer.layers.length === 0) {
      toast.error('No base analysis to expand');
      return;
    }

    const currentBaseDegree = multiLayer.layers[0].degree;
    const nextDegree = NEXT_LOWER_DEGREE[currentBaseDegree];
    
    if (!nextDegree) {
      toast.info('Already at the smallest degree (Minute)');
      return;
    }

    // Check if we already have this layer
    const existingLayer = multiLayer.layers.find(l => l.degree === nextDegree);
    if (existingLayer) {
      // Just activate it
      setActiveLayerIds(prev => new Set([...prev, existingLayer.layer_id]));
      toast.info(`${nextDegree} layer already exists, activated.`);
      return;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('analyze-elliott-wave', {
        body: { 
          symbol: currentSymbolRef.current,
          mode: 'target_degree',
          target_degree: nextDegree,
        }
      });

      if (error) throw error;

      updateLLMStatus(data?.llm_status, data?.structure_only);

      // Determine timeframe for this degree
      const timeframe = data?.analysis_timeframe_selected || 
        (nextDegree === 'Minor' ? '4h' : nextDegree === 'Minute' ? '1h' : '1d');

      const newLayer = apiResponseToWaveLayer(data, nextDegree, timeframe);
      
      // Add to layers
      setMultiLayer(prev => {
        if (!prev) return null;
        return {
          ...prev,
          layers: [...prev.layers, newLayer],
        };
      });

      // Auto-activate the new layer
      setActiveLayerIds(prev => new Set([...prev, newLayer.layer_id]));
      
      toast.success(`Added ${nextDegree} layer`);

    } catch (error) {
      console.error('Add layer error:', error);
      toast.error('Failed to add smaller degree layer');
    } finally {
      setIsLoading(false);
    }
  }, [multiLayer, updateLLMStatus]);

  const toggleLayer = useCallback((layerId: string) => {
    setActiveLayerIds(prev => {
      const next = new Set(prev);
      if (next.has(layerId)) {
        // Don't allow deactivating the last layer
        if (next.size > 1) {
          next.delete(layerId);
        }
      } else {
        next.add(layerId);
      }
      return next;
    });
  }, []);

  return {
    multiLayer,
    activeLayerIds,
    candles,
    pivots,
    fundamentals,
    isLoading,
    llmStatusState,
    lastSuccessfulCall,
    retryAfterSeconds,
    isStructureOnly,
    analyzeSymbol,
    addSmallerDegreeLayer,
    toggleLayer,
    setActiveLayerIds,
  };
}
