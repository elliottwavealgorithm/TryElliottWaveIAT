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
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>{symbol}</span>
          <span className="text-xs text-muted-foreground">{timeframe}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        <div className="text-sm text-muted-foreground">{waveCount}</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Target</div>
            <div className="font-semibold">{target}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Confidence</div>
            <div className="font-semibold">{confidence}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
