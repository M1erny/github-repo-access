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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { content, type } = await req.json();
    
    if (!content) {
      return new Response(
        JSON.stringify({ error: "No content provided" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Parsing recipe from ${type}...`);

    const systemPrompt = `You are a recipe parser. Extract recipe information from the provided content.
Return a JSON object with:
- title: The recipe name
- ingredients: Array of ingredient strings
- instructions: Array of step-by-step instruction strings
- servings: Number of servings (if mentioned)
- prepTime: Prep time (if mentioned)
- cookTime: Cook time (if mentioned)

Be thorough and extract all ingredients and steps. If the content is not a recipe, return an error message.`;

    const userPrompt = type === 'url' 
      ? `Parse this recipe from the following webpage content:\n\n${content}`
      : type === 'image'
      ? `Parse this recipe from the image. The image content/text is:\n\n${content}`
      : `Parse this recipe:\n\n${content}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_recipe",
              description: "Extract structured recipe data",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Recipe title" },
                  ingredients: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "List of ingredients with quantities"
                  },
                  instructions: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Step-by-step cooking instructions"
                  },
                  servings: { type: "string", description: "Number of servings" },
                  prepTime: { type: "string", description: "Preparation time" },
                  cookTime: { type: "string", description: "Cooking time" }
                },
                required: ["title", "ingredients", "instructions"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_recipe" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to parse recipe" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log("AI response received");
    
    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const recipe = JSON.parse(toolCall.function.arguments);
      console.log("Recipe parsed successfully:", recipe.title);
      return new Response(
        JSON.stringify({ recipe }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Could not extract recipe from content" }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error parsing recipe:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
