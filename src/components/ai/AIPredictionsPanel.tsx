import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { WaveCountDisplay } from "@/components/elliott/WaveCountDisplay";
import { AdvancedElliottWaveChart } from "@/components/charts/AdvancedElliottWaveChart";
import { Loader2 } from "lucide-react";

export function AIPredictionsPanel() {
  const { t } = useTranslation();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [candles, setCandles] = useState<any[]>([]);
  
  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      // First fetch OHLCV data
      const { data: ohlcvData, error: ohlcvError } = await supabase.functions.invoke('fetch-ohlcv', {
        body: { symbol: 'NFLX', interval: '1d' }
      });

      if (ohlcvError) throw ohlcvError;
      
      // Store candles for the chart
      if (ohlcvData?.candles) {
        setCandles(ohlcvData.candles);
      }

      // Then analyze Elliott Wave
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-elliott-wave', {
        body: { 
          symbol: 'NFLX', 
          timeframe: '1D',
          candles: ohlcvData?.candles || [],
          historical_low: ohlcvData?.historical_low
        }
      });

      if (analysisError) throw analysisError;
      
      // The response contains the analysis in analysisData.analysis
      console.log('Analysis response:', analysisData);
      setAnalysis(analysisData.analysis || analysisData);
      toast.success("Análisis completado");
    } catch (error: any) {
      console.error('Analysis error:', error);
      toast.error(error.message || "Error al analizar");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApprove = () => {
    toast.success("Conteo aprobado y guardado");
    // Aquí puedes guardar el conteo en la base de datos
  };

  const handleReject = async () => {
    toast.info("Recalculando conteo...");
    setAnalysis(null);
    await handleAnalyze();
  };
  
  return (
    <div className="space-y-4">
      <Card className="glass-card border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-primary font-semibold">{t('analysis.aiPanel.title')}</h3>
            <Button onClick={handleAnalyze} disabled={isAnalyzing} size="sm">
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analizando...
                </>
              ) : (
                'Analizar NFLX'
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!analysis && !isAnalyzing && (
            <p className="text-muted-foreground text-center py-4">
              Haz clic en "Analizar" para obtener el conteo de ondas Elliott
            </p>
          )}
        </CardContent>
      </Card>

      {analysis && (
        <>
          {/* Wave Count Display */}
          <WaveCountDisplay 
            analysis={analysis}
            onApprove={handleApprove}
            onReject={handleReject}
          />

          {/* Visual Chart */}
          {analysis.supercycle && analysis.supercycle.length > 0 && (
            <Card className="clean-card">
              <CardContent className="pt-6">
                <AdvancedElliottWaveChart
                  data={{
                    waves: analysis.supercycle
                      .filter((w: any) => w.start && w.end)
                      .map((w: any) => ({
                        wave: String(w.wave),
                        start_price: w.start,
                        end_price: w.end,
                        start_date: w.date_start,
                        end_date: w.date_end,
                        degree: 'Supercycle'
                      })),
                    key_levels: {
                      support: [],
                      resistance: [],
                      invalidation: 0
                    }
                  }}
                  symbol={analysis.symbol}
                  candles={candles}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
