import React from 'react';
import { Visualizer } from './Visualizer';

interface AudioVisualizerSectionProps {
  isSpeaking: boolean;
  volume: number;
}

export const AudioVisualizerSection: React.FC<AudioVisualizerSectionProps> = ({ 
  isSpeaking, 
  volume 
}) => {
  return (
    <div className="bg-secondary/50 rounded-xl p-6 border border-border flex flex-col items-center justify-center h-32 relative overflow-hidden">
      <Visualizer isPlaying={isSpeaking} volume={volume} />
      <div className="absolute bottom-2 right-3 text-xs text-muted-foreground flex items-center gap-1">
        {isSpeaking ? 'AI Speaking' : 'Listening...'}
      </div>
    </div>
  );
};
