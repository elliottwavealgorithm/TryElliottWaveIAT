import { Helmet } from "react-helmet-async";
import AppLayout from "@/components/layout/AppLayout";
import { WaveToolbar } from "@/components/analysis/WaveToolbar";
import { AIPredictionsPanel } from "@/components/ai/AIPredictionsPanel";

export default function Analysis() {
  return (
    <AppLayout>
      <Helmet>
        <title>Analysis Workspace – TryElliottWave</title>
        <meta name="description" content="Workspace con gráficos avanzados, herramientas de ondas Elliott y predicciones de IA." />
        <link rel="canonical" href="/analysis" />
      </Helmet>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="relative lg:col-span-2">
          <div className="relative rounded-lg border border-border glass-card">
            <div id="tradingview_chart" className="w-full h-[520px] rounded-lg" />
            <WaveToolbar />
          </div>
        </section>
        <aside className="space-y-4">
          <AIPredictionsPanel />
          <div className="glass-card rounded-lg p-4">
            <h3 className="font-semibold mb-2">Controls</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>Symbol selector</li>
              <li>Timeframe controls</li>
              <li>Elliott Wave tools</li>
              <li>Validation & export</li>
            </ul>
          </div>
        </aside>
      </main>
    </AppLayout>
  );
}
