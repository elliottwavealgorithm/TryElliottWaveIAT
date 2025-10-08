import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Pivot {
  index: number;
  type: "high" | "low";
  price: number;
  date: string;
}

interface PivotsListProps {
  pivots: Pivot[];
}

export function PivotsList({ pivots }: PivotsListProps) {
  return (
    <Card className="clean-card">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Pivotes Detectados</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {pivots.map((pivot, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {pivot.type === "high" ? (
                  <TrendingUp className="h-4 w-4 text-success" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-destructive" />
                )}
                <div className="text-sm">
                  <div className="font-medium">${pivot.price.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">{pivot.date}</div>
                </div>
              </div>
              <Badge variant={pivot.type === "high" ? "default" : "secondary"}>
                {pivot.type === "high" ? "HIGH" : "LOW"}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
