import React from 'react';
import { Activity, Cpu, Clock, Camera, Mic, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DiagnosticInfo {
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  modelName: string;
  apiVersion: string;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
  };
  sessionStartTime: Date | null;
  hasVideo: boolean;
  hasAudio: boolean;
  lastError: string | null;
}

interface DiagnosticPanelProps {
  info: DiagnosticInfo;
  isOpen: boolean;
  onToggle: () => void;
}

export const DiagnosticPanel: React.FC<DiagnosticPanelProps> = ({ info, isOpen, onToggle }) => {
  const formatDuration = (start: Date | null) => {
    if (!start) return '--:--';
    const diff = Math.floor((Date.now() - start.getTime()) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const statusColor = {
    disconnected: 'text-red-500',
    connecting: 'text-yellow-500',
    connected: 'text-green-500',
  };

  const StatusIcon = info.connectionStatus === 'connected' ? Wifi : WifiOff;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-full text-xs font-mono transition-all",
          "bg-black/80 backdrop-blur-sm border border-white/10 hover:border-white/20",
          info.connectionStatus === 'connected' && "border-green-500/30"
        )}
      >
        <Activity className={cn("w-3 h-3", statusColor[info.connectionStatus])} />
        <span className="text-white/70">Diagnostics</span>
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="absolute bottom-12 right-0 w-80 bg-black/90 backdrop-blur-md rounded-lg border border-white/10 p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-400" />
              System Diagnostics
            </h3>
            <StatusIcon className={cn("w-4 h-4", statusColor[info.connectionStatus])} />
          </div>

          <div className="space-y-3 text-xs font-mono">
            {/* Connection Status */}
            <div className="flex justify-between items-center">
              <span className="text-white/50">Status</span>
              <span className={cn("font-semibold uppercase", statusColor[info.connectionStatus])}>
                {info.connectionStatus}
              </span>
            </div>

            {/* Model */}
            <div className="flex justify-between items-center">
              <span className="text-white/50">Model</span>
              <span className="text-cyan-400 text-right max-w-[180px] truncate" title={info.modelName}>
                {info.modelName || 'N/A'}
              </span>
            </div>

            {/* API Version */}
            <div className="flex justify-between items-center">
              <span className="text-white/50">API Version</span>
              <span className="text-purple-400">{info.apiVersion || 'N/A'}</span>
            </div>

            {/* Session Duration */}
            <div className="flex justify-between items-center">
              <span className="text-white/50 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Session
              </span>
              <span className="text-orange-400">{formatDuration(info.sessionStartTime)}</span>
            </div>

            {/* Media Status */}
            <div className="flex justify-between items-center">
              <span className="text-white/50">Media</span>
              <div className="flex items-center gap-2">
                <span className={cn("flex items-center gap-1", info.hasVideo ? "text-green-400" : "text-red-400")}>
                  <Camera className="w-3 h-3" />
                  {info.hasVideo ? 'ON' : 'OFF'}
                </span>
                <span className={cn("flex items-center gap-1", info.hasAudio ? "text-green-400" : "text-red-400")}>
                  <Mic className="w-3 h-3" />
                  {info.hasAudio ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>

            {/* Token Usage */}
            <div className="border-t border-white/10 pt-2 mt-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-white/50">Input Tokens</span>
                <span className="text-yellow-400">{info.tokenUsage.inputTokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/50">Output Tokens</span>
                <span className="text-yellow-400">{info.tokenUsage.outputTokens.toLocaleString()}</span>
              </div>
            </div>

            {/* Error (if any) */}
            {info.lastError && (
              <div className="border-t border-red-500/30 pt-2 mt-2">
                <span className="text-red-400 text-[10px] break-words">{info.lastError}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
