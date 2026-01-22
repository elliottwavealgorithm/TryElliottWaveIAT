import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Circle } from "lucide-react";

export type LLMStatusState = 'ok' | 'degraded' | 'rate_limited';

interface LLMStatusIndicatorProps {
  status: LLMStatusState;
  lastSuccessfulCall?: Date | null;
  retryAfterSeconds?: number;
}

export function LLMStatusIndicator({ 
  status, 
  lastSuccessfulCall, 
  retryAfterSeconds 
}: LLMStatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'ok':
        return {
          color: 'text-emerald-500',
          bgColor: 'bg-emerald-500/20',
          label: 'LLM OK',
          description: 'AI analysis available'
        };
      case 'degraded':
        return {
          color: 'text-amber-500',
          bgColor: 'bg-amber-500/20',
          label: 'Degraded',
          description: 'AI may be slow or partially available'
        };
      case 'rate_limited':
        return {
          color: 'text-red-500',
          bgColor: 'bg-red-500/20',
          label: 'Rate Limited',
          description: retryAfterSeconds 
            ? `Retry in ${retryAfterSeconds}s` 
            : 'AI temporarily unavailable'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`text-xs gap-1.5 cursor-help ${config.bgColor} border-transparent`}
          >
            <Circle className={`h-2 w-2 fill-current ${config.color}`} />
            <span className={config.color}>{config.label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <p>{config.description}</p>
            {lastSuccessfulCall && (
              <p className="text-muted-foreground">
                Last success: {lastSuccessfulCall.toLocaleTimeString()}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
