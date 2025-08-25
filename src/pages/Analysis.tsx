import { Helmet } from "react-helmet-async";
import AppLayout from "@/components/layout/AppLayout";
import { WaveToolbar } from "@/components/analysis/WaveToolbar";
import { AIPredictionsPanel } from "@/components/ai/AIPredictionsPanel";
import { TradingViewPlaceholder } from "@/components/analysis/TradingViewPlaceholder";
import { useTranslation } from "react-i18next";

export default function Analysis() {
  const { t } = useTranslation();
  
  return (
    <AppLayout>
      <Helmet>
        <title>{t('analysis.title')}</title>
        <meta name="description" content={t('analysis.description')} />
        <link rel="canonical" href="/analysis" />
      </Helmet>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 space-y-4">
          <WaveToolbar />
          <TradingViewPlaceholder />
        </section>
        <aside className="space-y-4">
          <AIPredictionsPanel />
          <div className="glass-card rounded-lg p-4">
            <h3 className="font-semibold mb-2">{t('analysis.controls.title')}</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>{t('analysis.controls.symbolSelector')}</li>
              <li>{t('analysis.controls.timeframeControls')}</li>
              <li>{t('analysis.controls.elliottWaveTools')}</li>
              <li>{t('analysis.controls.validationExport')}</li>
            </ul>
          </div>
        </aside>
      </main>
    </AppLayout>
  );
}
