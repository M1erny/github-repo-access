import React, { useEffect, useState } from 'react';
import { Activity, Cpu, Clock, Camera, Mic, Wifi, WifiOff, Zap, MessageSquare, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModelActivity {
  type: 'input' | 'output' | 'tool_call' | 'connection';
  message: string;
  timestamp: Date;
}

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
  messagesSent: number;
  messagesReceived: number;
  lastActivity: ModelActivity | null;
  activityLog: ModelActivity[];
  aiMode?: 'audio-only' | 'multimodal';
}

interface DiagnosticPanelProps {
  info: DiagnosticInfo;
  isOpen: boolean;
  onToggle: () => void;
}

export const DiagnosticPanel: React.FC<DiagnosticPanelProps> = ({ info, isOpen, onToggle }) => {
  const [sessionDuration, setSessionDuration] = useState('--:--');

  // Update session duration every second
  useEffect(() => {
    if (!info.sessionStartTime) {
      setSessionDuration('--:--');
      return;
    }

    const updateDuration = () => {
      const diff = Math.floor((Date.now() - info.sessionStartTime!.getTime()) / 1000);
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setSessionDuration(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);
    return () => clearInterval(interval);
  }, [info.sessionStartTime]);

  const statusColor = {
    disconnected: 'text-red-500',
    connecting: 'text-yellow-500',
    connected: 'text-green-500',
  };

  const StatusIcon = info.connectionStatus === 'connected' ? Wifi : WifiOff;
  const isActive = info.lastActivity && (Date.now() - info.lastActivity.timestamp.getTime()) < 2000;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Activity Indicator - always visible when active */}
      {isActive && !isOpen && (
        <div className="absolute -top-8 right-0 flex items-center gap-2 px-2 py-1 rounded bg-cyan-500/20 border border-cyan-500/30 animate-pulse">
          <Zap className="w-3 h-3 text-cyan-400" />
          <span className="text-[10px] text-cyan-300 font-mono truncate max-w-[150px]">
            {info.lastActivity?.message}
          </span>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-full text-xs font-mono transition-all",
          "bg-black/80 backdrop-blur-sm border border-white/10 hover:border-white/20",
          info.connectionStatus === 'connected' && "border-green-500/30",
          isActive && "border-cyan-500/50 shadow-[0_0_10px_rgba(0,255,255,0.3)]"
        )}
      >
        <Activity className={cn(
          "w-3 h-3 transition-colors",
          isActive ? "text-cyan-400 animate-pulse" : statusColor[info.connectionStatus]
        )} />
        <span className="text-white/70">Diagnostics</span>
        {info.messagesReceived > 0 && (
          <span className="bg-cyan-500/30 text-cyan-300 px-1.5 py-0.5 rounded text-[10px]">
            {info.messagesReceived}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="absolute bottom-12 right-0 w-96 bg-black/90 backdrop-blur-md rounded-lg border border-white/10 p-4 shadow-xl max-h-[80vh] overflow-hidden flex flex-col">
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

            {/* AI Mode */}
            {info.aiMode && (
              <div className="flex justify-between items-center">
                <span className="text-white/50">Mode</span>
                <span className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-semibold uppercase",
                  info.aiMode === 'multimodal' 
                    ? "bg-blue-500/20 text-blue-300" 
                    : "bg-orange-500/20 text-orange-300"
                )}>
                  {info.aiMode === 'multimodal' ? '📷 Camera + Voice' : '🎤 Voice Only'}
                </span>
              </div>
            )}

            {/* Model */}
            <div className="flex justify-between items-center">
              <span className="text-white/50">Model</span>
              <span className="text-cyan-400 text-right max-w-[220px] truncate" title={info.modelName}>
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
              <span className="text-orange-400">{sessionDuration}</span>
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

            {/* Message Stats */}
            <div className="flex justify-between items-center">
              <span className="text-white/50 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                Messages
              </span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-blue-400">
                  <Send className="w-3 h-3" />
                  {info.messagesSent}
                </span>
                <span className="flex items-center gap-1 text-green-400">
                  ↓ {info.messagesReceived}
                </span>
              </div>
            </div>

            {/* Activity Log */}
            <div className="border-t border-white/10 pt-2 mt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/50 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Activity Log
                </span>
                <span className="text-white/30 text-[10px]">Last 10</span>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-white/10">
                {info.activityLog.length === 0 ? (
                  <div className="text-white/30 text-[10px] text-center py-2">No activity yet</div>
                ) : (
                  [...info.activityLog].reverse().map((activity, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "flex items-start gap-2 text-[10px] p-1 rounded",
                        activity.type === 'input' && "bg-blue-500/10",
                        activity.type === 'output' && "bg-green-500/10",
                        activity.type === 'tool_call' && "bg-purple-500/10",
                        activity.type === 'connection' && "bg-yellow-500/10"
                      )}
                    >
                      <span className="text-white/30 shrink-0">
                        {activity.timestamp.toLocaleTimeString()}
                      </span>
                      <span className={cn(
                        "truncate",
                        activity.type === 'input' && "text-blue-300",
                        activity.type === 'output' && "text-green-300",
                        activity.type === 'tool_call' && "text-purple-300",
                        activity.type === 'connection' && "text-yellow-300"
                      )}>
                        {activity.message}
                      </span>
                    </div>
                  ))
                )}
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
