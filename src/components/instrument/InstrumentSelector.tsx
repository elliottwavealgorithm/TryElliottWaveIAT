import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus } from "lucide-react";

interface MarketExchange {
  code: string;
  name: string;
  country: string;
  flag: string;
  suffix: string;
}

const EXCHANGES: MarketExchange[] = [
  { code: "NASDAQ", name: "NASDAQ", country: "Estados Unidos", flag: "🇺🇸", suffix: "" },
  { code: "NYSE", name: "New York Stock Exchange", country: "Estados Unidos", flag: "🇺🇸", suffix: "" },
  { code: "BMV", name: "Bolsa Mexicana de Valores", country: "México", flag: "🇲🇽", suffix: ".MX" },
  { code: "LSE", name: "London Stock Exchange", country: "Reino Unido", flag: "🇬🇧", suffix: ".L" },
  { code: "TSE", name: "Tokyo Stock Exchange", country: "Japón", flag: "🇯🇵", suffix: ".T" },
  { code: "SSE", name: "Shanghai Stock Exchange", country: "China", flag: "🇨🇳", suffix: ".SS" },
  { code: "FRA", name: "Frankfurt Stock Exchange", country: "Alemania", flag: "🇩🇪", suffix: ".F" },
];

interface InstrumentSelectorProps {
  onAddInstrument: (symbol: string, exchange: string) => void;
}

export function InstrumentSelector({ onAddInstrument }: InstrumentSelectorProps) {
  const [symbol, setSymbol] = useState("");
  const [selectedExchange, setSelectedExchange] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredExchanges = EXCHANGES.filter(exchange =>
    exchange.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exchange.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exchange.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = () => {
    if (!symbol.trim() || !selectedExchange) return;
    
    const exchange = EXCHANGES.find(ex => ex.code === selectedExchange);
    if (!exchange) return;

    const fullSymbol = symbol.trim().toUpperCase() + exchange.suffix;
    onAddInstrument(fullSymbol, exchange.name);
    setSymbol("");
    setSelectedExchange("");
  };

  const selectedExchangeData = EXCHANGES.find(ex => ex.code === selectedExchange);

  return (
    <Card className="clean-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Selector de Instrumentos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Símbolo</label>
          <Input
            placeholder="Ej. TSLA, AAPL, WALMEX"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="text-base"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Bolsa/Exchange</label>
          <div className="space-y-2">
            <Input
              placeholder="Buscar bolsa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-sm"
            />
            <Select value={selectedExchange} onValueChange={setSelectedExchange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una bolsa" />
              </SelectTrigger>
              <SelectContent>
                {filteredExchanges.map((exchange) => (
                  <SelectItem key={exchange.code} value={exchange.code}>
                    <div className="flex items-center gap-2">
                      <span>{exchange.flag}</span>
                      <div className="flex flex-col">
                        <span className="font-medium">{exchange.code}</span>
                        <span className="text-xs text-muted-foreground">{exchange.country}</span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedExchangeData && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <span>{selectedExchangeData.flag}</span>
              <Badge variant="outline">{selectedExchangeData.code}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{selectedExchangeData.name}</p>
            {symbol && (
              <p className="text-sm font-medium mt-2">
                Símbolo completo: <code className="bg-background px-1 rounded">{symbol.toUpperCase()}{selectedExchangeData.suffix}</code>
              </p>
            )}
          </div>
        )}

        <Button 
          onClick={handleAdd}
          disabled={!symbol.trim() || !selectedExchange}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Agregar Instrumento
        </Button>
      </CardContent>
    </Card>
  );
}