import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI, Modality } from "npm:@google/genai@1.30.0";

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
    const newSessionExpireTime = new Date(Date.now() + 60 * 1000).toISOString(); // 1 min

    // Create an ephemeral token so the browser never sees the long-lived key.
    const client = new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
      httpOptions: { apiVersion: "v1alpha" },
    });

    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        // Lock token to our Live connection config (more secure).
        liveConnectConstraints: {
          model: "gemini-2.5-flash-native-audio-preview-09-2025",
          config: {
            responseModalities: [Modality.AUDIO],
          },
        },
        httpOptions: { apiVersion: "v1alpha" },
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
