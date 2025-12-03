import React from 'react';
import { Power, Zap, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConnectionButtonProps {
  isConnected: boolean;
  isConnecting?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export const ConnectionButton: React.FC<ConnectionButtonProps> = ({
  isConnected,
  isConnecting = false,
  onConnect,
  onDisconnect
}) => {
  const handleClick = () => {
    if (isConnecting) return; // Prevent clicks while connecting
    if (isConnected) {
      onDisconnect();
    } else {
      onConnect();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isConnecting}
      className={cn(
        "w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-3",
        isConnecting
          ? "bg-muted text-muted-foreground border border-border cursor-not-allowed"
          : isConnected
            ? "bg-destructive/10 text-destructive border border-destructive/50 hover:bg-destructive/20"
            : "gradient-chef text-primary-foreground hover:opacity-90 border border-primary/50 glow-chef"
      )}
    >
      {isConnecting ? (
        <>
          <Loader2 size={24} className="animate-spin" />
          Connecting...
        </>
      ) : isConnected ? (
        <>
          <Power size={24} />
          End Session
        </>
      ) : (
        <>
          <Zap size={24} />
          Start Cooking Session
        </>
      )}
    </button>
  );
};
