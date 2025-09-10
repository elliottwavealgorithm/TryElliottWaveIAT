import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MarketExchange {
  code: string;
  name: string;
  country: string;
  flag: string;
  suffix: string;
}

interface TradingViewSymbol {
  symbol: string;
  name: string;
  sector: string;
  tradingViewSymbol: string;
  isValid: boolean;
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
  const [selectedExchange, setSelectedExchange] = useState<string>("");
  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [symbolSearchTerm, setSymbolSearchTerm] = useState("");
  const [availableSymbols, setAvailableSymbols] = useState<TradingViewSymbol[]>([]);
  const [isLoadingSymbols, setIsLoadingSymbols] = useState(false);
  const [isValidatingSymbol, setIsValidatingSymbol] = useState(false);
  const [symbolValidation, setSymbolValidation] = useState<{
    isValid: boolean;
    message: string;
    suggestions?: string[];
  } | null>(null);

  const filteredExchanges = EXCHANGES.filter(exchange =>
    exchange.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exchange.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exchange.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSymbols = availableSymbols.filter(symbol =>
    symbol.symbol.toLowerCase().includes(symbolSearchTerm.toLowerCase()) ||
    symbol.name.toLowerCase().includes(symbolSearchTerm.toLowerCase()) ||
    symbol.sector.toLowerCase().includes(symbolSearchTerm.toLowerCase())
  );

  // Cargar símbolos cuando se selecciona una bolsa
  useEffect(() => {
    if (selectedExchange) {
      loadSymbolsForExchange(selectedExchange);
    } else {
      setAvailableSymbols([]);
      setSelectedSymbol("");
    }
  }, [selectedExchange]);

  // Validar símbolo cuando se selecciona
  useEffect(() => {
    if (selectedSymbol && selectedExchange) {
      validateSymbol();
    } else {
      setSymbolValidation(null);
    }
  }, [selectedSymbol, selectedExchange]);

  const loadSymbolsForExchange = async (exchange: string) => {
    setIsLoadingSymbols(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-tradingview-symbols', {
        body: { exchange, search: symbolSearchTerm }
      });

      if (error) throw error;

      setAvailableSymbols(data.symbols || []);
    } catch (error) {
      console.error('Error loading symbols:', error);
      toast.error('Error al cargar símbolos disponibles');
      setAvailableSymbols([]);
    } finally {
      setIsLoadingSymbols(false);
    }
  };

  const validateSymbol = async () => {
    if (!selectedSymbol || !selectedExchange) return;

    setIsValidatingSymbol(true);
    try {
      const exchange = EXCHANGES.find(ex => ex.code === selectedExchange);
      if (!exchange) return;

      const fullSymbol = selectedSymbol + exchange.suffix;
      
      const { data, error } = await supabase.functions.invoke('validate-symbol', {
        body: { symbol: fullSymbol }
      });

      if (error) throw error;

      setSymbolValidation(data);
    } catch (error) {
      console.error('Error validating symbol:', error);
      setSymbolValidation({
        isValid: false,
        message: 'Error al validar el símbolo'
      });
    } finally {
      setIsValidatingSymbol(false);
    }
  };

  const handleAdd = () => {
    if (!selectedSymbol || !selectedExchange || !symbolValidation?.isValid) return;
    
    const exchange = EXCHANGES.find(ex => ex.code === selectedExchange);
    if (!exchange) return;

    const selectedSymbolData = availableSymbols.find(s => s.symbol === selectedSymbol);
    const fullSymbol = selectedSymbol + exchange.suffix;
    
    onAddInstrument(fullSymbol, exchange.name);
    
    toast.success(`${selectedSymbolData?.name || selectedSymbol} agregado al análisis`);
    
    // Limpiar selección
    setSelectedSymbol("");
    setSelectedExchange("");
    setSymbolValidation(null);
  };

  const selectedExchangeData = EXCHANGES.find(ex => ex.code === selectedExchange);
  const selectedSymbolData = availableSymbols.find(s => s.symbol === selectedSymbol);

  return (
    <Card className="clean-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Selector de Instrumentos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Paso 1: Seleccionar Bolsa */}
        <div className="space-y-2">
          <label className="text-sm font-medium">1. Selecciona la Bolsa</label>
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
              <SelectContent className="max-h-[200px]">
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

        {/* Paso 2: Seleccionar Instrumento */}
        {selectedExchange && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              2. Selecciona el Instrumento
              {isLoadingSymbols && <Loader2 className="inline h-4 w-4 ml-2 animate-spin" />}
            </label>
            <div className="space-y-2">
              <Input
                placeholder="Buscar instrumento..."
                value={symbolSearchTerm}
                onChange={(e) => {
                  setSymbolSearchTerm(e.target.value);
                  if (selectedExchange) {
                    loadSymbolsForExchange(selectedExchange);
                  }
                }}
                className="text-sm"
              />
              <Select value={selectedSymbol} onValueChange={setSelectedSymbol} disabled={isLoadingSymbols}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingSymbols ? "Cargando..." : "Selecciona un instrumento"} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {filteredSymbols.map((symbol) => (
                    <SelectItem key={symbol.symbol} value={symbol.symbol}>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{symbol.symbol}</span>
                          <Badge variant="outline" className="text-xs">{symbol.sector}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {symbol.name}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                  {filteredSymbols.length === 0 && !isLoadingSymbols && (
                    <SelectItem value="" disabled>
                      No se encontraron instrumentos
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Validación y Preview */}
        {selectedExchangeData && selectedSymbol && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span>{selectedExchangeData.flag}</span>
              <Badge variant="outline">{selectedExchangeData.code}</Badge>
              {isValidatingSymbol && <Loader2 className="h-4 w-4 animate-spin" />}
              {symbolValidation && (
                symbolValidation.isValid ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )
              )}
            </div>
            
            {selectedSymbolData && (
              <div className="space-y-1">
                <p className="text-sm font-medium">{selectedSymbolData.name}</p>
                <p className="text-xs text-muted-foreground">Sector: {selectedSymbolData.sector}</p>
              </div>
            )}
            
            <p className="text-sm font-medium mt-2">
              Símbolo TradingView: <code className="bg-background px-1 rounded">{selectedSymbol}{selectedExchangeData.suffix}</code>
            </p>
            
            {symbolValidation && (
              <div className={`text-sm mt-2 ${symbolValidation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                {symbolValidation.message}
                {symbolValidation.suggestions && symbolValidation.suggestions.length > 0 && (
                  <div className="mt-1">
                    <span className="text-muted-foreground">Sugerencias: </span>
                    {symbolValidation.suggestions.join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <Button 
          onClick={handleAdd}
          disabled={!selectedSymbol || !selectedExchange || !symbolValidation?.isValid || isValidatingSymbol}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          {isValidatingSymbol ? 'Validando...' : 'Agregar Instrumento'}
        </Button>
      </CardContent>
    </Card>
  );
}