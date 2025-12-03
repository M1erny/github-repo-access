import React, { useEffect, useRef } from 'react';
import { Activity } from 'lucide-react';
import { VisionLog } from '@/types/chef';

interface VisionLogsProps {
  logs: VisionLog[];
}

export const VisionLogs: React.FC<VisionLogsProps> = ({ logs }) => {
  const logsRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-background rounded-xl border border-border p-4 h-64 flex flex-col">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
        <Activity size={16} className="text-primary" />
        <span className="text-xs font-mono text-muted-foreground uppercase">
          Vision Stream Analysis
        </span>
      </div>
      <div 
        ref={logsRef} 
        className="flex-1 overflow-y-auto font-mono text-xs space-y-2 no-scrollbar"
      >
        {logs.length === 0 ? (
          <div className="text-muted-foreground italic">
            Waiting for visual input...
          </div>
        ) : (
          logs.map((log, i) => (
            <div 
              key={i} 
              className="flex gap-3 animate-fade-in"
            >
              <span className="text-muted-foreground shrink-0">{log.time}</span>
              <span className="text-primary/80">{log.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
