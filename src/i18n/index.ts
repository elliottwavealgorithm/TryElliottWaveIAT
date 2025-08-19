import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Translation resources
const resources = {
  en: {
    translation: {
      // Navigation
      navigation: {
        dashboard: "Dashboard",
        analysis: "Analysis Workspace",
        training: "Training",
        pricing: "Pricing",
        upgrade: "Upgrade"
      },
      // Dashboard
      dashboard: {
        title: "Elliott Wave AI Analysis",
        subtitle: "Combines analyst expertise with machine learning to generate automatic wave counts and predictions",
        metrics: {
          modelAccuracy: "Model Accuracy",
          activeAnalyses: "Active Analyses", 
          watchlistSymbols: "Watchlist Symbols",
          new: "new"
        },
        predictions: {
          waveInProgress: "Wave 3 in progress",
          abcCorrection: "ABC correction scenario",
          impulseWave5: "Impulse Wave 5 potential",
          target: "Target",
          confidence: "Confidence",
          high: "High",
          medium: "Medium"
        }
      },
      // Analysis
      analysis: {
        title: "Analysis Workspace – TryElliottWave",
        description: "Advanced charting workspace with Elliott Wave tools and AI predictions",
        chartPlaceholder: {
          title: "TradingView Advanced Charts Integration",
          subtitle: "Professional Elliott Wave Analysis Platform",
          description: "This is where TradingView's Advanced Charts Library will be integrated, providing:",
          features: [
            "Professional Elliott Wave drawing tools",
            "Fibonacci retracements and extensions with custom ratios",
            "Wave degree labeling and validation system",
            "Real-time invalidation/validation points",
            "Multi-timeframe wave analysis",
            "Export capabilities for wave counts"
          ],
          note: "Awaiting TradingView Advanced Charts Library approval for enhanced Elliott Wave functionality",
          aiGuide: "AI Elliott Wave Assistant will guide users through proper wave counting methodology"
        },
        toolbar: {
          elliottTools: "Elliott Tools",
          aiPredictions: "AI Predictions"
        },
        aiPanel: {
          title: "AI Elliott Wave Analysis",
          confidence: "Model Confidence",
          waveCount: "Wave Count Suggestions",
          primary: "Primary: Impulse Wave 3 in progress",
          alternate: "Alternate: ABC correction expected", 
          priceTargets: "Price Targets",
          riskLevels: "Risk Levels",
          moderate: "Moderate",
          invalidationPoint: "Invalidation Point"
        },
        controls: {
          title: "Controls",
          symbolSelector: "Symbol selector",
          timeframeControls: "Timeframe controls", 
          elliottWaveTools: "Elliott Wave tools",
          validationExport: "Validation & export"
        }
      },
      // Training
      training: {
        title: "Elliott Wave Training Center",
        description: "Master Elliott Wave analysis with interactive lessons and AI guidance"
      },
      // Pricing
      pricing: {
        title: "Choose Your Plan",
        description: "Select the perfect plan for your Elliott Wave analysis needs"
      }
    }
  },
  es: {
    translation: {
      // Navigation
      navigation: {
        dashboard: "Dashboard",
        analysis: "Workspace de Análisis", 
        training: "Entrenamiento",
        pricing: "Precios",
        upgrade: "Mejorar"
      },
      // Dashboard
      dashboard: {
        title: "Análisis con IA de Ondas Elliott",
        subtitle: "Combina la experiencia de analistas con machine learning para generar conteos y predicciones automáticas",
        metrics: {
          modelAccuracy: "Precisión del Modelo",
          activeAnalyses: "Análisis Activos",
          watchlistSymbols: "Símbolos en Watchlist", 
          new: "nuevos"
        },
        predictions: {
          waveInProgress: "Wave 3 en progreso",
          abcCorrection: "Escenario de corrección ABC",
          impulseWave5: "Impulse Wave 5 potencial",
          target: "Objetivo",
          confidence: "Confianza",
          high: "Alta",
          medium: "Media"
        }
      },
      // Analysis
      analysis: {
        title: "Workspace de Análisis – TryElliottWave",
        description: "Workspace con gráficos avanzados, herramientas de ondas Elliott y predicciones de IA",
        chartPlaceholder: {
          title: "Integración TradingView Advanced Charts",
          subtitle: "Plataforma Profesional de Análisis Elliott Wave",
          description: "Aquí se integrará la librería Advanced Charts de TradingView, proporcionando:",
          features: [
            "Herramientas profesionales de dibujo Elliott Wave",
            "Retrocesos y extensiones Fibonacci con ratios personalizados",
            "Sistema de etiquetado y validación de grados de onda",
            "Puntos de invalidación/validación en tiempo real", 
            "Análisis de ondas multi-timeframe",
            "Capacidades de exportación para conteos de ondas"
          ],
          note: "Esperando aprobación de TradingView Advanced Charts Library para funcionalidad Elliott Wave mejorada",
          aiGuide: "El Asistente IA Elliott Wave guiará a los usuarios a través de la metodología correcta de conteo de ondas"
        },
        toolbar: {
          elliottTools: "Herramientas Elliott",
          aiPredictions: "Predicciones IA"
        },
        aiPanel: {
          title: "Análisis IA de Ondas Elliott",
          confidence: "Confianza del Modelo",
          waveCount: "Sugerencias de Conteo de Ondas",
          primary: "Primario: Impulse Wave 3 en progreso",
          alternate: "Alterno: Corrección ABC esperada",
          priceTargets: "Objetivos de Precio", 
          riskLevels: "Niveles de Riesgo",
          moderate: "Moderado",
          invalidationPoint: "Punto de Invalidación"
        },
        controls: {
          title: "Controles",
          symbolSelector: "Selector de símbolo",
          timeframeControls: "Controles de timeframe",
          elliottWaveTools: "Herramientas Elliott Wave",
          validationExport: "Validación y exportación"
        }
      },
      // Training
      training: {
        title: "Centro de Entrenamiento Elliott Wave",
        description: "Domina el análisis Elliott Wave con lecciones interactivas y guía de IA"
      },
      // Pricing
      pricing: {
        title: "Elige Tu Plan",
        description: "Selecciona el plan perfecto para tus necesidades de análisis Elliott Wave"
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'es', // Default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;