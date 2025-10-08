import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, TrendingUp, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TradingViewWidget } from "@/components/widgets/TradingViewWidget";
import { TimeframeSelector } from "@/components/elliott/TimeframeSelector";
import { PivotsList } from "@/components/elliott/PivotsList";
import { WaveCountDisplay } from "@/components/elliott/WaveCountDisplay";

interface ElliottAnalysis {
  symbol: string;
  timeframe: string;
  analysis: any;
  pivots: any[];
  lastPrice: number;
  dataPoints: number;
  loading: boolean;
  timestamp?: string;
}

export default function Index() {
  const [symbol, setSymbol] = useState("NFLX");
  const [timeframe, setTimeframe] = useState("1d");
  const [analysis, setAnalysis] = useState<ElliottAnalysis | null>(null);
  const { toast } = useToast();

  const analyzeSymbol = async () => {
    if (!symbol) {
      toast({
        title: "Error",
        description: "Por favor ingresa un símbolo",
        variant: "destructive",
      });
      return;
    }

    setAnalysis({ 
      symbol, 
      timeframe, 
      analysis: null, 
      pivots: [], 
      lastPrice: 0, 
      dataPoints: 0,
      loading: true 
    });

    try {
      const { data, error } = await supabase.functions.invoke('analyze-elliott-wave', {
        body: { symbol, timeframe }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to analyze');
      }

      setAnalysis({
        symbol: data.symbol,
        timeframe: data.timeframe,
        analysis: data.analysis,
        pivots: data.pivots || [],
        lastPrice: data.lastPrice,
        dataPoints: data.dataPoints,
        loading: false,
        timestamp: data.timestamp
      });

      toast({
        title: "Análisis completado",
        description: `${data.symbol} analizado con ${data.pivots?.length || 0} pivotes detectados`,
      });
    } catch (error) {
      console.error('Error:', error);
      setAnalysis(prev => prev ? { ...prev, loading: false } : null);
      
      let errorMessage = 'Error al generar el análisis';
      if (error instanceof Error) {
        if (error.message.includes('Rate limit')) {
          errorMessage = 'Límite de solicitudes alcanzado. Espera unos minutos.';
        } else if (error.message.includes('Payment required')) {
          errorMessage = 'Se requiere agregar créditos a Lovable AI.';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleApprove = () => {
    toast({
      title: "Conteo aprobado",
      description: "El análisis ha sido guardado",
    });
  };

  const handleReject = () => {
    toast({
      title: "Recalculando",
      description: "Generando nuevo análisis...",
    });
    analyzeSymbol();
  };

  return (
    <>
      <Helmet>
        <title>Impulse Pro - Análisis Elliott Wave con IA</title>
        <meta name="description" content="Decisiones claras a partir de estructuras complejas del mercado" />
        <link rel="canonical" href="/" />
      </Helmet>

      <div className="min-h-screen bg-gradient-surface">
        {/* Header */}
        <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className="h-8 w-8 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold text-gradient-brand">Impulse Pro</h1>
                  <p className="text-xs text-muted-foreground">Decisiones claras a partir de estructuras complejas del mercado</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                Elliott Wave AI
              </Badge>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-[1800px]">
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left Panel - Inputs */}
            <div className="lg:col-span-3 space-y-4">
              <Card className="clean-card">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Configuración</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">
                      Símbolo
                    </label>
                    <Input
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                      placeholder="NFLX"
                      className="font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">
                      Exchange (opcional)
                    </label>
                    <Input
                      placeholder="NASDAQ"
                      className="text-sm"
                      disabled
                    />
                  </div>
                </CardContent>
              </Card>

              <TimeframeSelector 
                selected={timeframe} 
                onSelect={setTimeframe} 
              />

              <Button 
                onClick={analyzeSymbol}
                className="w-full"
                disabled={analysis?.loading}
              >
                {analysis?.loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Analizando...
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Analizar
                  </>
                )}
              </Button>

              {analysis && analysis.pivots.length > 0 && (
                <PivotsList pivots={analysis.pivots} />
              )}
            </div>

            {/* Center Panel - Chart */}
            <div className="lg:col-span-6 space-y-4">
              <Card className="clean-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Gráfico - {symbol || 'Selecciona símbolo'}
                    {analysis && (
                      <Badge variant="secondary" className="ml-auto">
                        ${analysis.lastPrice?.toFixed(2)}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TradingViewWidget 
                    symbol={symbol || "NFLX"} 
                    height={600} 
                  />
                </CardContent>
              </Card>

              {analysis?.timestamp && (
                <div className="text-xs text-muted-foreground text-center">
                  Última actualización: {new Date(analysis.timestamp).toLocaleString()}
                  {' • '}
                  {analysis.dataPoints} puntos de datos
                </div>
              )}
            </div>

            {/* Right Panel - Results */}
            <div className="lg:col-span-3 space-y-4">
              {analysis?.loading ? (
                <Card className="clean-card">
                  <CardContent className="py-12 text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">
                      Detectando pivotes y analizando ondas...
                    </p>
                  </CardContent>
                </Card>
              ) : analysis?.analysis ? (
                <WaveCountDisplay 
                  analysis={analysis.analysis}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ) : (
                <Card className="clean-card">
                  <CardContent className="py-12 text-center">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-30 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Ingresa un símbolo y presiona Analizar
                    </p>
                    <p className="text-xs text-muted-foreground">
                      El algoritmo ZigZag detectará pivotes automáticamente
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Info Card */}
              <Card className="clean-card bg-muted/30">
                <CardHeader>
                  <CardTitle className="text-xs font-semibold">ℹ️ Cómo funciona</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-2">
                  <p>1. Algoritmo ZigZag detecta pivotes de precio</p>
                  <p>2. IA analiza patrones de Elliott Wave</p>
                  <p>3. Genera conteos impulsivos y correctivos</p>
                  <p>4. Valida con puntos de invalidación</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Admin Logs (Hidden by default) */}
          <details className="mt-8">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors p-4 bg-muted/20 rounded-lg">
              📋 Logs / Auditoría (Admin)
            </summary>
            {analysis && (
              <Card className="clean-card mt-4">
                <CardContent className="p-4">
                  <pre className="text-xs overflow-x-auto">
                    {JSON.stringify({
                      symbol: analysis.symbol,
                      timeframe: analysis.timeframe,
                      pivots_count: analysis.pivots.length,
                      model: "google/gemini-2.5-flash",
                      timestamp: analysis.timestamp,
                      analysis: analysis.analysis
                    }, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </details>
        </main>
      </div>
    </>
  );
}
