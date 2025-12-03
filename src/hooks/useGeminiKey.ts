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
        
        const { data, error: fnError } = await supabase.functions.invoke('get-gemini-key');
        
        if (fnError) {
          console.error('Error fetching Gemini API key:', fnError);
          setError('Failed to fetch API key. Please try again.');
          return;
        }
        
        if (data?.apiKey) {
          setApiKey(data.apiKey);
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
