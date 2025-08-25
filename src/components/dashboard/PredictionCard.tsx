import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PredictionCardProps {
  symbol: string;
  waveCount: string;
  target: string;
  confidence: string;
  timeframe: string;
}

export function PredictionCard({ symbol, waveCount, target, confidence, timeframe }: PredictionCardProps) {
  return (
    <Card className="clean-card hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="text-lg font-bold text-primary">{symbol}</span>
          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">{timeframe}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground font-medium">{waveCount}</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Target</div>
            <div className="font-bold text-foreground">{target}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Confidence</div>
            <div className="font-bold text-success">{confidence}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
