import { ChefApp } from '@/components/chef/ChefApp';

const Index = () => {
  // In production, this would come from environment/secrets
  // For now, we'll prompt users to add their API key via Lovable Cloud
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || null;

  return <ChefApp apiKey={apiKey} />;
};

export default Index;
