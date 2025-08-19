import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export function WaveToolbar({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
  
  return (
    <div className="absolute top-4 left-4 flex gap-2">
      <Button variant="glass" size="sm">{t('analysis.toolbar.elliottTools')}</Button>
      <Button variant="glass" size="sm">{t('analysis.toolbar.aiPredictions')}</Button>
      {children}
    </div>
  );
}
