import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function UpgradeModal() {
  return (
    <Card id="upgrade" className="clean-card border-primary/20 bg-gradient-surface max-w-md">
      <div className="text-center p-8">
        <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
          <Crown className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Unlock Advanced Analysis</h3>
        <p className="text-muted-foreground mb-6">Get unlimited symbols and advanced ML predictions</p>
        <Button className="w-full" size="lg">Upgrade to Pro</Button>
      </div>
    </Card>
  );
}
