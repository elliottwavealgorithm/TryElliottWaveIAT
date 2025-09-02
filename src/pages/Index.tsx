import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AdvancedElliottWaveChart } from "@/components/charts/AdvancedElliottWaveChart";

interface StockAnalysis {
  symbol: string;
  analysis: string;
  loading: boolean;
  chartData?: any;
}

export default function Index() {
  const [stockInput, setStockInput] = useState("");
  const [portfolio, setPortfolio] = useState<StockAnalysis[]>([]);
  const { toast } = useToast();

  const addStock = () => {
    if (!stockInput.trim()) {
      toast({
        title: "Error",
        description: "Ingresa un símbolo de acción",
        variant: "destructive",
      });
      return;
    }

    const symbol = stockInput.trim().toUpperCase();
    
    if (portfolio.some(stock => stock.symbol === symbol)) {
      toast({
        title: "Error",
        description: "Esta acción ya está en tu portafolio",
        variant: "destructive",
      });
      return;
    }

    const newStock: StockAnalysis = {
      symbol,
      analysis: "",
      loading: false
    };

    setPortfolio(prev => [...prev, newStock]);
    setStockInput("");
  };

  const removeStock = (symbol: string) => {
    setPortfolio(prev => prev.filter(stock => stock.symbol !== symbol));
  };

  const analyzeStock = async (symbol: string) => {
    setPortfolio(prev => prev.map(stock => 
      stock.symbol === symbol 
        ? { ...stock, loading: true, analysis: "" }
        : stock
    ));

    try {
      const { data, error } = await supabase.functions.invoke('analyze-stock', {
        body: { stock: symbol, question: "Análisis completo de Elliott Wave" }
      });

      if (error) throw error;

      setPortfolio(prev => prev.map(stock => 
        stock.symbol === symbol 
          ? { ...stock, loading: false, analysis: data.analysis, chartData: data.chartData }
          : stock
      ));

      toast({
        title: "Análisis completado",
        description: `Análisis de ${symbol} generado exitosamente`,
      });
    } catch (error) {
      console.error('Error:', error);
      setPortfolio(prev => prev.map(stock => 
        stock.symbol === symbol 
          ? { ...stock, loading: false }
          : stock
      ));
      
      toast({
        title: "Error",
        description: `Error al generar el análisis de ${symbol}`,
        variant: "destructive",
      });
    }
  };

  const analyzeAllStocks = async () => {
    for (const stock of portfolio) {
      if (!stock.analysis && !stock.loading) {
        await analyzeStock(stock.symbol);
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  };

  return (
    <>
      <Helmet>
        <title>Elliott - Análisis de Portafolio con IA</title>
        <meta name="description" content="Análisis profesional de portafolio con Teoría de Ondas de Elliott" />
        <link rel="canonical" href="/" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-12 max-w-6xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-4">
              <TrendingUp className="h-8 w-8 text-primary" />
              <h1 className="text-4xl font-bold text-foreground">Elliott</h1>
            </div>
            <p className="text-xl text-muted-foreground">
              Análisis profesional de portafolio con Teoría de Ondas de Elliott
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Portfolio Management */}
            <div className="lg:col-span-1">
              <Card className="clean-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Gestión de Portafolio
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Ej. TSLA, WALMEX, CEMEXCPO"
                      value={stockInput}
                      onChange={(e) => setStockInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addStock()}
                      className="text-base"
                    />
                    <Button onClick={addStock} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Portafolio ({portfolio.length})</Label>
                      {portfolio.length > 0 && (
                        <Button 
                          onClick={analyzeAllStocks}
                          size="sm"
                          variant="outline"
                          disabled={portfolio.some(s => s.loading)}
                        >
                          Analizar Todo
                        </Button>
                      )}
                    </div>
                    
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {portfolio.map((stock) => (
                        <div key={stock.symbol} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{stock.symbol}</Badge>
                            {stock.analysis && <Badge variant="default" className="text-xs">✓</Badge>}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              onClick={() => analyzeStock(stock.symbol)}
                              size="sm"
                              variant="ghost"
                              disabled={stock.loading}
                            >
                              {stock.loading ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                'Analizar'
                              )}
                            </Button>
                            <Button
                              onClick={() => removeStock(stock.symbol)}
                              size="sm"
                              variant="ghost"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    <p className="mb-1"><strong>Mercados disponibles:</strong></p>
                    <p>🇺🇸 EE.UU.: TSLA, AAPL, MSFT, NVDA</p>
                    <p>🇲🇽 México: WALMEX, CEMEXCPO, FEMSA</p>
                    <p>📊 Índices: SPY, QQQ, IPC</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Analysis Results */}
            <div className="lg:col-span-2">
              <div className="space-y-6">
                {portfolio.length === 0 ? (
                  <Card className="clean-card">
                    <CardContent className="text-center py-12">
                      <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-50 text-muted-foreground" />
                      <h3 className="text-lg font-semibold mb-2">Construye tu Portafolio</h3>
                      <p className="text-muted-foreground">
                        Agrega símbolos de acciones para comenzar el análisis con Elliott Wave Theory
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  portfolio.map((stock) => (
                    <Card key={stock.symbol} className="clean-card">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Badge variant="outline" className="font-bold">
                              {stock.symbol}
                            </Badge>
                            <span className="text-lg">Análisis Elliott Wave</span>
                          </span>
                          {stock.loading && (
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {stock.loading ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="text-center">
                              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                              <p className="text-muted-foreground">Analizando {stock.symbol}...</p>
                            </div>
                          </div>
                        ) : stock.analysis ? (
                          <div className="prose prose-sm max-w-none">
                            <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground bg-muted/50 p-4 rounded-lg border">
                              {stock.analysis}
                            </pre>
                            {stock.chartData && (
                              <AdvancedElliottWaveChart data={stock.chartData} symbol={stock.symbol} />
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-30" />
                            <p>Haz clic en "Analizar" para generar el análisis Elliott Wave</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
