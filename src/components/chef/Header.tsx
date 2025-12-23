import React from 'react';
import { ChefHat, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const Header: React.FC = () => {
  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Failed to sign out');
    }
  };

  return (
    <header className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="gradient-chef p-2 rounded-lg shadow-lg glow-chef">
          <ChefHat size={32} className="text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gradient-chef">Chef G-Mini</h1>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
        <LogOut className="h-4 w-4" />
        Sign Out
      </Button>
    </header>
  );
};