import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, TrendingUp, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AdvancedElliottWaveChart } from "@/components/charts/AdvancedElliottWaveChart";
import { TradingViewWidget } from "@/components/widgets/TradingViewWidget";
import { InstrumentSelector } from "@/components/instrument/InstrumentSelector";
import { BrokerConnection } from "@/components/broker/BrokerConnection";
import { RecommendationsDashboard } from "@/components/dashboard/RecommendationsDashboard";

interface StockAnalysis {
  symbol: string;
  analysis: string;
  loading: boolean;
  chartData?: any;
  exchange?: string;
}

export default function Index() {
  const [selectedStock, setSelectedStock] = useState<StockAnalysis | null>(null);
  const { toast } = useToast();

  const addInstrument = (symbol: string, exchange: string) => {
    const newStock: StockAnalysis = {
      symbol,
      analysis: "",
      loading: false,
      exchange
    };

    setSelectedStock(newStock);
    
    toast({
      title: "Instrumento seleccionado",
      description: `${symbol} de ${exchange} listo para análisis`,
    });
  };

  const analyzeStock = async () => {
    if (!selectedStock) return;
    
    setSelectedStock(prev => prev ? { ...prev, loading: true, analysis: "" } : null);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-stock', {
        body: { stock: selectedStock.symbol, question: "Análisis completo de Elliott Wave" }
      });

      if (error) throw error;

      setSelectedStock(prev => prev ? { 
        ...prev, 
        loading: false, 
        analysis: data.analysis, 
        chartData: data.chartData 
      } : null);

      toast({
        title: "Análisis completado",
        description: `Análisis de ${selectedStock.symbol} generado exitosamente`,
      });
    } catch (error) {
      console.error('Error:', error);
      setSelectedStock(prev => prev ? { ...prev, loading: false } : null);
      
      toast({
        title: "Error",
        description: `Error al generar el análisis de ${selectedStock.symbol}. Verifica que el símbolo sea correcto.`,
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Helmet>
        <title>Elliott - Análisis de Acciones con IA</title>
        <meta name="description" content="Análisis profesional de acciones con Teoría de Ondas de Elliott" />
        <link rel="canonical" href="/" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-12 max-w-7xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-4">
              <TrendingUp className="h-8 w-8 text-primary" />
              <h1 className="text-4xl font-bold text-foreground">Impulse Analytics</h1>
            </div>
            <p className="text-xl text-muted-foreground">
              Análisis inteligente de acciones con Ondas de Elliott + IA
            </p>
          </div>

          <Tabs defaultValue="analysis" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="analysis">Análisis</TabsTrigger>
              <TabsTrigger value="recommendations">Recomendaciones IA</TabsTrigger>
              <TabsTrigger value="broker">Broker</TabsTrigger>
            </TabsList>

            <TabsContent value="analysis">
              <div className="grid gap-8 lg:grid-cols-3">
                {/* Instrument Selection */}
                <div className="lg:col-span-1 space-y-6">
                  <InstrumentSelector onAddInstrument={addInstrument} />
                  
                  {selectedStock && (
                    <Card className="clean-card">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <TrendingUp className="h-5 w-5" />
                          Instrumento Seleccionado
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-bold">{selectedStock.symbol}</Badge>
                            {selectedStock.exchange && (
                              <Badge variant="secondary" className="text-xs">{selectedStock.exchange}</Badge>
                            )}
                            {selectedStock.analysis && <Badge variant="default" className="text-xs">✓</Badge>}
                          </div>
                          <Button
                            onClick={() => setSelectedStock(null)}
                            size="sm"
                            variant="ghost"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        <Button 
                          onClick={analyzeStock}
                          className="w-full"
                          disabled={selectedStock.loading}
                        >
                          {selectedStock.loading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Analizando...
                            </>
                          ) : (
                            'Analizar con Elliott Wave'
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  <div className="text-xs text-muted-foreground p-4 bg-muted/30 rounded-lg">
                    <p className="mb-2"><strong>📊 Mercados soportados:</strong></p>
                    <p>🇺🇸 EE.UU.: NASDAQ, NYSE</p>
                    <p>🇲🇽 México: BMV</p>
                    <p>🇬🇧 Reino Unido: LSE</p>
                    <p>🇯🇵 Japón: TSE</p>
                  </div>
                </div>

                {/* Analysis Results */}
                <div className="lg:col-span-2">
                  <div className="space-y-6">
                    {!selectedStock ? (
                      <Card className="clean-card">
                        <CardContent className="text-center py-12">
                          <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-50 text-muted-foreground" />
                          <h3 className="text-lg font-semibold mb-2">Selecciona un Instrumento</h3>
                          <p className="text-muted-foreground">
                            Usa el selector de instrumentos para elegir una acción y generar análisis Elliott Wave
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="clean-card">
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <Badge variant="outline" className="font-bold">
                                {selectedStock.symbol}
                              </Badge>
                              <span className="text-lg">Análisis Elliott Wave</span>
                            </span>
                            {selectedStock.loading && (
                              <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            )}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {selectedStock.loading ? (
                            <div className="flex items-center justify-center py-8">
                              <div className="text-center">
                                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                                <p className="text-muted-foreground">Analizando {selectedStock.symbol}...</p>
                              </div>
                            </div>
                          ) : selectedStock.analysis ? (
                             <div className="prose prose-sm max-w-none">
                               <div className="space-y-6">
                                 <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground bg-muted/50 p-4 rounded-lg border">
                                   {selectedStock.analysis}
                                 </pre>
                                 
                                 {selectedStock.chartData && (
                                   <div>
                                     <h4 className="text-sm font-medium mb-3">Gráfico Elliott Wave</h4>
                                     <AdvancedElliottWaveChart data={selectedStock.chartData} symbol={selectedStock.symbol} />
                                   </div>
                                 )}
                               </div>
                             </div>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-30" />
                              <p>Haz clic en "Analizar con Elliott Wave" para generar el análisis</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </div>
              
              {/* TradingView Widget - Full Width */}
              {selectedStock && (
                <div className="mt-8">
                  <Card className="clean-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Gráfico TradingView - {selectedStock.symbol}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <TradingViewWidget 
                        symbol={selectedStock.symbol} 
                        height={600} 
                      />
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="recommendations">
              <RecommendationsDashboard />
            </TabsContent>

            <TabsContent value="broker">
              <BrokerConnection />
            </TabsContent>

          </Tabs>
        </main>
      </div>
    </>
  );
}