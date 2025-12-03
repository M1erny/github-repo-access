import { ChefApp } from '@/components/chef/ChefApp';
import { useGeminiKey } from '@/hooks/useGeminiKey';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { apiKey, loading, error } = useGeminiKey();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading Chef G-Mini...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-destructive/20 border border-destructive text-destructive-foreground p-6 rounded-xl max-w-md text-center">
          <h2 className="text-xl font-bold mb-2">Configuration Error</h2>
          <p className="text-sm">{error}</p>
          <p className="text-xs mt-4 text-muted-foreground">
            Please ensure your Gemini API key is configured in Lovable Cloud.
          </p>
        </div>
      </div>
    );
  }

  return <ChefApp apiKey={apiKey} />;
};

export default Index;
