import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Target,
  Shield,
  BarChart3,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { ElliottAnalysisResult, CageFeatures, FundamentalsSnapshot } from '@/types/analysis';

interface AnalysisPanelProps {
  analysis: ElliottAnalysisResult | null;
  fundamentals: FundamentalsSnapshot | null;
  isLoading: boolean;
  onRefresh: () => void;
  onSelectAlternate?: (index: number | null) => void;
  selectedAlternateIndex?: number | null;
}

export function AnalysisPanel({ 
  analysis, 
  fundamentals, 
  isLoading, 
  onRefresh,
  onSelectAlternate,
  selectedAlternateIndex = null
}: AnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState('primary');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Analyzing Elliott Wave structure...</p>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center space-y-2">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground">Select a symbol to analyze</p>
        </div>
      </div>
    );
  }

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'bullish':
        return <TrendingUp className="h-4 w-4 text-green-400" />;
      case 'bearish':
        return <TrendingDown className="h-4 w-4 text-red-400" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-yellow-400/50" />;
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
      <div className="flex items-center justify-between px-1 mb-2">
        <TabsList className="grid grid-cols-5 h-8">
          <TabsTrigger value="primary" className="text-xs px-2">Primary</TabsTrigger>
          <TabsTrigger value="alternates" className="text-xs px-2">Alternates</TabsTrigger>
          <TabsTrigger value="forecast" className="text-xs px-2">Forecast</TabsTrigger>
          <TabsTrigger value="cages" className="text-xs px-2">Cages</TabsTrigger>
          <TabsTrigger value="fundamentals" className="text-xs px-2">Fundamentals</TabsTrigger>
        </TabsList>
        <Button size="sm" variant="ghost" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {/* Primary Count Tab */}
        <TabsContent value="primary" className="mt-0 space-y-4">
          {/* Status & Score */}
          <Card className="border-border/50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {analysis.status === 'conclusive' ? (
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-yellow-400" />
                  )}
                  <span className="font-medium capitalize">{analysis.status}</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{analysis.evidence_score}</div>
                  <div className="text-xs text-muted-foreground">Evidence Score</div>
                </div>
              </div>
              
              <Progress value={analysis.evidence_score} className="h-2 mb-4" />
              
              {/* Evidence Checklist */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Hard Rules</span>
                  {analysis.evidence_checklist.hard_rules.passed ? (
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Fibonacci</span>
                  <span>{analysis.evidence_checklist.fibonacci.score}/20</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Momentum/Volume</span>
                  <span>{analysis.evidence_checklist.momentum_volume.score}/20</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cages</span>
                  <span>{analysis.evidence_checklist.cages.score}/20</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Multi-TF</span>
                  <span>{analysis.evidence_checklist.multi_tf_consistency.score}/20</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Primary Count Details */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Primary Count</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pattern</span>
                <Badge variant="outline">{analysis.primary_count.pattern}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current Wave</span>
                <span className="font-medium">{analysis.primary_count.current_wave}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Next Expected</span>
                <span className="font-medium">{analysis.primary_count.next_expected}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Confidence</span>
                <span className="font-medium">{analysis.primary_count.confidence}%</span>
              </div>
            </CardContent>
          </Card>

          {/* Key Levels */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4" />
                Key Levels
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-green-400 text-xs">Support</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {analysis.key_levels.support.map((level, i) => {
                    const val = typeof level === 'number' ? level : level.level;
                    return (
                      <Badge key={i} variant="outline" className="border-green-500/30 text-green-400">
                        ${val.toFixed(2)}
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <div>
                <span className="text-red-400 text-xs">Resistance</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {analysis.key_levels.resistance.map((level, i) => {
                    const val = typeof level === 'number' ? level : level.level;
                    return (
                      <Badge key={i} variant="outline" className="border-red-500/30 text-red-400">
                        ${val.toFixed(2)}
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <div>
                <span className="text-primary text-xs">Fibonacci Targets</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {analysis.key_levels.fibonacci_targets.map((level, i) => (
                    <Badge key={i} variant="outline" className="border-primary/30">
                      ${level.toFixed(2)}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-yellow-400 flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  Invalidation
                </span>
                <span className="font-medium text-yellow-400">
                  ${(typeof analysis.key_levels.invalidation === 'number' 
                    ? analysis.key_levels.invalidation 
                    : analysis.key_levels.invalidation.level).toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="border-border/50">
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">{analysis.summary}</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alternates Tab */}
        <TabsContent value="alternates" className="mt-0 space-y-3">
          {/* Reset to Primary button when alternate is selected */}
          {selectedAlternateIndex !== null && (
            <div className="flex items-center justify-between p-2 bg-purple-500/10 rounded-md border border-purple-500/30">
              <span className="text-xs text-purple-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                Alt #{selectedAlternateIndex + 1} overlay active
              </span>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-6 text-xs text-purple-400 hover:text-purple-300"
                onClick={() => onSelectAlternate?.(null)}
              >
                Reset to Primary
              </Button>
            </div>
          )}
          
          {analysis.alternate_counts.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="pt-4 text-center text-muted-foreground">
                No alternate counts available
              </CardContent>
            </Card>
          ) : (
            analysis.alternate_counts.map((alt, idx) => {
              const hasWaves = alt.waves && alt.waves.length > 0;
              const isSelected = selectedAlternateIndex === idx;
              
              return (
                <Card 
                  key={idx} 
                  className={`border-border/50 cursor-pointer transition-colors ${
                    isSelected 
                      ? 'bg-purple-500/20 border-purple-500/50' 
                      : 'hover:bg-muted/30'
                  } ${!hasWaves ? 'opacity-60' : ''}`}
                  onClick={() => hasWaves && onSelectAlternate?.(isSelected ? null : idx)}
                >
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{alt.label}</span>
                        {hasWaves && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                            {isSelected ? 'Active' : 'Click to overlay'}
                          </span>
                        )}
                      </div>
                      <Badge variant="secondary">{alt.probability}%</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{alt.justification}</p>
                    <p className="text-xs">
                      <span className="text-primary">Key difference:</span> {alt.key_difference}
                    </p>
                    {!hasWaves && (
                      <p className="text-[10px] text-muted-foreground italic">
                        No wave data available for overlay
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}

          {/* Key Uncertainties */}
          {analysis.key_uncertainties.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-yellow-400">Key Uncertainties</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-1">
                  {analysis.key_uncertainties.map((u, i) => (
                    <li key={i} className="text-muted-foreground">• {u}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* What Would Confirm */}
          {analysis.what_would_confirm.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-green-400">What Would Confirm</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-1">
                  {analysis.what_would_confirm.map((c, i) => (
                    <li key={i} className="text-muted-foreground">• {c}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Forecast Tab */}
        <TabsContent value="forecast" className="mt-0 space-y-3">
          {(['short_term', 'medium_term', 'long_term'] as const).map((term) => {
            const forecast = analysis.forecast[term];
            return (
              <Card key={term} className="border-border/50">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium capitalize">{term.replace('_', ' ')}</span>
                    {getDirectionIcon(forecast.direction)}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Target</span>
                    <span className="font-medium">${forecast.target.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Timeframe</span>
                    <span>{forecast.timeframe}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Cages Tab */}
        <TabsContent value="cages" className="mt-0 space-y-3">
          <CageCard 
            title="Cage 2-4 (Impulse)" 
            cage={analysis.cage_features.cage_2_4}
            type="impulse"
          />
          <CageCard 
            title="Cage A-C-B (Correction)" 
            cage={analysis.cage_features.cage_ACB}
            type="correction"
          />
          <CageCard 
            title="Wedge Cage" 
            cage={analysis.cage_features.wedge_cage}
            type="wedge"
          />
        </TabsContent>

        {/* Fundamentals Tab */}
        <TabsContent value="fundamentals" className="mt-0 space-y-3">
          {fundamentals ? (
            <Card className="border-border/50">
              <CardContent className="pt-4 space-y-3">
                {fundamentals.sector && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Sector</span>
                    <span>{fundamentals.sector}</span>
                  </div>
                )}
                {fundamentals.industry && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Industry</span>
                    <span className="text-sm text-right max-w-[60%]">{fundamentals.industry}</span>
                  </div>
                )}
                {fundamentals.marketCap && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Market Cap</span>
                    <span>${(fundamentals.marketCap / 1e9).toFixed(1)}B</span>
                  </div>
                )}
                {fundamentals.trailingPE && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">P/E (TTM)</span>
                    <span>{fundamentals.trailingPE.toFixed(1)}</span>
                  </div>
                )}
                {fundamentals.forwardPE && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">P/E (Forward)</span>
                    <span>{fundamentals.forwardPE.toFixed(1)}</span>
                  </div>
                )}
                {fundamentals.revenueGrowth !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Revenue Growth</span>
                    <span className={fundamentals.revenueGrowth > 0 ? 'text-green-400' : 'text-red-400'}>
                      {(fundamentals.revenueGrowth * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
                {fundamentals.earningsGrowth !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Earnings Growth</span>
                    <span className={fundamentals.earningsGrowth > 0 ? 'text-green-400' : 'text-red-400'}>
                      {(fundamentals.earningsGrowth * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
                {fundamentals.nextEarningsDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Next Earnings</span>
                    <span>{fundamentals.nextEarningsDate}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50">
              <CardContent className="pt-4 text-center text-muted-foreground">
                No fundamentals data available
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </ScrollArea>
    </Tabs>
  );
}

function CageCard({ title, cage, type }: { 
  title: string; 
  cage: any; 
  type: 'impulse' | 'correction' | 'wedge' 
}) {
  const isBroken = type === 'correction' 
    ? (cage.broken_up || cage.broken_down)
    : cage.broken;

  return (
    <Card className="border-border/50">
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium">{title}</span>
          {cage.exists ? (
            <Badge variant={isBroken ? 'default' : 'secondary'}>
              {isBroken ? 'BROKEN' : 'Intact'}
            </Badge>
          ) : (
            <Badge variant="outline">N/A</Badge>
          )}
        </div>
        
        {cage.exists && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Break Strength</span>
              <span>{cage.break_strength?.toFixed(2) || 0} ATR</span>
            </div>
            {type === 'impulse' && cage.bars_since_break > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Bars Since Break</span>
                <span>{cage.bars_since_break}</span>
              </div>
            )}
            {type === 'correction' && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Direction</span>
                <span>
                  {cage.broken_up && 'Up '}
                  {cage.broken_down && 'Down'}
                  {!cage.broken_up && !cage.broken_down && '-'}
                </span>
              </div>
            )}
            {type === 'wedge' && cage.wedge_type && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Type</span>
                <span className="capitalize">{cage.wedge_type}</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
