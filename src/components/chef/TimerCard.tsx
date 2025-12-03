import React from 'react';
import { Timer } from '@/types/chef';
import { Play, Pause, X, RotateCcw, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimerCardProps {
  timer: Timer;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
  onReset: (id: string) => void;
}

export const TimerCard: React.FC<TimerCardProps> = ({
  timer,
  onPause,
  onResume,
  onDelete,
  onReset
}) => {
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = Math.max(0, Math.min(100, (timer.durationRemaining / timer.durationOriginal) * 100));

  // Color logic
  const isFinished = timer.status === 'finished';
  const isUrgent = timer.durationRemaining < 60 && timer.status === 'running';

  return (
    <div className="relative overflow-hidden bg-card rounded-xl p-4 shadow-lg border border-border w-full mb-3 transition-all">
      {/* Progress Bar Background */}
      <div
        className={cn(
          "absolute bottom-0 left-0 h-1 transition-all duration-1000 linear",
          isFinished ? "bg-success" : isUrgent ? "bg-destructive animate-pulse" : "bg-primary"
        )}
        style={{ width: `${progress}%` }}
      />

      <div className="flex justify-between items-center relative z-10">
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
            {timer.label}
          </span>
          <span className={cn(
            "text-3xl font-mono font-bold",
            isFinished ? "text-success" : "text-foreground"
          )}>
            {isFinished ? 'DONE!' : formatTime(timer.durationRemaining)}
          </span>
        </div>

        <div className="flex gap-2">
          {isFinished ? (
            <>
              <button 
                onClick={() => onReset(timer.id)} 
                className="p-2 bg-secondary rounded-full hover:bg-secondary/80 text-muted-foreground transition-colors"
              >
                <RotateCcw size={20} />
              </button>
              <button 
                onClick={() => onDelete(timer.id)} 
                className="p-2 bg-secondary rounded-full hover:bg-secondary/80 text-success transition-colors"
              >
                <CheckCircle size={20} />
              </button>
            </>
          ) : (
            <>
              {timer.status === 'running' ? (
                <button 
                  onClick={() => onPause(timer.id)} 
                  className="p-2 bg-secondary rounded-full hover:bg-secondary/80 transition-colors"
                >
                  <Pause size={20} />
                </button>
              ) : (
                <button 
                  onClick={() => onResume(timer.id)} 
                  className="p-2 bg-secondary rounded-full hover:bg-secondary/80 transition-colors"
                >
                  <Play size={20} />
                </button>
              )}
              <button 
                onClick={() => onDelete(timer.id)} 
                className="p-2 bg-secondary rounded-full hover:bg-secondary/80 text-destructive transition-colors"
              >
                <X size={20} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
