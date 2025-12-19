import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI } from "npm:@google/genai@1.30.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not configured");
      return new Response(JSON.stringify({ error: "Gemini API key is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min
    // Allow creating new Live sessions for the full token lifetime (otherwise default is ~1 minute).
    const newSessionExpireTime = expireTime;

    // Create an ephemeral token so the browser never sees the long-lived key.
    const client = new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
      httpOptions: { apiVersion: "v1alpha" },
    });

    const token = await client.authTokens.create({
      config: {
        uses: 100, // Allow many reconnection attempts
        expireTime,
        newSessionExpireTime,
        // Don't lock to specific model - allow flexibility
      },
    });

    if (!token?.name) {
      console.error("Failed to create ephemeral token", token);
      return new Response(JSON.stringify({ error: "Failed to create ephemeral token" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Created Gemini ephemeral token");

    return new Response(JSON.stringify({ token: token.name }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error creating ephemeral token:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
