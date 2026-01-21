import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, TrendingUp, TrendingDown, BarChart3, Plus, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SymbolMetrics } from '@/types/analysis';
import { toast } from 'sonner';

interface ScreenerPanelProps {
  onSymbolSelect: (symbol: string) => void;
  selectedSymbol?: string;
}

const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'WMT'];

export function ScreenerPanel({ onSymbolSelect, selectedSymbol }: ScreenerPanelProps) {
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_SYMBOLS);
  const [newSymbol, setNewSymbol] = useState('');
  const [rankings, setRankings] = useState<SymbolMetrics[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);

  const addSymbol = () => {
    const symbol = newSymbol.toUpperCase().trim();
    if (symbol && !symbols.includes(symbol)) {
      setSymbols([...symbols, symbol]);
      setNewSymbol('');
    }
  };

  const removeSymbol = (symbol: string) => {
    setSymbols(symbols.filter(s => s !== symbol));
  };

  const runScan = async () => {
    if (symbols.length === 0) {
      toast.error('Add at least one symbol to scan');
      return;
    }

    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('scan-universe', {
        body: {
          symbols,
          base_timeframe: '1D',
          topN: 10,
          include_fundamentals: true
        }
      });

      if (error) throw error;

      setRankings(data.rankings);
      setLastScan(new Date().toLocaleTimeString());
      toast.success(`Scanned ${data.processed} symbols`);
    } catch (error) {
      console.error('Scan error:', error);
      toast.error('Failed to scan universe');
    } finally {
      setIsScanning(false);
    }
  };

  const getRegimeBadge = (regime: string) => {
    switch (regime) {
      case 'trending':
        return <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30">Trending</Badge>;
      case 'ranging':
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Ranging</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-4">
      {/* Symbol Input */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Search className="h-4 w-4" />
            Universe
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
              placeholder="Add symbol..."
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && addSymbol()}
            />
            <Button size="sm" variant="outline" onClick={addSymbol}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-1.5">
            {symbols.map(symbol => (
              <Badge
                key={symbol}
                variant="secondary"
                className="cursor-pointer hover:bg-destructive/20 text-xs"
                onClick={() => removeSymbol(symbol)}
              >
                {symbol} ×
              </Badge>
            ))}
          </div>

          <Button 
            onClick={runScan} 
            disabled={isScanning || symbols.length === 0}
            className="w-full"
            size="sm"
          >
            {isScanning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <BarChart3 className="mr-2 h-4 w-4" />
                Scan Universe
              </>
            )}
          </Button>
          
          {lastScan && (
            <p className="text-xs text-muted-foreground text-center">
              Last scan: {lastScan}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Rankings */}
      {rankings.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rankings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="space-y-1 p-3 pt-0">
                {rankings.map((item, idx) => (
                  <div
                    key={item.symbol}
                    onClick={() => !item.error && onSymbolSelect(item.symbol)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedSymbol === item.symbol 
                        ? 'bg-primary/10 border-primary/50' 
                        : 'bg-card/50 border-border/50 hover:bg-muted/50'
                    } ${item.error ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-5">#{idx + 1}</span>
                        <span className="font-medium">{item.symbol}</span>
                      </div>
                      <span className={`font-bold ${getScoreColor(item.pre_filter_score)}`}>
                        {item.pre_filter_score.toFixed(0)}
                      </span>
                    </div>
                    
                    {item.error ? (
                      <p className="text-xs text-destructive">{item.error}</p>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">
                            ${item.last_price.toFixed(2)}
                          </span>
                          {getRegimeBadge(item.regime)}
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Liq</span>
                            <span className="ml-1 font-medium">{item.liquidity_score.toFixed(0)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Vol</span>
                            <span className="ml-1 font-medium">{item.atr_pct.toFixed(1)}%</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Piv</span>
                            <span className="ml-1 font-medium">{item.pivot_cleanliness.toFixed(0)}</span>
                          </div>
                        </div>

                        {item.fundamentals?.sector && (
                          <p className="text-xs text-muted-foreground mt-2 truncate">
                            {item.fundamentals.sector}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
