import { Helmet } from "react-helmet-async";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { PredictionCard } from "@/components/dashboard/PredictionCard";
import { TrendingUp } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { UpgradeModal } from "@/components/paywall/UpgradeModal";
import { useTranslation } from "react-i18next";

export default function Index() {
  const { t } = useTranslation();
  
  return (
    <AppLayout>
      <Helmet>
        <title>Dashboard – TryElliottWave</title>
        <meta name="description" content={t('dashboard.subtitle')} />
        <link rel="canonical" href="/" />
      </Helmet>

      <main className="max-w-7xl mx-auto">
        <section className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gradient-brand">{t('dashboard.title')}</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">{t('dashboard.subtitle')}</p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <MetricCard title={t('dashboard.metrics.modelAccuracy')} value="89.2%" change="+2.1%" icon={<TrendingUp />} />
          <MetricCard title={t('dashboard.metrics.activeAnalyses')} value="12" change={`3 ${t('dashboard.metrics.new')}`} />
          <MetricCard title={t('dashboard.metrics.watchlistSymbols')} value="27" />
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6 text-center">{t('dashboard.predictions')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PredictionCard symbol="AAPL" waveCount={t('dashboard.predictions.waveInProgress')} target="$195.50" confidence={t('dashboard.predictions.high')} timeframe="1D" />
            <PredictionCard symbol="BTCUSD" waveCount={t('dashboard.predictions.abcCorrection')} target="$61,200" confidence={t('dashboard.predictions.medium')} timeframe="4H" />
            <PredictionCard symbol="TSLA" waveCount={t('dashboard.predictions.impulseWave5')} target="$254.00" confidence={t('dashboard.predictions.high')} timeframe="1D" />
          </div>
        </section>

        <section className="flex justify-center">
          <UpgradeModal />
        </section>
      </main>
    </AppLayout>
  );
}
