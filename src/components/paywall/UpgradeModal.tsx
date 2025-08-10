import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function UpgradeModal() {
  return (
    <Card id="upgrade" className="glass-card border-2 border-secondary/40 bg-gradient-surface">
      <div className="text-center p-6">
        <Crown className="w-10 h-10 mx-auto mb-3 text-secondary" />
        <h3 className="text-lg font-semibold mb-1">Unlock Advanced Analysis</h3>
        <p className="text-sm text-muted-foreground mb-4">Get unlimited symbols and advanced ML predictions</p>
        <Button variant="hero" size="lg">Upgrade to Pro</Button>
      </div>
    </Card>
  );
}
