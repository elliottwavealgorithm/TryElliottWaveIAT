import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Zap, Clock, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Recommendation {
  symbol: string;
  exchange: string;
  waveType: "Wave3" | "WaveC" | "WaveB";
  priority: "ALTA" | "MEDIA" | "BAJA";
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  confidence: number;
  timeframe: "Diario" | "Semanal" | "Mensual";
  lastUpdate: string;
  reasoning: string;
}

// Mock data - en producción vendría del LLM
const MOCK_RECOMMENDATIONS: Recommendation[] = [
  {
    symbol: "TSLA",
    exchange: "NASDAQ",
    waveType: "Wave3",
    priority: "ALTA",
    entryPrice: 185.50,
    targetPrice: 245.00,
    stopLoss: 165.00,
    confidence: 85,
    timeframe: "Diario",
    lastUpdate: new Date().toISOString(),
    reasoning: "Rompimiento confirmado de onda 2, impulso alcista iniciando onda 3 con volumen creciente"
  },
  {
    symbol: "NVDA",
    exchange: "NASDAQ", 
    waveType: "WaveC",
    priority: "ALTA",
    entryPrice: 118.75,
    targetPrice: 145.00,
    stopLoss: 108.00,
    confidence: 78,
    timeframe: "Diario",
    lastUpdate: new Date().toISOString(),
    reasoning: "Patrón ABC correctivo completando onda C alcista, confluencia con soporte mayor"
  },
  {
    symbol: "WALMEX.MX",
    exchange: "BMV",
    waveType: "Wave3",
    priority: "MEDIA",
    entryPrice: 62.50,
    targetPrice: 75.80,
    stopLoss: 58.20,
    confidence: 72,
    timeframe: "Semanal",
    lastUpdate: new Date().toISOString(),
    reasoning: "Onda 3 de grado intermedio iniciando tras completar corrección en onda 2"
  }
];

const WAVE_COLORS = {
  Wave3: "bg-success text-success-foreground",
  WaveC: "bg-primary text-primary-foreground", 
  WaveB: "bg-warning text-warning-foreground"
};

const PRIORITY_COLORS = {
  ALTA: "bg-destructive text-destructive-foreground",
  MEDIA: "bg-warning text-warning-foreground",
  BAJA: "bg-muted text-muted-foreground"
};

export function RecommendationsDashboard() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>(MOCK_RECOMMENDATIONS);
  const [activeTab, setActiveTab] = useState("diario");
  const [isGenerating, setIsGenerating] = useState(false);

  const generateRecommendations = async () => {
    setIsGenerating(true);
    
    // Simular llamada al LLM para generar recomendaciones
    try {
      const { data, error } = await supabase.functions.invoke('generate-recommendations', {
        body: { 
          timeframe: activeTab,
          criteria: {
            waveTypes: ["Wave3", "WaveC", "WaveB"],
            minConfidence: 70,
            maxPositions: 10
          }
        }
      });

      if (data?.recommendations) {
        setRecommendations(data.recommendations);
      }
    } catch (error) {
      console.error('Error generating recommendations:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const filteredRecommendations = recommendations.filter(rec => {
    const timeframeMap = {
      "diario": "Diario",
      "semanal": "Semanal", 
      "mensual": "Mensual"
    };
    return rec.timeframe === timeframeMap[activeTab as keyof typeof timeframeMap];
  });

  const getROI = (entry: number, target: number) => {
    return ((target - entry) / entry * 100).toFixed(1);
  };

  return (
    <Card className="clean-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Dashboard de Recomendaciones IA
          </div>
          <Button 
            onClick={generateRecommendations}
            disabled={isGenerating}
            size="sm"
          >
            {isGenerating ? "Generando..." : "Actualizar"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="diario">Diario</TabsTrigger>
            <TabsTrigger value="semanal">Semanal</TabsTrigger>
            <TabsTrigger value="mensual">Mensual</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4">
            <div className="grid gap-4">
              {filteredRecommendations.length > 0 ? (
                filteredRecommendations.map((rec, index) => (
                  <Card key={`${rec.symbol}-${index}`} className="border-l-4 border-l-primary">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-bold">
                            {rec.symbol}
                          </Badge>
                          <Badge className={WAVE_COLORS[rec.waveType]}>
                            {rec.waveType}
                          </Badge>
                          <Badge className={PRIORITY_COLORS[rec.priority]}>
                            {rec.priority}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-success">
                            ROI: +{getROI(rec.entryPrice, rec.targetPrice)}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Confianza: {rec.confidence}%
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div>
                          <div className="text-xs text-muted-foreground">Entrada</div>
                          <div className="font-medium">${rec.entryPrice.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Objetivo</div>
                          <div className="font-medium text-success">${rec.targetPrice.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Stop Loss</div>
                          <div className="font-medium text-destructive">${rec.stopLoss.toFixed(2)}</div>
                        </div>
                      </div>

                      <div className="text-sm text-muted-foreground mb-3">
                        <strong>Fundamentación:</strong> {rec.reasoning}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Actualizado: {new Date(rec.lastUpdate).toLocaleDateString()}
                        </div>
                        <Button size="sm" className="h-7">
                          <Target className="h-3 w-3 mr-1" />
                          Operar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-30 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    No hay recomendaciones {activeTab}s disponibles
                  </p>
                  <Button 
                    onClick={generateRecommendations}
                    className="mt-4"
                    disabled={isGenerating}
                  >
                    Generar Recomendaciones
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}