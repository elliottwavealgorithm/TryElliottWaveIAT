import { Helmet } from "react-helmet-async";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { PredictionCard } from "@/components/dashboard/PredictionCard";
import { TrendingUp } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { UpgradeModal } from "@/components/paywall/UpgradeModal";

export default function Index() {
  return (
    <AppLayout>
      <Helmet>
        <title>Dashboard – TryElliottWave</title>
        <meta name="description" content="Resumen de métricas clave y predicciones del modelo IA de ondas Elliott." />
        <link rel="canonical" href="/" />
      </Helmet>

      <main>
        <section className="mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold mb-2">Análisis con IA de Ondas Elliott</h1>
          <p className="text-muted-foreground max-w-2xl">Combina la experiencia de analistas con machine learning para generar conteos y predicciones automáticas.</p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <MetricCard title="Model Accuracy" value="89.2%" change="+2.1%" icon={<TrendingUp />} />
          <MetricCard title="Active Analyses" value="12" change="3 new" />
          <MetricCard title="Watchlist Symbols" value="27" />
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <PredictionCard symbol="AAPL" waveCount="Wave 3 in progress" target="$195.50" confidence="High" timeframe="1D" />
          <PredictionCard symbol="BTCUSD" waveCount="ABC correction scenario" target="$61,200" confidence="Medium" timeframe="4H" />
          <PredictionCard symbol="TSLA" waveCount="Impulse Wave 5 potential" target="$254.00" confidence="High" timeframe="1D" />
        </section>

        <section className="mb-8">
          <UpgradeModal />
        </section>
      </main>
    </AppLayout>
  );
}
