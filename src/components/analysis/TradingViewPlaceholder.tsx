import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, BarChart3, Zap, CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export function TradingViewPlaceholder() {
  const { t } = useTranslation();

  const features = t('analysis.chartPlaceholder.features', { returnObjects: true }) as string[];

  return (
    <Card className="glass-card border-primary/20 h-[520px] flex flex-col justify-center">
      <CardHeader className="text-center pb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <TrendingUp className="h-8 w-8 text-primary" />
          <BarChart3 className="h-8 w-8 text-secondary" />
        </div>
        <CardTitle className="text-2xl text-gradient-brand">
          {t('analysis.chartPlaceholder.title')}
        </CardTitle>
        <p className="text-lg font-semibold text-muted-foreground">
          {t('analysis.chartPlaceholder.subtitle')}
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div>
          <p className="text-muted-foreground mb-4">
            {t('analysis.chartPlaceholder.description')}
          </p>
          
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-6">
            {features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <Zap className="h-5 w-5 text-primary" />
            <p className="text-sm font-medium">
              {t('analysis.chartPlaceholder.note')}
            </p>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/10 border border-secondary/20">
            <div className="h-5 w-5 rounded-full bg-secondary flex items-center justify-center">
              <span className="text-xs font-bold text-secondary-foreground">AI</span>
            </div>
            <p className="text-sm font-medium">
              {t('analysis.chartPlaceholder.aiGuide')}
            </p>
          </div>
        </div>

        <div className="flex justify-center gap-2 pt-4">
          <Badge variant="outline" className="border-primary text-primary">
            Elliott Wave Methodology
          </Badge>
          <Badge variant="outline" className="border-secondary text-secondary">
            AI-Powered Analysis
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}