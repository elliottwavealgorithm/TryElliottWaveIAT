import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Target, ShieldAlert } from "lucide-react";

interface WaveData {
  start?: number;
  end?: number;
  date_start?: string;
  date_end?: string;
  ratio?: number;
  status?: "complete" | "in_progress" | "pending";
  projection?: string;
  target_zone?: number[];
}

interface PrimaryCount {
  label: string;
  probability: string;
  waves: Record<string, WaveData>;
  pattern_type?: string;
  fib_validation?: string;
  channel_validation?: string;
  cage_validation?: string;
  invalidations?: string[] | string;
  commentary?: string;
}

interface AlternateCount {
  label: string;
  probability: string;
  justification?: string;
  invalidations?: string[] | string;
  cage_validation?: string;
}

interface Levels {
  key_supports?: number[];
  key_resistances?: number[];
  fibonacci_targets?: number[];
  invalidations?: number[];
}

interface HistoricalLow {
  price: number;
  date: string;
}

interface SupercycleWave {
  wave: number;
  start?: number;
  end?: number;
  date_start?: string;
  date_end?: string;
  ratio?: number;
  status?: "in_progress" | "pending";
  projection?: string;
  target_zone?: number[];
}

interface Analysis {
  symbol: string;
  timeframe: string;
  historical_low?: HistoricalLow;
  primary_count?: PrimaryCount;
  alternate_counts?: AlternateCount[];
  levels?: Levels;
  confidence?: number;
  notes?: string;
  supercycle?: SupercycleWave[];
}

interface WaveCountDisplayProps {
  analysis: Analysis;
}

export function WaveCountDisplay({ analysis }: WaveCountDisplayProps) {
  const primaryCount = analysis.primary_count;
  const supercycle = analysis.supercycle || [];
  const alternates = analysis.alternate_counts || [];
  const levels = analysis.levels;

  // Determine waves to display (prefer primary_count.waves, fallback to supercycle)
  const waves = primaryCount?.waves || {};
  const waveEntries = Object.entries(waves).filter(([_, w]) => w && (w.start !== undefined || w.status));

  return (
    <Card className="clean-card h-fit">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Elliott Wave Analysis</CardTitle>
              <p className="text-xs text-muted-foreground">
                {primaryCount?.pattern_type || 'Supercycle'} • {analysis.symbol}
              </p>
            </div>
          </div>
          {analysis.confidence && (
            <Badge variant="outline" className="text-xs font-mono">
              {(analysis.confidence * 100).toFixed(0)}% confidence
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Historical Low */}
        {analysis.historical_low && (
          <div className="p-4 bg-muted/30 rounded-xl border border-border">
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Historical Low</div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium font-mono">{analysis.historical_low.date}</span>
              <span className="text-xl font-bold font-mono">${analysis.historical_low.price.toFixed(4)}</span>
            </div>
          </div>
        )}

        {/* Primary Count - Waves Table */}
        {(waveEntries.length > 0 || supercycle.length > 0) && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {primaryCount?.label || 'Wave Structure'}
              </h3>
              {primaryCount?.probability && (
                <Badge 
                  variant={primaryCount.probability === 'high' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {primaryCount.probability} probability
                </Badge>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground uppercase">Wave</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground uppercase">Date</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground uppercase">Price</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {waveEntries.length > 0 ? (
                    waveEntries.map(([key, wave]) => (
                      <tr key={key} className="border-b border-border/50">
                        <td className="py-2 px-2 font-semibold capitalize">{key.replace('wave', 'Wave ')}</td>
                        <td className="py-2 px-2 text-muted-foreground font-mono text-xs">
                          {wave.date_start || '-'} → {wave.date_end || '-'}
                        </td>
                        <td className="py-2 px-2 text-right font-mono">
                          {wave.start?.toFixed(2) || '-'} → {wave.end?.toFixed(2) || '-'}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <Badge 
                            variant={wave.status === 'pending' ? 'outline' : wave.status === 'in_progress' ? 'secondary' : 'default'}
                            className="text-xs"
                          >
                            {wave.status || 'complete'}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  ) : supercycle.map((wave, idx) => (
                    <tr key={idx} className="border-b border-border/50">
                      <td className="py-2 px-2 font-semibold">Wave {wave.wave}</td>
                      <td className="py-2 px-2 text-muted-foreground font-mono text-xs">
                        {wave.date_start || '-'} → {wave.date_end || '-'}
                      </td>
                      <td className="py-2 px-2 text-right font-mono">
                        {wave.start?.toFixed(2) || '-'} → {wave.end?.toFixed(2) || '-'}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <Badge 
                          variant={wave.status === 'pending' ? 'outline' : wave.status === 'in_progress' ? 'secondary' : 'default'}
                          className="text-xs"
                        >
                          {wave.status || 'complete'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Validations */}
        {primaryCount && (
          <div className="grid grid-cols-2 gap-3 text-xs">
            {primaryCount.fib_validation && (
              <div className="p-3 bg-muted/20 rounded-lg">
                <div className="font-medium mb-1">Fibonacci</div>
                <div className="text-muted-foreground">{primaryCount.fib_validation}</div>
              </div>
            )}
            {primaryCount.cage_validation && (
              <div className="p-3 bg-muted/20 rounded-lg">
                <div className="font-medium mb-1">Cage Theory</div>
                <div className="text-muted-foreground">{primaryCount.cage_validation}</div>
              </div>
            )}
          </div>
        )}

        {/* Key Levels */}
        {levels && (
          <div className="p-4 bg-muted/20 rounded-xl border border-border space-y-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              <span className="text-sm font-semibold">Key Levels</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              {levels.key_supports && levels.key_supports.length > 0 && (
                <div>
                  <div className="text-muted-foreground mb-1">Supports</div>
                  <div className="font-mono">{levels.key_supports.map(s => `$${s.toFixed(2)}`).join(', ')}</div>
                </div>
              )}
              {levels.key_resistances && levels.key_resistances.length > 0 && (
                <div>
                  <div className="text-muted-foreground mb-1">Resistances</div>
                  <div className="font-mono">{levels.key_resistances.map(r => `$${r.toFixed(2)}`).join(', ')}</div>
                </div>
              )}
              {levels.fibonacci_targets && levels.fibonacci_targets.length > 0 && (
                <div>
                  <div className="text-muted-foreground mb-1">Fib Targets</div>
                  <div className="font-mono">{levels.fibonacci_targets.map(t => `$${t.toFixed(2)}`).join(', ')}</div>
                </div>
              )}
              {levels.invalidations && levels.invalidations.length > 0 && (
                <div>
                  <div className="text-muted-foreground mb-1 flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3 text-destructive" />
                    Invalidations
                  </div>
                  <div className="font-mono text-destructive">{levels.invalidations.map(i => `$${i.toFixed(2)}`).join(', ')}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Alternate Counts */}
        {alternates.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alternate Counts
            </h3>
            {alternates.map((alt, idx) => (
              <div key={idx} className="p-3 bg-warning/5 border border-warning/20 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{alt.label}</span>
                  <Badge variant="outline" className="text-xs">{alt.probability}</Badge>
                </div>
                {alt.justification && (
                  <p className="text-xs text-muted-foreground">{alt.justification}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Commentary / Notes */}
        {(primaryCount?.commentary || analysis.notes) && (
          <div className="p-4 bg-muted/20 rounded-xl border border-border">
            <div className="text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Analysis Notes</div>
            <p className="text-sm text-foreground/80">
              {primaryCount?.commentary || analysis.notes}
            </p>
          </div>
        )}

        {/* Meta Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border font-mono">
          <span>Symbol: {analysis.symbol}</span>
          <span>Timeframe: {analysis.timeframe}</span>
        </div>
      </CardContent>
    </Card>
  );
}