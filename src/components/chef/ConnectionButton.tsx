import React from 'react';
import { Power, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConnectionButtonProps {
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export const ConnectionButton: React.FC<ConnectionButtonProps> = ({
  isConnected,
  onConnect,
  onDisconnect
}) => {
  return (
    <button
      onClick={isConnected ? onDisconnect : onConnect}
      className={cn(
        "w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-3",
        isConnected
          ? "bg-destructive/10 text-destructive border border-destructive/50 hover:bg-destructive/20"
          : "gradient-chef text-primary-foreground hover:opacity-90 border border-primary/50 glow-chef"
      )}
    >
      {isConnected ? <Power size={24} /> : <Zap size={24} />}
      {isConnected ? 'End Session' : 'Start Cooking Session'}
    </button>
  );
};
