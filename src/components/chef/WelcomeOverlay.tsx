import React from 'react';
import { Button } from "@/components/ui/button";
import { Camera, Mic, ChefHat, ArrowRight } from 'lucide-react';

interface WelcomeOverlayProps {
  onConnect: () => void;
  isConnecting: boolean;
}

export const WelcomeOverlay: React.FC<WelcomeOverlayProps> = ({ onConnect, isConnecting }) => {
  return (
    <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
      <div className="max-w-2xl flex flex-col items-center gap-8">
        
        {/* Hero Icon */}
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
          <div className="relative bg-background p-6 rounded-full border-2 border-primary/20 shadow-xl">
            <ChefHat className="w-16 h-16 text-primary" />
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="space-y-4">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
            Chef G-Mini
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground font-light">
            Your AI Sous-Chef with <span className="text-foreground font-medium">Vision</span> & <span className="text-foreground font-medium">Voice</span>
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg mt-4">
          <div className="p-4 rounded-xl bg-card border shadow-sm flex flex-col items-center gap-2 hover:border-primary/50 transition-colors">
            <Camera className="w-6 h-6 text-primary" />
            <h3 className="font-semibold">I Can See</h3>
            <p className="text-sm text-muted-foreground">Show me ingredients or boiling water</p>
          </div>
          <div className="p-4 rounded-xl bg-card border shadow-sm flex flex-col items-center gap-2 hover:border-primary/50 transition-colors">
            <Mic className="w-6 h-6 text-primary" />
            <h3 className="font-semibold">I Can Hear</h3>
            <p className="text-sm text-muted-foreground">Just ask for help or recipes</p>
          </div>
        </div>

        {/* Connect Button */}
        <div className="mt-8">
          <Button 
            size="lg" 
            className="text-lg px-8 py-6 h-auto rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all scale-100 hover:scale-105"
            onClick={onConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <span className="flex items-center gap-2">Connecting...</span>
            ) : (
              <span className="flex items-center gap-2">
                Start Cooking <ArrowRight className="w-5 h-5" />
              </span>
            )}
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            Powered by Google Gemini 2.0 Flash
          </p>
        </div>

      </div>
    </div>
  );
};
