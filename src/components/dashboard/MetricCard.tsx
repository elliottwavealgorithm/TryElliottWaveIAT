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
    <Card className="glass-card">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{title}</span>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-semibold tracking-tight">{value}</span>
          {change && (
            <span className="text-sm text-muted-foreground">{change}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
