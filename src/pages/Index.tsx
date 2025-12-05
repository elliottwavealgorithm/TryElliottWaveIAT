import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, TrendingUp, Zap, Bot, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TradingViewWidget } from "@/components/widgets/TradingViewWidget";
import { TimeframeSelector } from "@/components/elliott/TimeframeSelector";
import { WaveCountDisplay } from "@/components/elliott/WaveCountDisplay";
import { AnalysisChat } from "@/components/elliott/AnalysisChat";
import goxLogo from "@/assets/gox-logo.png";

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
        description: "Please enter a symbol",
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
        throw new Error(data.error || 'Analysis failed');
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
        title: "Analysis Complete",
        description: `${data.symbol} analyzed with ${data.pivots?.length || 0} pivots detected`,
      });
    } catch (error) {
      console.error('Error:', error);
      setAnalysis(prev => prev ? { ...prev, loading: false } : null);
      
      let errorMessage = 'Failed to generate analysis';
      if (error instanceof Error) {
        if (error.message.includes('Rate limit')) {
          errorMessage = 'Rate limit reached. Please wait a moment.';
        } else if (error.message.includes('Payment required')) {
          errorMessage = 'Credits required. Please add funds.';
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

  const handleAnalysisUpdate = (newAnalysis: any) => {
    if (analysis) {
      setAnalysis({ ...analysis, analysis: newAnalysis });
    }
  };

  const scrollToChart = () => {
    document.getElementById('chart-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <Helmet>
        <title>GOX – AI-Powered Elliott Wave Analysis</title>
        <meta name="description" content="GOX is an intelligent agent that analyzes Elliott Wave patterns and will execute trades autonomously." />
        <link rel="canonical" href="/" />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img src={goxLogo} alt="GOX" className="h-8 w-auto invert" />
              </div>
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-xs font-mono border-primary/30 text-primary/80">
                  v0.1 alpha
                </Badge>
                <Badge className="bg-success/20 text-success border-success/30 text-xs">
                  <span className="w-1.5 h-1.5 bg-success rounded-full mr-1.5 animate-pulse-glow" />
                  Agent Online
                </Badge>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative py-20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-glow opacity-50" />
          <div className="container mx-auto px-6 relative">
            <div className="max-w-4xl mx-auto text-center space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card/50 backdrop-blur-sm">
                <Bot className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">AI Trading Agent • Elliott Wave Theory</span>
              </div>
              
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight gox-glow">
                Autonomous<br />
                <span className="text-muted-foreground">Wave Analysis</span>
              </h1>
              
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                GOX is an intelligent agent that identifies Elliott Wave patterns, 
                validates counts with Fibonacci ratios, and will execute trades autonomously.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
                  <Input
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="SYMBOL"
                    className="w-28 bg-transparent border-0 font-mono text-lg focus-visible:ring-0 px-0"
                  />
                  <div className="w-px h-8 bg-border" />
                  <TimeframeSelector 
                    selected={timeframe} 
                    onSelect={setTimeframe}
                    compact
                  />
                  <Button 
                    onClick={analyzeSymbol}
                    disabled={analysis?.loading}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {analysis?.loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        Analyze
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <button 
                onClick={scrollToChart}
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mt-8"
              >
                <span className="text-sm">View Chart</span>
                <ChevronDown className="h-4 w-4 animate-float" />
              </button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 border-t border-border/50">
          <div className="container mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <FeatureCard 
                icon={<TrendingUp className="h-5 w-5" />}
                title="Wave Detection"
                description="ZigZag algorithm identifies significant price pivots for accurate wave counts."
                status="Active"
              />
              <FeatureCard 
                icon={<Bot className="h-5 w-5" />}
                title="AI Analysis"
                description="LLM validates Elliott Wave rules and Fibonacci relationships."
                status="Active"
              />
              <FeatureCard 
                icon={<Zap className="h-5 w-5" />}
                title="Auto Trading"
                description="Execute trades based on wave count invalidations and targets."
                status="Coming Soon"
                disabled
              />
            </div>
          </div>
        </section>

        {/* Analysis Results */}
        {(analysis?.loading || analysis?.analysis) && (
          <section className="py-16 border-t border-border/50">
            <div className="container mx-auto px-6">
              <div className="max-w-6xl mx-auto">
                {analysis.loading ? (
                  <Card className="clean-card">
                    <CardContent className="py-16 text-center">
                      <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        Detecting pivots and analyzing wave structure...
                      </p>
                    </CardContent>
                  </Card>
                ) : analysis.analysis && (
                  <div className="grid lg:grid-cols-2 gap-6">
                    <WaveCountDisplay analysis={analysis.analysis} />
                    <AnalysisChat 
                      analysis={analysis.analysis}
                      symbol={analysis.symbol}
                      timeframe={analysis.timeframe}
                      onAnalysisUpdate={handleAnalysisUpdate}
                    />
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Full Width Chart Section */}
        <section id="chart-section" className="py-16 border-t border-border/50">
          <div className="px-4">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-semibold mb-2">Live Chart</h2>
              <p className="text-muted-foreground text-sm">
                {symbol} • Real-time data from TradingView
              </p>
            </div>
            <div className="max-w-[1800px] mx-auto">
              <div className="clean-card overflow-hidden">
                <TradingViewWidget 
                  symbol={symbol || "NFLX"} 
                  height={700}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 border-t border-border/50">
          <div className="container mx-auto px-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img src={goxLogo} alt="GOX" className="h-6 w-auto invert opacity-50" />
                <span className="text-sm text-muted-foreground">
                  AI Research Project
                </span>
              </div>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <span>Elliott Wave Theory + Machine Learning</span>
                <span>•</span>
                <span>2025</span>
              </div>
            </div>
          </div>
        </footer>

        {/* Admin Logs (Hidden) */}
        <details className="container mx-auto px-6 pb-8">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors p-4 bg-card/50 rounded-lg border border-border/50">
            Debug Logs (Admin)
          </summary>
          {analysis && (
            <Card className="clean-card mt-4">
              <CardContent className="p-4">
                <pre className="text-xs overflow-x-auto font-mono text-muted-foreground">
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
      </div>
    </>
  );
}

function FeatureCard({ 
  icon, 
  title, 
  description, 
  status, 
  disabled 
}: { 
  icon: React.ReactNode;
  title: string;
  description: string;
  status: string;
  disabled?: boolean;
}) {
  return (
    <div className={`clean-card p-6 space-y-4 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="p-2 rounded-lg bg-muted">
          {icon}
        </div>
        <Badge 
          variant="outline" 
          className={`text-xs ${disabled ? 'border-muted-foreground/30' : 'border-success/30 text-success'}`}
        >
          {status}
        </Badge>
      </div>
      <div>
        <h3 className="font-semibold mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}