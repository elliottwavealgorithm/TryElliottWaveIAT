import { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function WaveToolbar({ children }: { children?: ReactNode }) {
  return (
    <div className="absolute top-4 left-4 flex gap-2">
      <Button variant="glass" size="sm">Elliott Tools</Button>
      <Button variant="glass" size="sm">AI Predictions</Button>
      {children}
    </div>
  );
}
