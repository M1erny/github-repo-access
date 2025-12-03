import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, Type } from '@google/genai';
import type { FunctionDeclaration, LiveServerMessage } from '@google/genai';
import { Timer, VisionLog } from '@/types/chef';
import { base64ToUint8Array, decodeAudioData, createPcmBlob } from '@/services/audioUtils';
import { Header } from './Header';
import { CameraFeed } from './CameraFeed';
import { ConnectionButton } from './ConnectionButton';
import { VisionLogs } from './VisionLogs';
import { ConversationIndicator } from './ConversationIndicator';
import { TimerSection } from './TimerSection';
import { RecipePanel } from './RecipePanel';
import { ActiveRecipeCard } from './ActiveRecipeCard';
import { useRecipes, Recipe } from '@/hooks/useRecipes';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// --- Tool Definitions ---
const createTimerTool: FunctionDeclaration = {
  name: 'createTimer',
  description: 'Create a new cooking timer. AUTOMATICALLY call this when you observe cooking events that need timing: pasta/noodles entering boiling water, meat hitting a pan, vegetables starting to sauté, anything going into an oven, etc. Do NOT ask permission - just create the timer immediately when you see the cooking action begin.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      label: { type: Type.STRING, description: 'Label for the timer (e.g., Pasta, Chicken, Rice)' },
      durationSeconds: { type: Type.NUMBER, description: 'Duration in seconds based on what is being cooked' },
    },
    required: ['label', 'durationSeconds'],
  },
};

const getTimersTool: FunctionDeclaration = {
  name: 'getTimers',
  description: 'Get the list of active timers and their remaining time.',
  parameters: { type: Type.OBJECT, properties: {} },
};

const logObservationTool: FunctionDeclaration = {
  name: 'logObservation',
  description: 'Log a brief visual observation of the video feed. Call this tool periodically (every 5-10 seconds) when you notice something relevant to cooking - ingredients being prepared, cooking progress, technique being used, etc.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      text: { type: Type.STRING, description: 'Brief cooking-relevant observation (e.g. "Onions sautéing in pan", "Adding pasta to boiling water", "Stirring sauce"). Focus on cooking actions.' },
    },
    required: ['text'],
  },
};

const getActiveRecipeTool: FunctionDeclaration = {
  name: 'getActiveRecipe',
  description: 'IMPORTANT: Call this tool BEFORE answering ANY question about the recipe, ingredients, steps, timing, or cooking instructions. Returns the full recipe with title, ingredients list, all instructions, currentStep, currentStepText, and totalSteps. ALWAYS use this tool data to answer - never guess or use general knowledge when a recipe is active.',
  parameters: { type: Type.OBJECT, properties: {} },
};

interface ChefAppProps {
  apiKey: string | null;
}

export const ChefApp: React.FC<ChefAppProps> = ({ apiKey }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [volume, setVolume] = useState(0);
  const [timers, setTimers] = useState<Timer[]>([]);
  const [logs, setLogs] = useState<VisionLog[]>([]);
  const visionIntervalRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [useWideAngle, setUseWideAngle] = useState(false);

  // Derived conversation state
  const conversationState = isSpeaking ? 'speaking' : isProcessing ? 'processing' : isListening ? 'listening' : 'idle';

  // Recipe management
  const {
    recipes,
    loading: recipesLoading,
    activeRecipe,
    setActiveRecipe,
    addRecipe,
    deleteRecipe,
    parseRecipeFromUrl,
    parseRecipeFromFile,
  } = useRecipes();

  // Refs
  const timersRef = useRef<Timer[]>([]);
  const activeRecipeRef = useRef<Recipe | null>(null);
  const currentStepRef = useRef<number>(0);
  const nextStartTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoIntervalRef = useRef<number | null>(null);

  // Sync refs with state
  useEffect(() => {
    timersRef.current = timers;
  }, [timers]);

  useEffect(() => {
    activeRecipeRef.current = activeRecipe;
    setCurrentStep(0); // Reset step when recipe changes
  }, [activeRecipe]);

  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  // Enumerate available cameras on mount
  useEffect(() => {
    const enumerateCameras = async () => {
      try {
        // Request permission first to get device labels
        await navigator.mediaDevices.getUserMedia({ video: true }).then(s => s.getTracks().forEach(t => t.stop()));
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setCameras(videoDevices);
      } catch (e) {
        console.warn('Could not enumerate cameras:', e);
      }
    };
    enumerateCameras();
  }, [currentStep]);

  // --- Audio/Video Cleanup ---
  const stopSession = useCallback((keepCamera = false) => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (inputContextRef.current) {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }

    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch(e) {}
    });
    sourcesRef.current.clear();

    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }
    
    if (visionIntervalRef.current) {
      clearInterval(visionIntervalRef.current);
      visionIntervalRef.current = null;
    }

    // Only stop camera if explicitly requested (user disconnect)
    if (!keepCamera && mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
      setIsCameraActive(false);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }

    sessionPromiseRef.current = null;
    setIsConnected(false);
    setIsConnecting(false);
    setIsSpeaking(false);
    setIsListening(false);
    setIsProcessing(false);
    setVolume(0);
  }, []);

  // --- Timer Tick Logic ---
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prevTimers => {
        const hasRunning = prevTimers.some(t => t.status === 'running');
        if (!hasRunning) return prevTimers;

        return prevTimers.map(timer => {
          if (timer.status !== 'running') return timer;
          const nextRemaining = timer.durationRemaining - 1;

          if (nextRemaining <= 0 && timer.durationRemaining > 0) {
            toast({
              title: `Timer Complete!`,
              description: `${timer.label} is done!`,
            });
            return { ...timer, durationRemaining: 0, status: 'finished' };
          }
          return { ...timer, durationRemaining: Math.max(0, nextRemaining) };
        });
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // --- Timer Actions ---
  const addTimer = (label: string, durationSeconds: number) => {
    const newTimer: Timer = {
      id: Math.random().toString(36).substring(7),
      label,
      durationOriginal: durationSeconds,
      durationRemaining: durationSeconds,
      status: 'running',
    };
    setTimers(prev => [...prev, newTimer]);
    toast({
      title: "Timer Created",
      description: `${label} - ${Math.floor(durationSeconds / 60)}:${(durationSeconds % 60).toString().padStart(2, '0')}`,
    });
    return newTimer;
  };

  const removeTimer = (id: string) => {
    setTimers(prev => prev.filter(t => t.id !== id));
  };

  const toggleTimer = (id: string, pause: boolean) => {
    setTimers(prev => prev.map(t =>
      t.id === id ? { ...t, status: pause ? 'paused' : 'running' } : t
    ));
  };

  const resetTimer = (id: string) => {
    setTimers(prev => prev.map(t =>
      t.id === id ? { ...t, status: 'running', durationRemaining: t.durationOriginal } : t
    ));
  };

  // Switch camera function
  const switchCamera = async () => {
    if (cameras.length <= 1) return;
    
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);
    
    // If camera is active, restart with new device
    if (mediaStreamRef.current && videoRef.current) {
      // Stop current video tracks
      mediaStreamRef.current.getVideoTracks().forEach(track => track.stop());
      
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: cameras[nextIndex].deviceId },
            width: { ideal: useWideAngle ? 1280 : 640 },
            height: { ideal: useWideAngle ? 720 : 480 },
            frameRate: { ideal: 15 }
          }
        });
        
        // Replace video track in existing stream
        const newVideoTrack = newStream.getVideoTracks()[0];
        const oldVideoTrack = mediaStreamRef.current.getVideoTracks()[0];
        if (oldVideoTrack) {
          mediaStreamRef.current.removeTrack(oldVideoTrack);
        }
        mediaStreamRef.current.addTrack(newVideoTrack);
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStreamRef.current;
        }
        
        toast({
          title: "Camera Switched",
          description: cameras[nextIndex].label || `Camera ${nextIndex + 1}`,
        });
      } catch (e) {
        console.error('Failed to switch camera:', e);
        toast({
          title: "Camera Switch Failed",
          description: "Could not switch to the other camera.",
          variant: "destructive",
        });
      }
    }
  };

  // Toggle wide angle mode
  const toggleWideAngle = async () => {
    const newWideAngle = !useWideAngle;
    setUseWideAngle(newWideAngle);
    
    if (mediaStreamRef.current && videoRef.current) {
      // Stop current video tracks
      mediaStreamRef.current.getVideoTracks().forEach(track => track.stop());
      
      try {
        const deviceId = cameras[currentCameraIndex]?.deviceId;
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
            width: { ideal: newWideAngle ? 1280 : 640 },
            height: { ideal: newWideAngle ? 720 : 480 },
            frameRate: { ideal: 15 },
            // Request wider field of view if available
            ...(newWideAngle ? { 
              aspectRatio: { ideal: 16/9 },
              // Some devices support zoom - set to minimum for widest view
              zoom: { ideal: 1 }
            } : {})
          }
        });
        
        const newVideoTrack = newStream.getVideoTracks()[0];
        const oldVideoTrack = mediaStreamRef.current.getVideoTracks()[0];
        if (oldVideoTrack) {
          mediaStreamRef.current.removeTrack(oldVideoTrack);
        }
        mediaStreamRef.current.addTrack(newVideoTrack);
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStreamRef.current;
        }
        
        toast({
          title: newWideAngle ? "Wide Angle Enabled" : "Standard View",
          description: newWideAngle ? "Using wider field of view" : "Using standard camera view",
        });
      } catch (e) {
        console.error('Failed to toggle wide angle:', e);
        setUseWideAngle(!newWideAngle); // Revert
      }
    }
  };

  // Vision analysis function - runs every 3 seconds
  const analyzeVision = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isCameraActive) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.videoWidth === 0) return;

    // Capture smaller frame for analysis
    canvas.width = 320;
    canvas.height = 240;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];

    try {
      const { data, error } = await supabase.functions.invoke('analyze-vision', {
        body: {
          imageBase64: base64,
          activeRecipe: activeRecipeRef.current?.title || null
        }
      });

      if (error) {
        console.error('Vision analysis error:', error);
        return;
      }

      if (data?.description) {
        setLogs(prev => [...prev.slice(-19), {
          time: new Date().toLocaleTimeString(),
          text: data.description
        }]);
      }
    } catch (e) {
      console.error('Vision analysis failed:', e);
    }
  }, [isCameraActive]);

  // Start/stop vision analysis when camera state changes
  useEffect(() => {
    if (isCameraActive && !visionIntervalRef.current) {
      // Run immediately once, then every 3 seconds
      analyzeVision();
      visionIntervalRef.current = window.setInterval(analyzeVision, 3000);
    } else if (!isCameraActive && visionIntervalRef.current) {
      clearInterval(visionIntervalRef.current);
      visionIntervalRef.current = null;
    }

    return () => {
      if (visionIntervalRef.current) {
        clearInterval(visionIntervalRef.current);
        visionIntervalRef.current = null;
      }
    };
  }, [isCameraActive, analyzeVision]);

  // Build system instruction with active recipe context
  const buildSystemInstruction = () => {
    let instruction = `You are Chef G-Mini, a helpful cooking assistant.

CRITICAL RULE - RECIPE ACCURACY:
When a user asks about the recipe, ingredients, steps, timing, or anything recipe-related, you MUST:
1. FIRST call the 'getActiveRecipe' tool to get the exact recipe data
2. ONLY answer using the data returned from that tool
3. NEVER guess, assume, or use general cooking knowledge for recipe-specific questions
4. If you're unsure, call getActiveRecipe again to verify

YOUR TOOLS:
- 'getActiveRecipe': Call this BEFORE answering ANY recipe question. It returns the exact recipe the user uploaded.
- 'createTimer': Create cooking timers. Use recipe timing when available.
- 'logObservation': Log what you see in the camera (use periodically for cooking-relevant observations).
- 'getTimers': Check active timers.

VISION LOGGING:
- Call 'logObservation' every 5-10 seconds when you notice cooking activity
- Focus on cooking actions: "adding ingredients", "stirring", "checking doneness"

CONVERSATION STYLE:
- Be helpful and conversational
- When guiding through a recipe, reference exact step numbers and ingredients
- Proactively suggest the next step when you see them complete one`;

    if (activeRecipeRef.current) {
      instruction += `

A RECIPE IS CURRENTLY ACTIVE: "${activeRecipeRef.current.title}"
The user has loaded this recipe and wants guidance. When they ask about it, ALWAYS call getActiveRecipe to get the exact data before answering.`;
    } else {
      instruction += `

No recipe is currently selected. Help them freestyle or suggest adding a recipe.`;
    }

    return instruction;
  };

  // --- Gemini Connection ---
  const connectToGemini = async () => {
    if (!apiKey) {
      setError("API Key not configured. Please add your Gemini API key.");
      return;
    }

    // Prevent multiple connection attempts
    if (isConnecting || isConnected) {
      console.log("Already connecting or connected, ignoring...");
      return;
    }

    // Clean up any existing session first
    stopSession(true);

    setIsConnecting(true);
    setError(null);
    setLogs([]);
    
    try {
      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioContextClass({ sampleRate: 16000 });
      const outputCtx = new AudioContextClass({ sampleRate: 24000 });

      inputContextRef.current = inputCtx;
      audioContextRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      // Request Media Stream (Audio + Video)
      const deviceId = cameras[currentCameraIndex]?.deviceId;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          width: { ideal: useWideAngle ? 1280 : 640 },
          height: { ideal: useWideAngle ? 720 : 480 },
          frameRate: { ideal: 15 },
          ...(useWideAngle ? { aspectRatio: { ideal: 16/9 }, zoom: { ideal: 1 } } : {})
        }
      });
      mediaStreamRef.current = stream;

      // Setup Video Preview
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        try {
          await videoRef.current.play();
        } catch (playError) {
          console.warn('Autoplay blocked, video will play on user interaction:', playError);
        }
      }

      // Audio Source and Analyzer
      const source = inputCtx.createMediaStreamSource(stream);
      const analyzer = inputCtx.createAnalyser();
      analyzer.fftSize = 256;
      source.connect(analyzer);
      const dataArray = new Uint8Array(analyzer.frequencyBinCount);

      const updateVolume = () => {
        if (!inputContextRef.current) return;
        analyzer.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setVolume(avg / 255);
        requestAnimationFrame(updateVolume);
      };
      updateVolume();

      // Audio Processor
      const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessor.onaudioprocess = (e) => {
        if (!sessionPromiseRef.current) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBlob = createPcmBlob(inputData);

        sessionPromiseRef.current.then(session => {
          session.sendRealtimeInput({ media: pcmBlob });
        });
      };
      source.connect(scriptProcessor);
      scriptProcessor.connect(inputCtx.destination);

      // --- Initialize Gemini Client ---
      const ai = new GoogleGenAI({ apiKey });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: buildSystemInstruction(),
          tools: [
            { functionDeclarations: [createTimerTool, getTimersTool, logObservationTool, getActiveRecipeTool] }
          ]
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            setIsListening(true); // Start in listening mode
            console.log("Gemini Live Session Opened");
            toast({
              title: "Connected",
              description: activeRecipeRef.current
                ? `Chef G-Mini is ready to guide you through "${activeRecipeRef.current.title}"!`
                : "Chef G-Mini is ready to help!",
            });
          },
          onmessage: async (msg: LiveServerMessage) => {
            console.log("Gemini message:", msg);
            
            // Handle turn completion - user can speak again
            if (msg.serverContent?.turnComplete) {
              console.log("Turn complete - listening for user");
              setIsSpeaking(false);
              setIsProcessing(false);
              setIsListening(true);
            }
            
            // Handle interruption
            if (msg.serverContent?.interrupted) {
              console.log("AI was interrupted");
              setIsSpeaking(false);
              setIsProcessing(false);
              setIsListening(true);
              // Clear any pending audio
              sourcesRef.current.forEach(source => {
                try { source.stop(); } catch(e) {}
              });
              sourcesRef.current.clear();
              nextStartTimeRef.current = audioContextRef.current?.currentTime || 0;
            }

            // Handle Audio Output
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              setIsSpeaking(true);
              setIsListening(false);
              setIsProcessing(false);
              const buffer = await decodeAudioData(base64ToUint8Array(audioData), outputCtx);
              const bufferSource = outputCtx.createBufferSource();
              bufferSource.buffer = buffer;
              bufferSource.connect(outputCtx.destination);

              const now = outputCtx.currentTime;
              if (nextStartTimeRef.current < now) {
                nextStartTimeRef.current = now;
              }
              bufferSource.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;

              sourcesRef.current.add(bufferSource);
              bufferSource.onended = () => {
                sourcesRef.current.delete(bufferSource);
                if (sourcesRef.current.size === 0) {
                  setIsSpeaking(false);
                  setIsListening(true);
                }
              };
            }

            // Handle Tool Calls - show processing state
            if (msg.toolCall) {
              setIsProcessing(true);
              setIsListening(false);
              const responses = [];
              for (const fc of msg.toolCall.functionCalls) {
                let result: any = { result: "ok" };

                if (fc.name === 'createTimer') {
                  const { label, durationSeconds } = fc.args as any;
                  addTimer(label, durationSeconds);
                  result = { result: `Timer '${label}' set for ${durationSeconds}s` };
                } else if (fc.name === 'getTimers') {
                  result = { timers: timersRef.current };
                } else if (fc.name === 'logObservation') {
                  const { text } = fc.args as any;
                  setLogs(prev => [...prev.slice(-19), { time: new Date().toLocaleTimeString(), text }]);
                  result = { result: "logged" };
                } else if (fc.name === 'getActiveRecipe') {
                  const recipe = activeRecipeRef.current;
                  const step = currentStepRef.current;
                  if (recipe) {
                    result = {
                      title: recipe.title,
                      ingredients: recipe.ingredients,
                      instructions: recipe.instructions,
                      currentStep: step + 1,
                      currentStepText: recipe.instructions?.[step] || '',
                      totalSteps: recipe.instructions?.length || 0,
                    };
                  } else {
                    result = { result: "No active recipe selected" };
                  }
                }

                responses.push({
                  id: fc.id,
                  name: fc.name,
                  response: result
                });
              }

              sessionPromise.then(session => {
                session.sendToolResponse({ functionResponses: responses });
              });
            }
          },
          onclose: (event) => {
            console.log("Gemini Live Session Closed", event);
            toast({
              title: "AI Disconnected",
              description: "The AI session has ended. You can reconnect anytime.",
              variant: "destructive",
            });
            stopSession(true); // Keep camera on
          },
          onerror: (err) => {
            console.error("Gemini Live Error", err);
            setError(`Connection error: ${err?.message || 'Unknown error'}. Please try again.`);
            toast({
              title: "Connection Error",
              description: err?.message || "Failed to connect to AI. Check your API key.",
              variant: "destructive",
            });
            stopSession(true); // Keep camera on
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;

      // --- Video Streaming Loop ---
      videoIntervalRef.current = window.setInterval(async () => {
        if (!videoRef.current || !canvasRef.current || !sessionPromiseRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = video.videoWidth * 0.5;
        canvas.height = video.videoHeight * 0.5;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];

        sessionPromiseRef.current.then(session => {
          session.sendRealtimeInput({
            media: {
              mimeType: 'image/jpeg',
              data: base64
            }
          });
        });
      }, 1000);

    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to connect");
      setIsConnecting(false);
      stopSession();
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 flex flex-col items-center">
      <Header />

      {/* Main Grid - 3 columns on larger screens */}
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full max-w-6xl">
        {/* Left Column: Recipes */}
        <section className="lg:col-span-1 order-3 lg:order-1">
          <RecipePanel
            recipes={recipes}
            activeRecipe={activeRecipe}
            onSelectRecipe={setActiveRecipe}
            onDeleteRecipe={deleteRecipe}
            onAddRecipe={addRecipe}
            onParseUrl={parseRecipeFromUrl}
            onParseFile={parseRecipeFromFile}
            loading={recipesLoading}
          />
        </section>

        {/* Center Column: Vision & Connection */}
        <section className="lg:col-span-1 flex flex-col gap-4 order-1 lg:order-2">
          <CameraFeed
            ref={videoRef}
            isConnected={isConnected}
            isCameraActive={isCameraActive}
            canvasRef={canvasRef}
            cameras={cameras}
            currentCameraIndex={currentCameraIndex}
            useWideAngle={useWideAngle}
            onSwitchCamera={switchCamera}
            onToggleWideAngle={toggleWideAngle}
          />

          {/* Controls */}
          <div className="flex flex-col gap-4">
            <ConnectionButton
              isConnected={isConnected}
              isConnecting={isConnecting}
              onConnect={connectToGemini}
              onDisconnect={stopSession}
            />

            {error && (
              <div className="bg-destructive/20 border border-destructive text-destructive-foreground p-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            {!apiKey && (
              <div className="bg-warning/20 border border-warning text-warning-foreground p-3 rounded-lg text-sm text-center">
                Please configure your Gemini API key to start a session.
              </div>
            )}
          </div>

          <VisionLogs logs={logs} />
        </section>

        {/* Right Column: Active Recipe, Timers & Audio */}
        <section className="flex flex-col gap-4 order-2 lg:order-3">
          {activeRecipe && (
            <ActiveRecipeCard 
              recipe={activeRecipe} 
              currentStep={currentStep}
              onStepChange={setCurrentStep}
            />
          )}
          
          <ConversationIndicator 
            state={conversationState} 
            isConnected={isConnected} 
            volume={volume} 
          />
          
          <TimerSection
            timers={timers}
            onPause={(id) => toggleTimer(id, true)}
            onResume={(id) => toggleTimer(id, false)}
            onDelete={removeTimer}
            onReset={resetTimer}
          />
        </section>
      </main>
    </div>
  );
};
