import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function AIPredictionsPanel() {
  return (
    <Card className="glass-card border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-primary font-semibold">AI Elliott Wave Analysis</h3>
          <Badge variant="success">Model Confidence: 87%</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <div className="text-muted-foreground">Wave Count Suggestions</div>
          <ul className="list-disc list-inside">
            <li>Primary: Impulse Wave 3 en progreso</li>
            <li>Alterno: Corrección ABC esperada</li>
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-muted-foreground">Price Targets</div>
            <div className="font-medium">$195.50 • $201.20</div>
          </div>
          <div>
            <div className="text-muted-foreground">Risk Levels</div>
            <div className="font-medium">Moderate</div>
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Invalidation Point</div>
          <div className="font-medium">$183.40</div>
        </div>
      </CardContent>
    </Card>
  );
}
