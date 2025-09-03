import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CreditCard, Shield, TrendingUp, AlertTriangle } from "lucide-react";

interface Broker {
  id: string;
  name: string;
  logo: string;
  country: string;
  features: string[];
  apiSupport: boolean;
}

const BROKERS: Broker[] = [
  {
    id: "interactive_brokers",
    name: "Interactive Brokers",
    logo: "🔸",
    country: "🇺🇸",
    features: ["API Trading", "Global Markets", "Low Fees"],
    apiSupport: true
  },
  {
    id: "gbm",
    name: "GBM+",
    logo: "📊",
    country: "🇲🇽",
    features: ["Mercado Mexicano", "Sin Comisiones", "App Móvil"],
    apiSupport: false
  },
  {
    id: "alpaca",
    name: "Alpaca",
    logo: "🦙",
    country: "🇺🇸",
    features: ["Commission-Free", "API First", "Fractional Shares"],
    apiSupport: true
  },
  {
    id: "td_ameritrade",
    name: "TD Ameritrade",
    logo: "🏛️",
    country: "🇺🇸",
    features: ["Thinkorswim", "Research Tools", "Education"],
    apiSupport: true
  }
];

export function BrokerConnection() {
  const [selectedBroker, setSelectedBroker] = useState<string>("");
  const [credentials, setCredentials] = useState({
    apiKey: "",
    apiSecret: "",
    accountId: ""
  });
  const [isConnected, setIsConnected] = useState(false);

  const broker = BROKERS.find(b => b.id === selectedBroker);

  const handleConnect = () => {
    // Simulate connection
    setIsConnected(true);
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setCredentials({ apiKey: "", apiSecret: "", accountId: "" });
  };

  return (
    <Card className="clean-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Conexión a Broker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isConnected ? (
          <>
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Las credenciales se almacenan de forma segura y solo se usan para ejecutar operaciones autorizadas.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <label className="text-sm font-medium">Selecciona tu Broker</label>
              <Select value={selectedBroker} onValueChange={setSelectedBroker}>
                <SelectTrigger>
                  <SelectValue placeholder="Elige un broker" />
                </SelectTrigger>
                <SelectContent>
                  {BROKERS.map((broker) => (
                    <SelectItem key={broker.id} value={broker.id}>
                      <div className="flex items-center gap-2">
                        <span>{broker.logo}</span>
                        <div className="flex flex-col">
                          <span className="font-medium">{broker.name}</span>
                          <div className="flex items-center gap-1">
                            <span>{broker.country}</span>
                            {broker.apiSupport && (
                              <Badge variant="secondary" className="text-xs">API</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {broker && (
              <div className="space-y-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span>{broker.logo}</span>
                    <span className="font-medium">{broker.name}</span>
                    <span>{broker.country}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {broker.features.map((feature) => (
                      <Badge key={feature} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>

                {broker.apiSupport ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">API Key</label>
                      <Input
                        type="password"
                        placeholder="Ingresa tu API Key"
                        value={credentials.apiKey}
                        onChange={(e) => setCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">API Secret</label>
                      <Input
                        type="password"
                        placeholder="Ingresa tu API Secret"
                        value={credentials.apiSecret}
                        onChange={(e) => setCredentials(prev => ({ ...prev, apiSecret: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Account ID</label>
                      <Input
                        placeholder="ID de tu cuenta"
                        value={credentials.accountId}
                        onChange={(e) => setCredentials(prev => ({ ...prev, accountId: e.target.value }))}
                      />
                    </div>
                    <Button 
                      onClick={handleConnect}
                      disabled={!credentials.apiKey || !credentials.apiSecret}
                      className="w-full"
                    >
                      Conectar Broker
                    </Button>
                  </div>
                ) : (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Este broker no soporta API trading automático. Las señales se mostrarán como recomendaciones manuales.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="text-center p-4 bg-success/10 border border-success/20 rounded-lg">
              <TrendingUp className="h-8 w-8 text-success mx-auto mb-2" />
              <h3 className="font-semibold text-success">Conectado a {broker?.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Listo para recibir señales de trading automáticas
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Balance</p>
                <p className="text-lg font-bold">$25,430.50</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Posiciones</p>
                <p className="text-lg font-bold">3</p>
              </div>
            </div>

            <Button 
              onClick={handleDisconnect}
              variant="outline"
              className="w-full"
            >
              Desconectar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}