import { Badge } from "@/components/ui/badge";
import { WaveLayer, DEGREE_ABBREV_MAP, WaveDegree } from "@/types/analysis";

interface DegreeLayerChipsProps {
  layers: WaveLayer[];
  activeLayerIds: Set<string>;
  onToggleLayer: (layerId: string) => void;
}

const DEGREE_COLORS: Record<WaveDegree, string> = {
  'Supercycle': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Cycle': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Primary': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Intermediate': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Minor': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'Minute': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
};

export function DegreeLayerChips({ layers, activeLayerIds, onToggleLayer }: DegreeLayerChipsProps) {
  if (layers.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground mr-1">Layers:</span>
      {layers.map((layer) => {
        const isActive = activeLayerIds.has(layer.layer_id);
        const abbrev = DEGREE_ABBREV_MAP[layer.degree] || layer.degree.charAt(0);
        const colorClass = DEGREE_COLORS[layer.degree] || 'bg-muted text-muted-foreground';
        
        return (
          <Badge
            key={layer.layer_id}
            variant="outline"
            className={`text-xs cursor-pointer transition-all ${
              isActive 
                ? colorClass 
                : 'bg-muted/30 text-muted-foreground/50 border-transparent'
            }`}
            onClick={() => onToggleLayer(layer.layer_id)}
            title={`${layer.degree} (${layer.timeframe}) - ${layer.status}`}
          >
            {abbrev}
            {layer.source === 'structure' && (
              <span className="ml-0.5 opacity-60">*</span>
            )}
          </Badge>
        );
      })}
    </div>
  );
}
