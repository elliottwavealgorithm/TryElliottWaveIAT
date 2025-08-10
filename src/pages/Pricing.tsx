import { Helmet } from "react-helmet-async";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Tier({ name, price, features }: { name: string; price: string; features: string[] }) {
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>{name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-3xl font-bold">{price}</div>
        <ul className="text-sm text-muted-foreground space-y-2">
          {features.map((f) => (
            <li key={f}>• {f}</li>
          ))}
        </ul>
        <Button variant="neon" size="lg">Choose {name}</Button>
      </CardContent>
    </Card>
  );
}

export default function Pricing() {
  return (
    <AppLayout>
      <Helmet>
        <title>Pricing – TryElliottWave</title>
        <meta name="description" content="Elige tu plan: gratuito o Pro para desbloquear análisis avanzados con IA." />
        <link rel="canonical" href="/pricing" />
      </Helmet>

      <main>
        <h1 className="text-3xl font-bold mb-6">Pricing</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Tier name="Free" price="$0" features={["3 symbols", "Predicciones básicas", "Historial limitado"]} />
          <Tier name="Pro" price="$19/mo" features={["Ilimitado", "Predicciones avanzadas IA", "Export & alerts"]} />
          <Tier name="Team" price="$49/mo" features={["Usuarios múltiples", "Colaboración", "Panel admin"]} />
        </div>
      </main>
    </AppLayout>
  );
}
