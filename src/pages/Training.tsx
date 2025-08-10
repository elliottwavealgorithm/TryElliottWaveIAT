import { Helmet } from "react-helmet-async";
import AppLayout from "@/components/layout/AppLayout";

export default function Training() {
  return (
    <AppLayout>
      <Helmet>
        <title>Training Queue – TryElliottWave</title>
        <meta name="description" content="Interfaz de revisión para submissions de analistas y dataset de entrenamiento." />
        <link rel="canonical" href="/training" />
      </Helmet>

      <main className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="glass-card rounded-lg p-4">
          <h1 className="text-2xl font-bold mb-2">Analyst Submissions</h1>
          <p className="text-sm text-muted-foreground">Queue de análisis pendientes de revisión.</p>
          <div className="mt-4 h-64 rounded-md border border-dashed border-border/60 flex items-center justify-center text-muted-foreground">
            Empty state – connect to data later
          </div>
        </section>
        <section className="glass-card rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-2">Review Interface</h2>
          <div className="h-64 rounded-md border border-dashed border-border/60 mb-3" />
          <div className="text-sm text-muted-foreground">Annotation tools • Approve/Reject • Comments</div>
        </section>
      </main>
    </AppLayout>
  );
}
