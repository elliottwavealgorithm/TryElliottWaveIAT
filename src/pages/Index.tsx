import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function Index() {
  const [stock, setStock] = useState("");
  const [question, setQuestion] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stock.trim() || !question.trim()) {
      toast({
        title: "Error",
        description: "Por favor completa ambos campos",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setAnalysis("");

    try {
      const { data, error } = await supabase.functions.invoke('analyze-stock', {
        body: { stock: stock.trim().toUpperCase(), question: question.trim() }
      });

      if (error) throw error;

      setAnalysis(data.analysis);
      toast({
        title: "Análisis completado",
        description: "El análisis se ha generado exitosamente",
      });
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Error al generar el análisis. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Elliott - Análisis de Acciones con IA</title>
        <meta name="description" content="Análisis inteligente de acciones con IA para decisiones de inversión informadas" />
        <link rel="canonical" href="/" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-12 max-w-4xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-4">
              <TrendingUp className="h-8 w-8 text-primary" />
              <h1 className="text-4xl font-bold text-foreground">Elliott</h1>
            </div>
            <p className="text-xl text-muted-foreground">
              Análisis inteligente de acciones con IA
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Analysis Form */}
            <Card className="clean-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Nuevo Análisis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAnalysis} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="stock">Símbolo de la Acción</Label>
                    <Input
                      id="stock"
                      type="text"
                      placeholder="ej. TSLA, AAPL, AMZN"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      className="text-base"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="question">Tu Pregunta</Label>
                    <Textarea
                      id="question"
                      placeholder="ej. ¿Cuáles son los riesgos en el próximo trimestre?"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      className="min-h-[100px] text-base"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analizando...
                      </>
                    ) : (
                      'Analizar'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Analysis Results */}
            <Card className="clean-card">
              <CardHeader>
                <CardTitle>Análisis</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : analysis ? (
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground bg-muted/50 p-4 rounded-lg">
                      {analysis}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Completa el formulario para generar un análisis</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </>
  );
}
