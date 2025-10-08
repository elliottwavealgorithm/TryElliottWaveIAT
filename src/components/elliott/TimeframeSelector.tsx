import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const timeframes = [
  { value: "15m", label: "15m" },
  { value: "1h", label: "1H" },
  { value: "4h", label: "4H" },
  { value: "1d", label: "1D" },
  { value: "1wk", label: "1W" },
];

interface TimeframeSelectorProps {
  selected: string;
  onSelect: (timeframe: string) => void;
}

export function TimeframeSelector({ selected, onSelect }: TimeframeSelectorProps) {
  return (
    <Card className="clean-card">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Temporalidad</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-2">
          {timeframes.map((tf) => (
            <Button
              key={tf.value}
              variant={selected === tf.value ? "default" : "outline"}
              size="sm"
              onClick={() => onSelect(tf.value)}
              className="text-xs"
            >
              {tf.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
