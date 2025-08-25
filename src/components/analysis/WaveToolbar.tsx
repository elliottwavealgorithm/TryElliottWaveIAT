import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export function WaveToolbar({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
  
  return (
    <div className="flex gap-2 mb-4">
      <Button variant="outline" size="sm">{t('analysis.toolbar.elliottTools')}</Button>
      <Button variant="outline" size="sm">{t('analysis.toolbar.aiPredictions')}</Button>
      {children}
    </div>
  );
}
