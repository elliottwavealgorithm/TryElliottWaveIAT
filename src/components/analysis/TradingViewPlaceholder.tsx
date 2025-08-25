import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, BarChart3, Zap, CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export function TradingViewPlaceholder() {
  const { t } = useTranslation();

  const features = t('analysis.chartPlaceholder.features', { returnObjects: true }) as string[];

  return (
    <Card className="border border-border h-[600px] relative overflow-hidden">
      {/* TradingView Widget Mockup */}
      <div className="absolute inset-0 bg-white">
        {/* Top Toolbar */}
        <div className="h-12 bg-gray-50 border-b border-gray-200 flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <select className="text-sm border-none bg-transparent font-semibold">
              <option>AAPL</option>
            </select>
            <span className="text-lg font-bold text-green-600">$185.42</span>
            <span className="text-sm text-green-600">+2.15 (+1.17%)</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 text-xs bg-blue-500 text-white rounded">1D</button>
            <button className="px-3 py-1 text-xs text-gray-600 rounded">1W</button>
            <button className="px-3 py-1 text-xs text-gray-600 rounded">1M</button>
          </div>
        </div>
        
        {/* Chart Area */}
        <div className="h-[calc(100%-3rem)] relative bg-white">
          {/* Grid Background */}
          <svg className="absolute inset-0 w-full h-full">
            <defs>
              <pattern id="grid" width="40" height="30" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 30" fill="none" stroke="#f0f0f0" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
          
          {/* Price Line Chart */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 400">
            <polyline
              fill="none"
              stroke="#2196F3"
              strokeWidth="2"
              points="50,300 120,280 190,250 260,220 330,200 400,180 470,160 540,140 610,120 680,100 750,90"
            />
            {/* Elliott Wave Labels */}
            <circle cx="120" cy="280" r="3" fill="#FF5722" />
            <text x="125" y="275" fontSize="12" fill="#FF5722" fontWeight="bold">1</text>
            
            <circle cx="260" cy="220" r="3" fill="#FF5722" />
            <text x="265" y="215" fontSize="12" fill="#FF5722" fontWeight="bold">2</text>
            
            <circle cx="470" cy="160" r="3" fill="#FF5722" />
            <text x="475" y="155" fontSize="12" fill="#FF5722" fontWeight="bold">3</text>
            
            <circle cx="610" cy="120" r="3" fill="#FF5722" />
            <text x="615" y="115" fontSize="12" fill="#FF5722" fontWeight="bold">4</text>
            
            <circle cx="750" cy="90" r="3" fill="#FF5722" />
            <text x="755" y="85" fontSize="12" fill="#FF5722" fontWeight="bold">5</text>
            
            {/* AI Prediction Line */}
            <polyline
              fill="none"
              stroke="#9C27B0"
              strokeWidth="2"
              strokeDasharray="5,5"
              points="750,90 780,80 810,85"
            />
            <text x="780" y="75" fontSize="10" fill="#9C27B0" fontWeight="bold">AI Prediction</text>
          </svg>
          
          {/* Volume Chart at Bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gray-50 border-t">
            <div className="flex items-end h-full px-4 gap-1">
              {Array.from({length: 20}).map((_, i) => (
                <div 
                  key={i} 
                  className="bg-blue-200 flex-1 rounded-t" 
                  style={{height: `${Math.random() * 80 + 20}%`}}
                />
              ))}
            </div>
          </div>
        </div>
        
        {/* Bottom Info Panel */}
        <div className="absolute bottom-20 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 border shadow-lg max-w-xs">
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">O</span>
              <span className="font-medium">$183.12</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">H</span>
              <span className="font-medium">$186.91</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">L</span>
              <span className="font-medium">$182.45</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">C</span>
              <span className="font-medium text-green-600">$185.42</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Overlay Message */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-white rounded-lg p-6 max-w-md text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <TrendingUp className="h-8 w-8 text-primary" />
            <BarChart3 className="h-8 w-8 text-secondary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Widget de TradingView</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Aquí se integrará el widget avanzado de TradingView con análisis Elliott Wave y predicciones AI en tiempo real.
          </p>
          <div className="flex justify-center gap-2">
            <Badge variant="outline" className="border-primary text-primary">
              Elliott Wave
            </Badge>
            <Badge variant="outline" className="border-secondary text-secondary">
              AI Analysis
            </Badge>
          </div>
        </div>
      </div>
    </Card>
  );
}