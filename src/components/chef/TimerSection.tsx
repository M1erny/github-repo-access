import React from 'react';
import { Timer } from '@/types/chef';
import { TimerCard } from './TimerCard';

interface TimerSectionProps {
  timers: Timer[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
  onReset: (id: string) => void;
}

export const TimerSection: React.FC<TimerSectionProps> = ({
  timers,
  onPause,
  onResume,
  onDelete,
  onReset
}) => {
  return (
    <div className="bg-secondary/30 rounded-xl p-4 border border-border flex-1 min-h-[400px]">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-primary" />
        Active Timers
      </h2>

      <div className="space-y-3">
        {timers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground border-2 border-dashed border-border rounded-xl">
            <div className="w-12 h-12 rounded-full bg-secondary mb-3 flex items-center justify-center">
              <span className="text-2xl">⏲️</span>
            </div>
            <p className="text-sm">No active timers</p>
            <p className="text-xs mt-1 text-muted-foreground/70">"Set a timer for pasta"</p>
          </div>
        ) : (
          timers.map(timer => (
            <TimerCard
              key={timer.id}
              timer={timer}
              onPause={onPause}
              onResume={onResume}
              onDelete={onDelete}
              onReset={onReset}
            />
          ))
        )}
      </div>
    </div>
  );
};
