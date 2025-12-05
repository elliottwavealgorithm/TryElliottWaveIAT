import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are GOX Agent, an expert technical analyst specialized in:
- Extended Elliott Wave Theory
- Fibonacci proportions
- Advanced channeling
- Cage Theory (critical channels and confirmatory breakouts)
- Significant pivot identification
- Multi-timeframe fractal analysis
- Hard rules, soft rules, and wave personality validation
- Primary and alternate count generation

## YOUR ROLE IN THIS CONVERSATION

The user has received an Elliott Wave analysis. Your job is to:
1. Answer questions about the wave count
2. Explain the reasoning behind wave labels
3. Accept corrections from experienced analysts
4. Regenerate analysis when adjustments are requested

## HARD RULES (NON-NEGOTIABLE)

1. Wave 2 NEVER retraces 100% of wave 1
2. Wave 3 is NEVER the shortest impulse wave
3. Wave 4 NEVER invades wave 1 territory (except in diagonals)
4. Impulses are 5-3-5-3-5
5. Zigzags are 5-3-5
6. Flats are 3-3-5
7. Triangles are 3-3-3-3-3

## CAGE THEORY (CRITICAL VALIDATION)

🟦 Cage 1 — 2-4 Channel in impulses
- Line connecting end of wave 2 with end of wave 4
- Parallel from end of wave 3
- Bearish breakout confirms Wave 5 completion

🟩 Cage 2 — A-C-B Channel in corrections
- Determines if correction is zigzag, flat, or complex
- Confirms end of wave C

🟥 Cage 3 — Diagonal cages (wedges)
- Channel breakout confirms diagonal end

🟨 Cage 4 — Alternation cage
- Validates internal degrees 2 vs 4

## TRAINING MODE

When the user suggests corrections:
1. Accept the correction respectfully
2. Do NOT contradict unless it violates HARD RULES
3. Regenerate the complete count coherent with rules and their instruction
4. Explain why the adjustment makes sense

If a hard rule would be violated, politely explain why that specific adjustment isn't possible.

## RESPONSE FORMAT

For explanations: Be clear, logical, and educational.
For regenerated analysis: Return JSON with "UPDATED_ANALYSIS:" prefix followed by valid JSON.

Always respond in English.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const { symbol, timeframe, currentAnalysis, userMessage, conversationHistory } = await req.json();

    if (!userMessage) {
      throw new Error('Message is required');
    }

    console.log(`Chat for ${symbol} ${timeframe}: "${userMessage.substring(0, 50)}..."`);

    // Build messages array
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { 
        role: 'user', 
        content: `Current analysis for ${symbol} (${timeframe}):\n${JSON.stringify(currentAnalysis, null, 2)}`
      },
      { role: 'assistant', content: 'I have the analysis context. How can I help you refine or understand this wave count?' },
      ...conversationHistory.slice(-10), // Last 10 messages for context
      { role: 'user', content: userMessage }
    ];

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        temperature: 0.3,
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LLM API error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait and try again.');
      } else if (response.status === 402) {
        throw new Error('Payment required. Please add credits.');
      }
      throw new Error(`AI service error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';

    console.log('LLM response length:', content.length);

    // Check if the response contains an updated analysis
    let updatedAnalysis = null;
    if (content.includes('UPDATED_ANALYSIS:')) {
      const parts = content.split('UPDATED_ANALYSIS:');
      content = parts[0].trim();
      
      try {
        const jsonPart = parts[1].trim();
        const jsonStart = jsonPart.indexOf('{');
        const jsonEnd = jsonPart.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          updatedAnalysis = JSON.parse(jsonPart.slice(jsonStart, jsonEnd + 1));
          console.log('Updated analysis extracted');
        }
      } catch (e) {
        console.error('Failed to parse updated analysis:', e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        response: content || "I've processed your feedback.",
        updatedAnalysis
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in chat-with-analysis:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});