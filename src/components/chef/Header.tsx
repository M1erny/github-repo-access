import React from 'react';
import { ChefHat, Sparkles } from 'lucide-react';
export const Header: React.FC = () => {
  return <header className="flex items-center gap-3 mb-6">
      <div className="gradient-chef p-2 rounded-lg shadow-lg glow-chef">
        <ChefHat size={32} className="text-primary-foreground" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gradient-chef">Chef G-Mini</h1>
        
      </div>
    </header>;
};