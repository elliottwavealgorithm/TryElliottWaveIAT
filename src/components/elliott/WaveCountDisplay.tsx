import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";

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
  const completedWaves = analysis.supercycle.filter(w => !w.status || w.status === undefined);
  const inProgressWave = analysis.supercycle.find(w => w.status === "in_progress");
  const pendingWaves = analysis.supercycle.filter(w => w.status === "pending");

  return (
    <Card className="clean-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Análisis Elliott Wave - Supercycle</CardTitle>
          {analysis.confidence && (
            <Badge variant="outline">
              Confianza: {(analysis.confidence * 100).toFixed(0)}%
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Historical Low */}
        {analysis.historical_low && (
          <div className="p-3 bg-muted/30 rounded-lg border border-border">
            <div className="text-xs text-muted-foreground mb-1">Mínimo Histórico</div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{analysis.historical_low.date}</span>
              <span className="text-lg font-bold">${analysis.historical_low.price.toFixed(4)}</span>
            </div>
          </div>
        )}

        {/* Completed Waves Table */}
        {completedWaves.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Ondas Completadas</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Onda</th>
                    <th className="text-left py-2 px-2">Inicio</th>
                    <th className="text-left py-2 px-2">Fin</th>
                    <th className="text-right py-2 px-2">Precio Inicio</th>
                    <th className="text-right py-2 px-2">Precio Fin</th>
                    <th className="text-right py-2 px-2">Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {completedWaves.map((wave, idx) => {
                    const change = wave.start && wave.end 
                      ? ((wave.end - wave.start) / wave.start * 100)
                      : 0;
                    return (
                      <tr key={idx} className="border-b border-border/50">
                        <td className="py-2 px-2 font-medium">Onda {wave.wave}</td>
                        <td className="py-2 px-2 text-muted-foreground">{wave.date_start || '-'}</td>
                        <td className="py-2 px-2 text-muted-foreground">{wave.date_end || '-'}</td>
                        <td className="py-2 px-2 text-right">${wave.start?.toFixed(2) || '-'}</td>
                        <td className="py-2 px-2 text-right">${wave.end?.toFixed(2) || '-'}</td>
                        <td className="py-2 px-2 text-right">
                          <Badge variant="outline">{wave.ratio?.toFixed(3) || '-'}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* In Progress Wave */}
        {inProgressWave && (
          <div className="p-4 rounded-lg bg-accent/20 border border-accent">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-accent mt-0.5" />
              <div>
                <div className="font-medium">Onda {inProgressWave.wave} - En Progreso</div>
                <div className="text-sm text-muted-foreground">{inProgressWave.projection}</div>
              </div>
            </div>
            {inProgressWave.target_zone && inProgressWave.target_zone.length === 2 && (
              <div className="text-sm">
                <span className="text-muted-foreground">Zona objetivo: </span>
                <span className="font-medium">
                  ${inProgressWave.target_zone[0].toFixed(2)} - ${inProgressWave.target_zone[1].toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Pending Waves */}
        {pendingWaves.length > 0 && (
          <div className="p-3 bg-muted/20 rounded-lg border border-border">
            <div className="text-sm font-medium mb-2">Ondas Pendientes</div>
            <div className="flex gap-2">
              {pendingWaves.map((wave, idx) => (
                <Badge key={idx} variant="secondary">
                  Onda {wave.wave}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {analysis.notes && (
          <div className="text-sm text-muted-foreground italic p-3 bg-muted/30 rounded-lg">
            {analysis.notes}
          </div>
        )}

        {/* Visual Pivots Summary */}
        {analysis.visual_pivots && analysis.visual_pivots.length > 0 && (
          <div className="p-3 bg-muted/20 rounded-lg border border-border">
            <div className="text-sm font-medium mb-2">Pivotes Visuales Detectados</div>
            <div className="text-xs text-muted-foreground">
              {analysis.visual_pivots.length} pivotes en múltiples grados de ondas
            </div>
          </div>
        )}

        {/* Meta Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t">
          <span>Símbolo: {analysis.symbol}</span>
          <span>Temporalidad: {analysis.timeframe}</span>
        </div>

        {/* Action Buttons */}
        {(onApprove || onReject) && (
          <div className="flex gap-3 pt-4">
            {onApprove && (
              <Button onClick={onApprove} className="flex-1" variant="default">
                <CheckCircle className="h-4 w-4 mr-2" />
                Aprobar Conteo
              </Button>
            )}
            {onReject && (
              <Button onClick={onReject} className="flex-1" variant="outline">
                <XCircle className="h-4 w-4 mr-2" />
                Rechazar y Recalcular
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
