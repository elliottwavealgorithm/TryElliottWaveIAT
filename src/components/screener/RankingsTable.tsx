import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowUpDown, TrendingUp, TrendingDown, Loader2, Zap } from 'lucide-react';
import { SymbolMetrics } from '@/types/analysis';

interface RankingsTableProps {
  rankings: SymbolMetrics[];
  selectedSymbol?: string;
  onSymbolSelect: (symbol: string) => void;
  onRunDeepAnalysis: (symbols: string[]) => void;
  isRunningDeep: boolean;
  topSymbols: string[];
}

type SortField = 'final_score' | 'structure_score' | 'pre_filter_score' | 'fundamentals_score' | 'last_price';

export function RankingsTable({
  rankings,
  selectedSymbol,
  onSymbolSelect,
  onRunDeepAnalysis,
  isRunningDeep,
  topSymbols
}: RankingsTableProps) {
  const [sortField, setSortField] = useState<SortField>('final_score');
  const [sortAsc, setSortAsc] = useState(false);

  const sortedRankings = useMemo(() => {
    return [...rankings].sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      return sortAsc ? aVal - bVal : bVal - aVal;
    });
  }, [rankings, sortField, sortAsc]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getRegimeBadge = (regime: string) => {
    switch (regime) {
      case 'trending':
        return <Badge variant="outline" className="text-green-400 border-green-500/30 text-xs px-1.5"><TrendingUp className="h-3 w-3" /></Badge>;
      case 'ranging':
        return <Badge variant="outline" className="text-yellow-400 border-yellow-500/30 text-xs px-1.5"><TrendingDown className="h-3 w-3" /></Badge>;
      default:
        return null;
    }
  };

  if (rankings.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8 text-center text-muted-foreground">
          Run a scan to see rankings
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Rankings ({rankings.length})
          </CardTitle>
          <Button
            size="sm"
            variant="default"
            onClick={() => onRunDeepAnalysis(topSymbols)}
            disabled={isRunningDeep || topSymbols.length === 0}
          >
            {isRunningDeep ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Deep Analysis ({topSymbols.length})
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('final_score')}>
                  <div className="flex items-center gap-1">
                    Final <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('structure_score')}>
                  <div className="flex items-center gap-1">
                    Struct <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('fundamentals_score')}>
                  <div className="flex items-center gap-1">
                    Fund <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead>Regime</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('last_price')}>
                  <div className="flex items-center gap-1">
                    Price <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRankings.map((item, idx) => (
                <TableRow
                  key={item.symbol}
                  className={`cursor-pointer transition-colors ${
                    selectedSymbol === item.symbol 
                      ? 'bg-primary/10' 
                      : 'hover:bg-muted/50'
                  } ${item.error ? 'opacity-50' : ''}`}
                  onClick={() => !item.error && onSymbolSelect(item.symbol)}
                >
                  <TableCell className="text-muted-foreground text-xs">
                    {idx + 1}
                    {topSymbols.includes(item.symbol) && (
                      <Badge variant="outline" className="ml-1 text-xs px-1 py-0 border-primary/50 text-primary">
                        TOP
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div>
                      {item.symbol}
                      {item.shortName && (
                        <span className="text-xs text-muted-foreground ml-1 truncate max-w-[80px] inline-block align-bottom">
                          {item.shortName}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className={`font-bold ${getScoreColor(item.final_score ?? item.pre_filter_score)}`}>
                    {(item.final_score ?? item.pre_filter_score).toFixed(0)}
                  </TableCell>
                  <TableCell className={item.structure_score ? getScoreColor(item.structure_score) : 'text-muted-foreground'}>
                    {item.structure_score?.toFixed(0) ?? '-'}
                  </TableCell>
                  <TableCell className={item.fundamentals_score ? getScoreColor(item.fundamentals_score) : 'text-muted-foreground'}>
                    {item.fundamentals_score?.toFixed(0) ?? '-'}
                  </TableCell>
                  <TableCell>{getRegimeBadge(item.regime)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    ${item.last_price.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
