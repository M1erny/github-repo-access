import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useGeminiKey = () => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch an ephemeral token for Gemini Live (safer than exposing the long-lived key)
        const { data, error: fnError } = await supabase.functions.invoke('get-gemini-token');

        if (fnError) {
          console.error('Error fetching Gemini token:', fnError);
          setError('Failed to fetch token. Please try again.');
          return;
        }

        if (data?.token) {
          setApiKey(data.token);
        } else if (data?.error) {
          setError(data.error);
        }
      } catch (err) {
        console.error('Error:', err);
        setError('Failed to connect to backend. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchApiKey();
  }, []);

  return { apiKey, loading, error };
};
