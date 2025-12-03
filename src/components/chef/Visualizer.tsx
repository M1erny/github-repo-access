import React, { useEffect, useRef } from 'react';
import { AudioVisualizerProps } from '@/types/chef';

export const Visualizer: React.FC<AudioVisualizerProps> = ({ isPlaying, volume }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let offset = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      ctx.beginPath();
      ctx.moveTo(0, centerY);

      // Base amplitude plus volume reactivity
      const amplitude = isPlaying ? 10 + (volume * 100) : 2;

      for (let x = 0; x < width; x++) {
        // Create a wave effect
        const frequency = 0.05;
        const y = centerY + Math.sin(x * frequency + offset) * amplitude * Math.sin(x / width * Math.PI);
        ctx.lineTo(x, y);
      }

      // Use CSS variable colors - orange when active, gray when idle
      ctx.strokeStyle = isPlaying ? '#f97316' : '#525252';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();

      offset += 0.2;
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isPlaying, volume]);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={80}
      className="w-full max-w-xs h-20"
    />
  );
};
