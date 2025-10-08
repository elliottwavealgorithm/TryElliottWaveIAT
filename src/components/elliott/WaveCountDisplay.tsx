import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface Wave {
  n: number;
  inicio: string;
  fin: string;
  precio_inicio: number;
  precio_fin: number;
}

interface WaveCount {
  tipo: string;
  confidence: number;
  ondas: Wave[];
  invalidacion?: {
    price: number;
    reason: string;
  };
  notes?: string;
}

interface Analysis {
  simbolo: string;
  temporalidad: string;
  grado: string;
  conteos: WaveCount[];
  pivotes_usados?: number;
  escenario_alternativo?: string;
}

interface WaveCountDisplayProps {
  analysis: Analysis;
  onApprove?: () => void;
  onReject?: () => void;
}

export function WaveCountDisplay({ analysis, onApprove, onReject }: WaveCountDisplayProps) {
  return (
    <Card className="clean-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Conteo de Ondas Elliott</CardTitle>
          <Badge variant="outline">{analysis.grado}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Count */}
        {analysis.conteos.map((conteo, idx) => (
          <div key={idx} className="space-y-4 p-4 rounded-lg bg-muted/20 border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={conteo.tipo === "impulsivo" ? "default" : "secondary"}>
                  {conteo.tipo.toUpperCase()}
                </Badge>
                <span className="text-sm font-medium">
                  Confianza: {(conteo.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Waves Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Onda</th>
                    <th className="text-left py-2 px-2">Inicio</th>
                    <th className="text-left py-2 px-2">Fin</th>
                    <th className="text-right py-2 px-2">Precio Inicio</th>
                    <th className="text-right py-2 px-2">Precio Fin</th>
                    <th className="text-right py-2 px-2">Cambio</th>
                  </tr>
                </thead>
                <tbody>
                  {conteo.ondas.map((onda, wIdx) => {
                    const change = ((onda.precio_fin - onda.precio_inicio) / onda.precio_inicio * 100);
                    return (
                      <tr key={wIdx} className="border-b border-border/50">
                        <td className="py-2 px-2 font-medium">Onda {onda.n}</td>
                        <td className="py-2 px-2 text-muted-foreground">{onda.inicio}</td>
                        <td className="py-2 px-2 text-muted-foreground">{onda.fin}</td>
                        <td className="py-2 px-2 text-right">${onda.precio_inicio.toFixed(2)}</td>
                        <td className="py-2 px-2 text-right">${onda.precio_fin.toFixed(2)}</td>
                        <td className={`py-2 px-2 text-right font-medium ${change >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Invalidation */}
            {conteo.invalidacion && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium">Punto de Invalidación: ${conteo.invalidacion.price.toFixed(2)}</div>
                  <div className="text-muted-foreground">{conteo.invalidacion.reason}</div>
                </div>
              </div>
            )}

            {/* Notes */}
            {conteo.notes && (
              <div className="text-sm text-muted-foreground italic p-3 bg-muted/30 rounded-lg">
                {conteo.notes}
              </div>
            )}
          </div>
        ))}

        {/* Alternative Scenario */}
        {analysis.escenario_alternativo && (
          <div className="p-3 bg-accent/20 rounded-lg border border-accent">
            <div className="text-sm font-medium mb-1">Escenario Alternativo:</div>
            <div className="text-sm text-muted-foreground">{analysis.escenario_alternativo}</div>
          </div>
        )}

        {/* Meta Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t">
          <span>Pivotes usados: {analysis.pivotes_usados || 'N/A'}</span>
          <span>Temporalidad: {analysis.temporalidad}</span>
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
