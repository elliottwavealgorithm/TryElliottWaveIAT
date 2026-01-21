import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pivot, WaveAdjustment } from '@/types/analysis';
import { Loader2 } from 'lucide-react';

interface WaveAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pivots: Pivot[];
  symbol: string;
  onConfirm: (adjustments: WaveAdjustment[]) => void;
  isLoading?: boolean;
}

const WAVE_LABELS = [
  { value: '', label: 'None' },
  { value: '1', label: 'Wave 1' },
  { value: '2', label: 'Wave 2' },
  { value: '3', label: 'Wave 3' },
  { value: '4', label: 'Wave 4' },
  { value: '5', label: 'Wave 5' },
  { value: 'A', label: 'Wave A' },
  { value: 'B', label: 'Wave B' },
  { value: 'C', label: 'Wave C' },
  { value: 'W', label: 'Wave W' },
  { value: 'X', label: 'Wave X' },
  { value: 'Y', label: 'Wave Y' },
];

export function WaveAdjustmentDialog({
  open,
  onOpenChange,
  pivots,
  symbol,
  onConfirm,
  isLoading = false,
}: WaveAdjustmentDialogProps) {
  const [assignments, setAssignments] = useState<Record<number, string>>({});

  const handleLabelChange = (pivotIndex: number, label: string) => {
    setAssignments(prev => {
      const next = { ...prev };
      if (label === '') {
        delete next[pivotIndex];
      } else {
        next[pivotIndex] = label;
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const adjustments: WaveAdjustment[] = Object.entries(assignments).map(([idx, label]) => {
      const pivot = pivots.find(p => p.index === parseInt(idx));
      return {
        wave_label: label,
        pivot_index: parseInt(idx),
        price: pivot?.price || 0,
        date: pivot?.date || '',
      };
    });
    onConfirm(adjustments);
  };

  const handleReset = () => {
    setAssignments({});
  };

  // Sort pivots by index for display
  const sortedPivots = [...pivots].sort((a, b) => a.index - b.index);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adjust Wave Count - {symbol}</DialogTitle>
          <DialogDescription>
            Assign wave labels to detected pivots. The analysis will respect your labels.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-2">
            {sortedPivots.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No pivots detected. Run analysis first.
              </p>
            ) : (
              sortedPivots.map((pivot) => (
                <div
                  key={pivot.index}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    <Badge 
                      variant={pivot.type === 'high' ? 'default' : 'secondary'}
                      className={pivot.type === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}
                    >
                      {pivot.type === 'high' ? 'H' : 'L'}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">${pivot.price.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{pivot.date}</p>
                    </div>
                    {pivot.scale && (
                      <Badge variant="outline" className="text-xs">
                        {pivot.scale}
                      </Badge>
                    )}
                  </div>
                  
                  <Select
                    value={assignments[pivot.index] || ''}
                    onValueChange={(value) => handleLabelChange(pivot.index, value)}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue placeholder="Label..." />
                    </SelectTrigger>
                    <SelectContent>
                      {WAVE_LABELS.map(wl => (
                        <SelectItem key={wl.value} value={wl.value}>
                          {wl.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="ghost" onClick={handleReset} disabled={isLoading}>
            Reset
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={Object.keys(assignments).length === 0 || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Re-analyzing...
                </>
              ) : (
                `Apply ${Object.keys(assignments).length} Adjustment${Object.keys(assignments).length !== 1 ? 's' : ''}`
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
