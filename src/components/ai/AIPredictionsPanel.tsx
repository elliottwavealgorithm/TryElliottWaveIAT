import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

export function AIPredictionsPanel() {
  const { t } = useTranslation();
  
  return (
    <Card className="glass-card border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-primary font-semibold">{t('analysis.aiPanel.title')}</h3>
          <Badge variant="success">{t('analysis.aiPanel.confidence')}: 87%</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <div className="text-muted-foreground">{t('analysis.aiPanel.waveCount')}</div>
          <ul className="list-disc list-inside">
            <li>{t('analysis.aiPanel.primary')}</li>
            <li>{t('analysis.aiPanel.alternate')}</li>
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-muted-foreground">{t('analysis.aiPanel.priceTargets')}</div>
            <div className="font-medium">$195.50 • $201.20</div>
          </div>
          <div>
            <div className="text-muted-foreground">{t('analysis.aiPanel.riskLevels')}</div>
            <div className="font-medium">{t('analysis.aiPanel.moderate')}</div>
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">{t('analysis.aiPanel.invalidationPoint')}</div>
          <div className="font-medium">$183.40</div>
        </div>
      </CardContent>
    </Card>
  );
}
