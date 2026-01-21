import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, BarChart3 } from 'lucide-react';

interface ScanFormProps {
  onRunScan: (params: ScanParams) => Promise<void>;
  isScanning: boolean;
}

export interface ScanParams {
  symbols: string[];
  topN: number;
  include_fundamentals: boolean;
  include_structure_score: boolean;
}

const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'WMT'];

export function ScanForm({ onRunScan, isScanning }: ScanFormProps) {
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_SYMBOLS);
  const [newSymbol, setNewSymbol] = useState('');
  const [topN, setTopN] = useState(10);
  const [includeFundamentals, setIncludeFundamentals] = useState(true);
  const [includeStructureScore, setIncludeStructureScore] = useState(true);

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

  const handleSubmit = async () => {
    if (symbols.length === 0) return;
    
    await onRunScan({
      symbols,
      topN,
      include_fundamentals: includeFundamentals,
      include_structure_score: includeStructureScore
    });
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Universe Scanner
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Symbol Input */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Symbols ({symbols.length})</Label>
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
          
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
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
        </div>

        {/* Top N */}
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Top N for analysis</Label>
          <Input
            type="number"
            value={topN}
            onChange={(e) => setTopN(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
            className="h-8 w-16 text-sm text-center"
            min={1}
            max={50}
          />
        </div>

        {/* Toggles */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Include Fundamentals</Label>
            <Switch
              checked={includeFundamentals}
              onCheckedChange={setIncludeFundamentals}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Structure Scoring</Label>
            <Switch
              checked={includeStructureScore}
              onCheckedChange={setIncludeStructureScore}
            />
          </div>
        </div>

        {/* Run Button */}
        <Button 
          onClick={handleSubmit} 
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
      </CardContent>
    </Card>
  );
}
