import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, activeRecipe } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'No image provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build system prompt with recipe awareness for timer detection
    let systemPrompt = `You are a cooking vision assistant. Analyze the kitchen scene and respond with a JSON object.

Your response MUST be valid JSON with this structure:
{
  "description": "Brief description of what you see (max 15 words)",
  "timerSuggestion": null or { "label": "item name", "durationSeconds": number, "reason": "why" }
}

TIMER DETECTION - PROACTIVE MODE:
If you see ANY cooking event, you MUST suggest a timer. Do not be shy.
- Food being added to water/pan/oven -> START TIMER
- Food changing color/texture -> START TIMER
- "Checking" food -> START TIMER (if not timed yet)

REQUIRED: "reason": "Short, punchy explanation for the user, e.g. 'Saw pasta hit water' or 'Meat is searing'"

DO NOT suggest if:
- Empty pans heating up`;

    // Add recipe context for accurate timing
    if (activeRecipe) {
      systemPrompt += `

ACTIVE RECIPE: "${activeRecipe.title}"

RECIPE INGREDIENTS:
${activeRecipe.ingredients?.join('\n') || 'Not specified'}

RECIPE INSTRUCTIONS:
${activeRecipe.instructions?.map((inst: string, i: number) => `${i + 1}. ${inst}`).join('\n') || 'Not specified'}

IMPORTANT: When suggesting timer durations, USE THE RECIPE'S TIMING if mentioned in ingredients or instructions. 
For example:
- If recipe says "boil pasta for 10 minutes" and you see pasta entering water → timer for 600 seconds
- If recipe says "sauté onions until golden (about 5 min)" and you see onions hitting pan → timer for 300 seconds
- If no specific timing in recipe, use common cooking knowledge`;
    } else {
      systemPrompt += `

No active recipe. Use common cooking knowledge for timer durations:
- Pasta: 8-12 minutes depending on type
- Rice: 15-20 minutes
- Boiled eggs: soft 6-7 min, hard 10-12 min
- Sautéed vegetables: 5-8 minutes
- Pan-seared meat: depends on thickness`;
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              },
              {
                type: 'text',
                text: 'Analyze this cooking scene. Return JSON with description and timerSuggestion (if a cooking event that needs timing is detected).'
              }
            ]
          }
        ],
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again later' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Vision analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';

    console.log('Vision AI response:', content);

    // Parse JSON response
    let result = { description: 'Unable to analyze scene', timerSuggestion: null };
    try {
      // Try to extract JSON from the response (might be wrapped in markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse vision response as JSON:', parseError);
      // Fallback to using raw content as description
      result.description = content.substring(0, 100);
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-vision:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
