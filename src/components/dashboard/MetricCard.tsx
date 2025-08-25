import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  icon?: ReactNode;
}

export function MetricCard({ title, value, change, icon }: MetricCardProps) {
  return (
    <Card className="clean-card hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{title}</span>
          {icon && <div className="text-primary bg-primary/10 p-2 rounded-lg">{icon}</div>}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-foreground">{value}</span>
          {change && (
            <span className="text-sm font-medium text-success">{change}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
