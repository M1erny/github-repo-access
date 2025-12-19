import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SwitchCamera, Maximize2, Minimize2 } from 'lucide-react';

interface CameraFeedProps {
  isConnected: boolean;
  isCameraActive: boolean;
  cameraError?: string | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  cameras: MediaDeviceInfo[];
  currentCameraIndex: number;
  useWideAngle: boolean;
  onSwitchCamera: () => void;
  onToggleWideAngle: () => void;
}

export const CameraFeed = forwardRef<HTMLVideoElement, CameraFeedProps>(
  (
    {
      isConnected,
      isCameraActive,
      cameraError,
      canvasRef,
      cameras,
      currentCameraIndex,
      useWideAngle,
      onSwitchCamera,
      onToggleWideAngle,
    },
    ref
  ) => {
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

        {/* Camera Controls */}
        {isCameraActive && (
          <div className="absolute bottom-4 right-4 flex gap-2">
            {/* Wide Angle Toggle */}
            <Button
              variant="secondary"
              size="icon"
              onClick={onToggleWideAngle}
              className={cn(
                "bg-background/60 backdrop-blur-sm border border-border hover:bg-background/80",
                useWideAngle && "ring-2 ring-primary"
              )}
              title={useWideAngle ? "Standard View" : "Wide Angle"}
            >
              {useWideAngle ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>

            {/* Switch Camera */}
            {cameras.length > 1 && (
              <Button
                variant="secondary"
                size="icon"
                onClick={onSwitchCamera}
                className="bg-background/60 backdrop-blur-sm border border-border hover:bg-background/80"
                title={`Switch Camera (${currentCameraIndex + 1}/${cameras.length})`}
              >
                <SwitchCamera className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {/* Camera Info Badge */}
        {isCameraActive && cameras.length > 0 && (
          <div className="absolute bottom-4 left-4 bg-background/60 backdrop-blur-sm px-2 py-1 rounded border border-border">
            <span className="text-xs font-mono text-muted-foreground">
              {cameras[currentCameraIndex]?.label?.slice(0, 20) || `Camera ${currentCameraIndex + 1}`}
              {useWideAngle && ' • Wide'}
            </span>
          </div>
        )}

        {/* Hidden Canvas for Processing */}
        <canvas ref={canvasRef} className="hidden" />

        {!isCameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/50">
            <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
              <SwitchCamera className="w-6 h-6 text-destructive" />
            </div>
            <p className="text-muted-foreground text-sm font-medium">Camera inactive</p>
            <p className="text-muted-foreground/70 text-xs text-center px-4">
              {cameraError
                ? `Camera error: ${cameraError}`
                : isConnected
                  ? "No video - audio only mode"
                  : "Start cooking session to enable camera"}
            </p>
          </div>
        )}
      </div>
    );
  }
);

CameraFeed.displayName = 'CameraFeed';
