import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, AlertTriangle, TrendingUp } from "lucide-react";

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

interface HistoricalLow {
  price: number;
  date: string;
}

interface VisualPivot {
  date: string;
  price: number;
  wave: string;
  degree: string;
}

interface Analysis {
  symbol: string;
  timeframe: string;
  historical_low?: HistoricalLow;
  supercycle: SupercycleWave[];
  confidence?: number;
  notes?: string;
  visual_pivots?: VisualPivot[];
}

interface WaveCountDisplayProps {
  analysis: Analysis;
  onApprove?: () => void;
  onReject?: () => void;
}

export function WaveCountDisplay({ analysis, onApprove, onReject }: WaveCountDisplayProps) {
  const completedWaves = analysis.supercycle?.filter(w => !w.status || w.status === undefined) || [];
  const inProgressWave = analysis.supercycle?.find(w => w.status === "in_progress");
  const pendingWaves = analysis.supercycle?.filter(w => w.status === "pending") || [];

  return (
    <Card className="clean-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Elliott Wave Analysis</CardTitle>
              <p className="text-xs text-muted-foreground">Supercycle Degree</p>
            </div>
          </div>
          {analysis.confidence && (
            <Badge variant="outline" className="text-xs font-mono">
              {(analysis.confidence * 100).toFixed(0)}% confidence
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
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

        {/* Completed Waves Table */}
        {completedWaves.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Completed Waves</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Wave</th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Start</th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">End</th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Start Price</th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">End Price</th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {completedWaves.map((wave, idx) => (
                    <tr key={idx} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-2 font-semibold">Wave {wave.wave}</td>
                      <td className="py-3 px-2 text-muted-foreground font-mono text-xs">{wave.date_start || '-'}</td>
                      <td className="py-3 px-2 text-muted-foreground font-mono text-xs">{wave.date_end || '-'}</td>
                      <td className="py-3 px-2 text-right font-mono">${wave.start?.toFixed(2) || '-'}</td>
                      <td className="py-3 px-2 text-right font-mono">${wave.end?.toFixed(2) || '-'}</td>
                      <td className="py-3 px-2 text-right">
                        <Badge variant="secondary" className="font-mono text-xs">{wave.ratio?.toFixed(3) || '-'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* In Progress Wave */}
        {inProgressWave && (
          <div className="p-4 rounded-xl bg-warning/10 border border-warning/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold">Wave {inProgressWave.wave} — In Progress</div>
                <div className="text-sm text-muted-foreground mt-1">{inProgressWave.projection}</div>
                {inProgressWave.target_zone && inProgressWave.target_zone.length === 2 && (
                  <div className="text-sm mt-2">
                    <span className="text-muted-foreground">Target zone: </span>
                    <span className="font-mono font-medium">
                      ${inProgressWave.target_zone[0].toFixed(2)} — ${inProgressWave.target_zone[1].toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pending Waves */}
        {pendingWaves.length > 0 && (
          <div className="p-4 bg-muted/20 rounded-xl border border-border">
            <div className="text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Pending Waves</div>
            <div className="flex gap-2">
              {pendingWaves.map((wave, idx) => (
                <Badge key={idx} variant="outline" className="font-mono">
                  Wave {wave.wave}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {analysis.notes && (
          <div className="text-sm text-muted-foreground p-4 bg-muted/20 rounded-xl border border-border">
            <div className="text-xs font-medium mb-2 uppercase tracking-wide">Analysis Notes</div>
            {analysis.notes}
          </div>
        )}

        {/* Visual Pivots Summary */}
        {analysis.visual_pivots && analysis.visual_pivots.length > 0 && (
          <div className="p-4 bg-muted/20 rounded-xl border border-border">
            <div className="text-xs font-medium mb-1 uppercase tracking-wide text-muted-foreground">Detected Pivots</div>
            <div className="text-sm">
              {analysis.visual_pivots.length} pivots across multiple wave degrees
            </div>
          </div>
        )}

        {/* Meta Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border font-mono">
          <span>Symbol: {analysis.symbol}</span>
          <span>Timeframe: {analysis.timeframe}</span>
        </div>

        {/* Action Buttons */}
        {(onApprove || onReject) && (
          <div className="flex gap-3 pt-4">
            {onApprove && (
              <Button onClick={onApprove} className="flex-1">
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve Count
              </Button>
            )}
            {onReject && (
              <Button onClick={onReject} className="flex-1" variant="outline">
                <XCircle className="h-4 w-4 mr-2" />
                Reject & Recalculate
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}