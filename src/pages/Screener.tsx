import { useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { ScreenerPanel } from '@/components/screener/ScreenerPanel';
import { AnalysisPanel } from '@/components/analysis/AnalysisPanel';
import { LightweightChart } from '@/components/charts/LightweightChart';
import { WaveAdjustmentDialog } from '@/components/charts/WaveAdjustmentDialog';
import { DegreeLayerChips } from '@/components/charts/DegreeLayerChips';
import { LLMStatusIndicator } from '@/components/ui/llm-status-indicator';
import { AnalysisChat } from '@/components/elliott/AnalysisChat';
import { useMultiLayerAnalysis } from '@/hooks/useMultiLayerAnalysis';
import { WaveAdjustment, ElliottAnalysisResult } from '@/types/analysis';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings2, ChevronLeft, AlertCircle, TrendingUp, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Screener() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [selectedAlternateIndex, setSelectedAlternateIndex] = useState<number | null>(null);
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const {
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
  } = useMultiLayerAnalysis();

  const handleSymbolSelect = useCallback(async (symbol: string) => {
    setSelectedSymbol(symbol);
    setSelectedAlternateIndex(null);
    setShowChat(false);
    await analyzeSymbol(symbol);
  }, [analyzeSymbol]);

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

  // Get the base layer's analysis for display in AnalysisPanel
  const baseLayer = multiLayer?.layers[0];
  const displayAnalysis: ElliottAnalysisResult | null = baseLayer ? {
    symbol: multiLayer?.symbol || '',
    timeframe: baseLayer.timeframe,
    status: baseLayer.status === 'structure_only' ? 'inconclusive' : baseLayer.status,
    evidence_score: 0,
    evidence_checklist: {
      hard_rules: { passed: true, score: 0, details: '' },
      fibonacci: { score: 0, details: '' },
      momentum_volume: { score: 0, details: '' },
      cages: { score: 0, details: '' },
      multi_tf_consistency: { score: 0, details: '' },
    },
    primary_count: {
      pattern: 'impulse',
      waves: baseLayer.waves,
      current_wave: '',
      next_expected: '',
      confidence: 0,
    },
    alternate_counts: [],
    key_levels: baseLayer.key_levels || { support: [], resistance: [], fibonacci_targets: [], invalidation: 0 },
    cage_features: baseLayer.cage_features || {
      cage_2_4: { exists: false, broken: false, break_strength: 0, bars_since_break: 0 },
      cage_ACB: { exists: false, broken_up: false, broken_down: false, break_strength: 0 },
      wedge_cage: { exists: false, broken: false, break_strength: 0 },
    },
    forecast: {
      short_term: { direction: 'neutral', target: 0, timeframe: '' },
      medium_term: { direction: 'neutral', target: 0, timeframe: '' },
      long_term: { direction: 'neutral', target: 0, timeframe: '' },
    },
    key_uncertainties: [],
    what_would_confirm: [],
    summary: baseLayer.summary || '',
  } : null;

  // Handle chat layer command
  const handleChatAnalysisUpdate = useCallback((newAnalysis: any) => {
    // If chat requests a smaller degree, trigger the layer addition
    if (newAnalysis?.addSmallerDegree) {
      addSmallerDegreeLayer();
    }
  }, [addSmallerDegreeLayer]);

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
              {retryAfterSeconds && (
                <span className="text-xs opacity-75">
                  (retry in {retryAfterSeconds}s)
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
              
              {/* LLM Status Indicator */}
              <LLMStatusIndicator 
                status={llmStatusState}
                lastSuccessfulCall={lastSuccessfulCall}
                retryAfterSeconds={retryAfterSeconds}
              />
              
              {/* Auto TF Chip */}
              {baseLayer && (
                <Badge variant="outline" className="text-xs gap-1 bg-primary/10 border-primary/30">
                  Auto TF: {formatTimeframe(baseLayer.timeframe)}
                </Badge>
              )}
              
              {/* Degree Badge */}
              {baseLayer && (
                <Badge variant="outline" className="text-xs gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {baseLayer.degree}
                </Badge>
              )}
              
              {/* Invalidation Badge */}
              {baseLayer?.key_levels?.invalidation && (
                <Badge variant="secondary" className="text-xs gap-1 bg-amber-500/20 text-amber-400 border-amber-500/30">
                  INV: ${typeof baseLayer.key_levels.invalidation === 'number' 
                    ? baseLayer.key_levels.invalidation.toFixed(2)
                    : baseLayer.key_levels.invalidation.level.toFixed(2)}
                </Badge>
              )}
            </div>
            
            <span className="text-xs text-muted-foreground">Auto Degree Selection</span>
          </div>
        </header>

        {/* Main Layout */}
        <div className="flex h-[calc(100vh-57px)]">
          {/* Left: Screener */}
          <div className="w-80 border-r border-border/50 p-4 overflow-y-auto">
            <ScreenerPanel 
              onSymbolSelect={handleSymbolSelect}
              selectedSymbol={selectedSymbol}
            />
          </div>

          {/* Center: Chart */}
          <div className="flex-1 flex flex-col">
            {/* Chart Toolbar */}
            {selectedSymbol && (
              <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{selectedSymbol}</span>
                  
                  {/* Layer Chips */}
                  {multiLayer && (
                    <DegreeLayerChips
                      layers={multiLayer.layers}
                      activeLayerIds={activeLayerIds}
                      onToggleLayer={toggleLayer}
                    />
                  )}
                  
                  {isStructureOnly && (
                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/30">
                      Structure Only
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowChat(!showChat)}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {showChat ? 'Hide Chat' : 'Chat'}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setAdjustmentDialogOpen(true)}
                    disabled={pivots.length === 0 || isLoading}
                  >
                    <Settings2 className="h-4 w-4 mr-2" />
                    Adjust
                  </Button>
                </div>
              </div>
            )}
            
            {/* Chart Area */}
            <div className="flex-1 p-2">
              {selectedSymbol ? (
                candles.length > 0 ? (
                  <LightweightChart 
                    candles={candles}
                    symbol={selectedSymbol}
                    multiLayer={multiLayer}
                    activeLayerIds={activeLayerIds}
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

          {/* Right: Analysis Panel + Chat */}
          <div className="w-96 border-l border-border/50 flex flex-col overflow-hidden">
            {/* Analysis Panel */}
            <div className={`${showChat ? 'h-1/2' : 'flex-1'} p-4 overflow-y-auto`}>
              <AnalysisPanel 
                analysis={displayAnalysis}
                fundamentals={fundamentals}
                isLoading={isLoading || isAdjusting}
                onRefresh={() => selectedSymbol && handleSymbolSelect(selectedSymbol)}
                onSelectAlternate={handleSelectAlternate}
                selectedAlternateIndex={selectedAlternateIndex}
              />
            </div>
            
            {/* Chat Panel */}
            {showChat && selectedSymbol && displayAnalysis && (
              <div className="h-1/2 border-t border-border/50 p-4 overflow-hidden">
                <AnalysisChat
                  analysis={displayAnalysis}
                  symbol={selectedSymbol}
                  timeframe={baseLayer?.timeframe || '1d'}
                  onAnalysisUpdate={handleChatAnalysisUpdate}
                  onAddLayer={addSmallerDegreeLayer}
                />
              </div>
            )}
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
