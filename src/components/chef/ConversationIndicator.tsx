import React from 'react';
import { Mic, Volume2, Brain, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ConversationState = 'idle' | 'listening' | 'processing' | 'speaking';

interface ConversationIndicatorProps {
  state: ConversationState;
  isConnected: boolean;
  volume: number;
}

export const ConversationIndicator: React.FC<ConversationIndicatorProps> = ({
  state,
  isConnected,
  volume
}) => {
  if (!isConnected) {
    return (
      <div className="bg-muted/50 rounded-xl p-6 border border-border flex flex-col items-center justify-center h-32">
        <Radio className="w-8 h-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Not Connected</p>
      </div>
    );
  }

  const stateConfig = {
    idle: {
      icon: Mic,
      label: 'Ready',
      sublabel: 'Speak to Chef G-Mini',
      bgClass: 'bg-secondary/50',
      iconClass: 'text-muted-foreground',
      pulseClass: '',
    },
    listening: {
      icon: Mic,
      label: 'Listening',
      sublabel: 'Speak now...',
      bgClass: 'bg-primary/10',
      iconClass: 'text-primary',
      pulseClass: 'animate-pulse',
    },
    processing: {
      icon: Brain,
      label: 'Thinking',
      sublabel: 'Processing...',
      bgClass: 'bg-amber-500/10',
      iconClass: 'text-amber-500',
      pulseClass: 'animate-pulse',
    },
    speaking: {
      icon: Volume2,
      label: 'Speaking',
      sublabel: 'Chef G-Mini',
      bgClass: 'bg-green-500/10',
      iconClass: 'text-green-500',
      pulseClass: '',
    },
  };

  const config = stateConfig[state];
  const Icon = config.icon;

  // Visual bars for speaking state
  const bars = [0.3, 0.6, 1, 0.7, 0.4];

  return (
    <div className={cn(
      "rounded-xl p-6 border border-border flex flex-col items-center justify-center h-32 relative overflow-hidden transition-colors duration-300",
      config.bgClass
    )}>
      {/* Background animation for speaking */}
      {state === 'speaking' && (
        <div className="absolute inset-0 flex items-center justify-center gap-1">
          {bars.map((height, i) => (
            <div
              key={i}
              className="w-1 bg-green-500/30 rounded-full animate-pulse"
              style={{
                height: `${height * 60}%`,
                animationDelay: `${i * 0.1}s`,
                animationDuration: '0.5s',
              }}
            />
          ))}
        </div>
      )}

      {/* Listening volume indicator */}
      {state === 'listening' && volume > 0.1 && (
        <div 
          className="absolute inset-0 bg-primary/20 transition-opacity duration-100"
          style={{ opacity: Math.min(volume * 2, 0.5) }}
        />
      )}

      <div className="relative z-10 flex flex-col items-center">
        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all",
          state === 'listening' && 'ring-4 ring-primary/30',
          state === 'speaking' && 'ring-4 ring-green-500/30',
          config.pulseClass
        )}>
          <Icon className={cn("w-6 h-6", config.iconClass)} />
        </div>
        <p className={cn("text-sm font-medium", config.iconClass)}>{config.label}</p>
        <p className="text-xs text-muted-foreground">{config.sublabel}</p>
      </div>

      {/* State dot indicator */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <span className={cn(
          "w-2 h-2 rounded-full",
          state === 'speaking' ? 'bg-green-500' : 
          state === 'listening' ? 'bg-primary animate-pulse' : 
          state === 'processing' ? 'bg-amber-500 animate-pulse' :
          'bg-muted-foreground'
        )} />
        <span className="text-xs text-muted-foreground capitalize">{state}</span>
      </div>
    </div>
  );
};
