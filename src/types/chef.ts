export interface Timer {
  id: string;
  label: string;
  durationOriginal: number;
  durationRemaining: number;
  status: 'running' | 'paused' | 'finished';
}

export interface AudioVisualizerProps {
  isPlaying: boolean;
  volume: number;
}

export interface CookingToolResponse {
  result: string;
  timers?: Timer[];
}

export interface VisionLog {
  time: string;
  text: string;
}
