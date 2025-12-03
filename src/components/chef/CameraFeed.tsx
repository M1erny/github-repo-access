import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface CameraFeedProps {
  isConnected: boolean;
  isCameraActive: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

export const CameraFeed = forwardRef<HTMLVideoElement, CameraFeedProps>(
  ({ isConnected, isCameraActive, canvasRef }, ref) => {
    return (
      <div className="relative aspect-video bg-background rounded-2xl overflow-hidden border border-border shadow-2xl">
        <video
          ref={ref}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-300",
            isCameraActive ? "opacity-100" : "opacity-30"
          )}
          autoPlay
          muted
          playsInline
        />

        {/* Overlay Status - Camera */}
        <div className="absolute top-4 left-4 bg-background/60 backdrop-blur-sm px-3 py-1 rounded-full border border-border flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            isCameraActive ? "bg-success animate-pulse" : "bg-destructive"
          )} />
          <span className="text-xs font-mono text-foreground">
            {isCameraActive ? 'CAMERA ON' : 'CAMERA OFF'}
          </span>
        </div>

        {/* Overlay Status - AI Connection */}
        {isCameraActive && (
          <div className="absolute top-4 right-4 bg-background/60 backdrop-blur-sm px-3 py-1 rounded-full border border-border flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-success animate-pulse" : "bg-warning"
            )} />
            <span className="text-xs font-mono text-foreground">
              {isConnected ? 'AI LIVE' : 'AI OFF'}
            </span>
          </div>
        )}

        {/* Hidden Canvas for Processing */}
        <canvas ref={canvasRef} className="hidden" />

        {!isCameraActive && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Camera inactive</p>
          </div>
        )}
      </div>
    );
  }
);

CameraFeed.displayName = 'CameraFeed';
