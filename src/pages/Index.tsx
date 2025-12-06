import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, TrendingUp, Zap, Bot, ChevronDown, Mail, ArrowRight } from "lucide-react";
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
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const { toast } = useToast();

  const joinWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail || !waitlistEmail.includes('@')) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setWaitlistLoading(true);
    try {
      const { error } = await supabase
        .from('waitlist')
        .insert({ email: waitlistEmail });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "Already registered",
            description: "This email is already on the waitlist",
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: "You're on the list!",
          description: "We'll notify you when GOX launches",
        });
        setWaitlistEmail("");
      }
    } catch (error) {
      console.error('Waitlist error:', error);
      toast({
        title: "Error",
        description: "Failed to join waitlist. Please try again.",
        variant: "destructive",
      });
    } finally {
      setWaitlistLoading(false);
    }
  };

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

      // Handle edge function errors (including 404)
      if (error) {
        // Try to parse error context for suggestions
        const errorContext = (error as any)?.context;
        if (errorContext?.suggestions) {
          toast({
            title: `Symbol "${symbol}" not found`,
            description: errorContext.suggestions[0],
            variant: "destructive",
          });
          setAnalysis(prev => prev ? { ...prev, loading: false } : null);
          return;
        }
        throw error;
      }

      // Handle non-success responses in data
      if (data && !data.success) {
        if (data.suggestions && data.suggestions.length > 0) {
          toast({
            title: `Symbol "${data.symbol || symbol}" not found`,
            description: data.suggestions[0],
            variant: "destructive",
          });
          setAnalysis(prev => prev ? { ...prev, loading: false } : null);
          return;
        }
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
    } catch (error: any) {
      console.error('Error:', error);
      setAnalysis(prev => prev ? { ...prev, loading: false } : null);
      
      let errorMessage = 'Failed to generate analysis';
      
      // Try to extract meaningful error message
      if (error?.message) {
        if (error.message.includes('Rate limit')) {
          errorMessage = 'Rate limit reached. Please wait a moment.';
        } else if (error.message.includes('Payment required')) {
          errorMessage = 'Credits required. Please add funds.';
        } else if (error.message.includes('not found') || error.message.includes('No data')) {
          errorMessage = `Symbol "${symbol}" not found. Try with .MX suffix for Mexican stocks.`;
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
                {/* Reserved for future navigation */}
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
                GOX is an intelligent agent that identifies Elliott Wave structures, 
                validates counts, and execute trades autonomously.
              </p>

              {/* Waitlist Form */}
              <form onSubmit={joinWaitlist} className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
                <div className="flex-1 relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={waitlistEmail}
                    onChange={(e) => setWaitlistEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="pl-10 bg-card border-border"
                  />
                </div>
                <Button 
                  type="submit"
                  disabled={waitlistLoading}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {waitlistLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Join Waitlist
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>

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