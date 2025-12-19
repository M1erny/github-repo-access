import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, Type } from '@google/genai';
import type { FunctionDeclaration, LiveServerMessage } from '@google/genai';
import { ChefHat, Camera, Mic } from 'lucide-react';
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
import { DiagnosticPanel, DiagnosticInfo, ModelActivity } from './DiagnosticPanel';
import { useRecipes, Recipe } from '@/hooks/useRecipes';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Constants for model configuration
// Using native audio model - supports text, audio, AND video according to Live API docs
const GEMINI_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
const API_VERSION = 'v1alpha';

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
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  
  const [diagnosticInfo, setDiagnosticInfo] = useState<DiagnosticInfo>({
    connectionStatus: 'disconnected',
    modelName: GEMINI_MODEL,
    apiVersion: API_VERSION,
    tokenUsage: { inputTokens: 0, outputTokens: 0 },
    sessionStartTime: null,
    hasVideo: false,
    hasAudio: false,
    lastError: null,
    messagesSent: 0,
    messagesReceived: 0,
    lastActivity: null,
    activityLog: [],
  });
  
  // Helper to log model activity
  const logActivity = (type: ModelActivity['type'], message: string) => {
    const activity: ModelActivity = { type, message, timestamp: new Date() };
    setDiagnosticInfo(prev => ({
      ...prev,
      lastActivity: activity,
      activityLog: [...prev.activityLog.slice(-9), activity], // Keep last 10
    }));
  };

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
    parseRecipeFromText,
  } = useRecipes();

  // Refs
  const timersRef = useRef<Timer[]>([]);
  const activeRecipeRef = useRef<Recipe | null>(null);
  const currentStepRef = useRef<number>(0);
  const nextStartTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // If we have an active session, inform the AI about the recipe change
    if (sessionPromiseRef.current && activeRecipe) {
      sessionPromiseRef.current.then(session => {
        session.sendRealtimeInput({
          text: `[SYSTEM UPDATE] The user has selected a new recipe: "${activeRecipe.title}".
Ingredients: ${activeRecipe.ingredients.join(', ')}
Instructions: ${activeRecipe.instructions.join('\n')}
Please update your context to this recipe.`
        });
        console.log('Sent recipe context update to AI');
      });
    }
  }, [activeRecipe]);

  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  // Enumerate available cameras on mount (graceful - don't block if no camera)
  useEffect(() => {
    const enumerateCameras = async () => {
      try {
        // Check if mediaDevices is available
        if (!navigator.mediaDevices?.getUserMedia) {
          console.warn('MediaDevices API not available');
          return;
        }
        // Request permission first to get device labels
        const testStream = await navigator.mediaDevices.getUserMedia({ video: true });
        testStream.getTracks().forEach(t => t.stop());
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setCameras(videoDevices);
        console.log('Found cameras:', videoDevices.length);
      } catch (e) {
        // Camera not available is OK - we'll fall back to audio-only
        console.warn('Could not enumerate cameras (will use audio-only):', e);
      }
    };
    enumerateCameras();
  }, []);

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
      try { source.stop(); } catch (e) { /* ignore */ }
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
    
    // Update diagnostics
    setDiagnosticInfo(prev => ({
      ...prev,
      connectionStatus: 'disconnected',
      hasVideo: false,
      hasAudio: false,
    }));
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

            // Notify AI about timer completion
            if (sessionPromiseRef.current) {
              sessionPromiseRef.current.then(session => {
                const recipeName = activeRecipeRef.current?.title || '';
                session.sendRealtimeInput({
                  text: `[TIMER ALERT] The "${timer.label}" timer just finished!${recipeName ? ` Recipe: ${recipeName}.` : ''} Tell the user immediately what to do next based on the recipe or cooking context. Be concise and actionable.`
                });
                console.log(`Timer "${timer.label}" finished - notified AI`);
              }).catch(err => {
                console.warn('Could not notify AI about timer completion:', err);
              });
            }

            return { ...timer, durationRemaining: 0, status: 'finished' };
          }
          return { ...timer, durationRemaining: Math.max(0, nextRemaining) };
        });
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // --- Timer Actions ---
  const addTimer = (label: string, durationSeconds: number, reason?: string) => {
    const newTimer: Timer = {
      id: Math.random().toString(36).substring(7),
      label,
      durationOriginal: durationSeconds,
      durationRemaining: durationSeconds,
      status: 'running',
    };
    setTimers(prev => [...prev, newTimer]);
    toast({
      title: reason ? "👁️ Proactive Timer Started!" : "Timer Created",
      description: reason
        ? `${reason} -> Set ${label} for ${Math.floor(durationSeconds / 60)}m`
        : `${label} - ${Math.floor(durationSeconds / 60)}:${(durationSeconds % 60).toString().padStart(2, '0')}`,
      variant: reason ? "default" : "default", // You could use a special variant if available
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
              aspectRatio: { ideal: 16 / 9 },
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

  // Track recently created timers to avoid duplicates
  const recentTimerLabelsRef = useRef<Set<string>>(new Set());

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
          activeRecipe: activeRecipeRef.current ? {
            title: activeRecipeRef.current.title,
            ingredients: activeRecipeRef.current.ingredients,
            instructions: activeRecipeRef.current.instructions
          } : null
        }
      });

      if (error) {
        console.error('Vision analysis error:', error);
        return;
      }

      // Log the description
      if (data?.description) {
        setLogs(prev => [...prev.slice(-19), {
          time: new Date().toLocaleTimeString(),
          text: data.description
        }]);
      }

      // Handle timer suggestion from vision AI
      if (data?.timerSuggestion) {
        const suggestion = data.timerSuggestion;
        const labelKey = suggestion.label.toLowerCase();

        // Check if we already have an active timer for this item or recently created one
        const hasExistingTimer = timersRef.current.some(
          t => t.label.toLowerCase().includes(labelKey) || labelKey.includes(t.label.toLowerCase())
        );
        const recentlyCreated = recentTimerLabelsRef.current.has(labelKey);

        if (!hasExistingTimer && !recentlyCreated && suggestion.durationSeconds > 0) {
          console.log('Vision detected cooking event, creating timer:', suggestion);

          addTimer(suggestion.label, suggestion.durationSeconds, suggestion.reason);

          // Track this timer to avoid duplicates for 30 seconds
          recentTimerLabelsRef.current.add(labelKey);
          setTimeout(() => {
            recentTimerLabelsRef.current.delete(labelKey);
          }, 30000);

          // Log the timer creation reason
          if (suggestion.reason) {
            setLogs(prev => [...prev.slice(-19), {
              time: new Date().toLocaleTimeString(),
              text: `⏲️ Timer created: ${suggestion.reason}`
            }]);
          }
        }
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

TIMER NOTIFICATIONS:
When you receive a [TIMER ALERT] message, IMMEDIATELY respond by:
1. Acknowledge the timer completion verbally (e.g., "Your pasta is ready!")
2. Give the specific next action based on the recipe or cooking context (e.g., "Drain it now and toss with the sauce")
3. If there's a recipe active, call getActiveRecipe to reference the next relevant step
4. Be concise and urgent - this is a time-sensitive moment

VISION LOGGING:
- Call 'logObservation' every 5-10 seconds when you notice cooking activity
- Focus on cooking actions: "adding ingredients", "stirring", "checking doneness"

CONVERSATION STYLE:
- Be helpful and conversational
- When guiding through a recipe, reference exact step numbers and ingredients
- Proactively suggest the next step when you see them complete one
- IMPORTANT: ALWAYS speak in English, regardless of what language the user speaks or the recipe language.`;

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
    
    // Update diagnostics to connecting state
    setDiagnosticInfo(prev => ({
      ...prev,
      connectionStatus: 'connecting',
      lastError: null,
    }));

    try {
      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const inputCtx = new AudioContextClass({ sampleRate: 16000 });
      const outputCtx = new AudioContextClass({ sampleRate: 24000 });

      inputContextRef.current = inputCtx;
      audioContextRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      // Request Media Stream - always request video + audio (Live API supports both)
      const deviceId = cameras[currentCameraIndex]?.deviceId;

      let stream: MediaStream;
      
      try {
        console.log('Requesting video + audio for Live API...');
        console.log('Device ID:', deviceId || 'default');
        
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
            width: { ideal: useWideAngle ? 1280 : 640 },
            height: { ideal: useWideAngle ? 720 : 480 },
            frameRate: { ideal: 15 },
            ...(useWideAngle ? { aspectRatio: { ideal: 16 / 9 } } : {}),
          },
        });
        
        console.log('Media stream obtained:', {
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          videoTrackLabel: stream.getVideoTracks()[0]?.label || 'none',
        });
        logActivity('connection', `Camera: ${stream.getVideoTracks()[0]?.label || 'active'}`);
      } catch (err) {
        console.error("Video capture failed:", err);
        logActivity('connection', `Video failed: ${err instanceof Error ? err.message : 'Unknown error'} - using audio only`);
        toast({
          title: "Camera Unavailable",
          description: "Using audio-only mode. Check camera permissions.",
          variant: "destructive",
        });
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      mediaStreamRef.current = stream;
      const hasVideo = stream.getVideoTracks().length > 0;
      const hasAudio = stream.getAudioTracks().length > 0;
      
      // Update diagnostics with media info
      setDiagnosticInfo(prev => ({
        ...prev,
        hasVideo,
        hasAudio,
      }));

      // Setup Video Preview (if available)
      console.log('Setting up video preview, hasVideo:', hasVideo);
      
      if (videoRef.current) {
        videoRef.current.srcObject = hasVideo ? stream : null;
        console.log('Video srcObject set:', hasVideo ? 'stream assigned' : 'null');
      }

      if (hasVideo && videoRef.current) {
        setIsCameraActive(true);
        logActivity('connection', `Camera active: ${stream.getVideoTracks()[0]?.label || 'Unknown camera'}`);
        try {
          await videoRef.current.play();
          console.log('Video playback started successfully');
        } catch (playError) {
          console.warn('Autoplay blocked, video will play on user interaction:', playError);
          logActivity('connection', 'Video autoplay blocked - tap to start');
        }
      } else {
        setIsCameraActive(false);
        console.log('Camera inactive - no video tracks available');
        if (!hasVideo) {
          logActivity('connection', 'No video tracks - audio only mode');
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
      // NOTE: `apiKey` is an ephemeral token generated by our backend.
      const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } });

      console.log('Connecting to Gemini with model:', GEMINI_MODEL);

      const sessionPromise = ai.live.connect({
        model: GEMINI_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          thinkingConfig: {
            thinkingBudget: 1024,
            includeThoughts: true
          },
          enableAffectiveDialog: true,
          proactivity: {
            proactiveAudio: true
          },
          outputAudioTranscription: {},
          inputAudioTranscription: {},
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
            console.log("Gemini Live Session Opened with model:", GEMINI_MODEL);
            
            // Update diagnostics and log connection
            setDiagnosticInfo(prev => ({
              ...prev,
              connectionStatus: 'connected',
              sessionStartTime: new Date(),
              messagesSent: 0,
              messagesReceived: 0,
              activityLog: [],
              modelName: GEMINI_MODEL,
            }));
            logActivity('connection', `Connected to ${GEMINI_MODEL}`);
            
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
                try { source.stop(); } catch (e) { /* ignore */ }
              });
              sourcesRef.current.clear();
              nextStartTimeRef.current = audioContextRef.current?.currentTime || 0;
            }

            // Handle Transcriptions
            if (msg.serverContent?.inputTranscription) {
              const text = msg.serverContent.inputTranscription.text;
              if (text) {
                setLogs((prev) => [...prev.slice(-19), {
                  time: new Date().toLocaleTimeString(),
                  text: `🎤 You: ${text}`
                }]);
                logActivity('input', `User: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`);
                setDiagnosticInfo(prev => ({ ...prev, messagesSent: prev.messagesSent + 1 }));
              }
            }

            if (msg.serverContent?.outputTranscription) {
              const text = msg.serverContent.outputTranscription.text;
              if (text) {
                setLogs((prev) => [...prev.slice(-19), {
                  time: new Date().toLocaleTimeString(),
                  text: `🤖 Chef: ${text}`
                }]);
                logActivity('output', `AI: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`);
                setDiagnosticInfo(prev => ({ ...prev, messagesReceived: prev.messagesReceived + 1 }));
              }
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
                let result: Record<string, unknown> = { result: "ok" };
                
                // Log tool call activity
                logActivity('tool_call', `Tool: ${fc.name}`);

                if (fc.name === 'createTimer') {
                  const { label, durationSeconds } = fc.args as { label: string; durationSeconds: number };
                  addTimer(label, durationSeconds);
                  result = { result: `Timer '${label}' set for ${durationSeconds}s` };
                } else if (fc.name === 'getTimers') {
                  result = { timers: timersRef.current };
                } else if (fc.name === 'logObservation') {
                  const { text } = fc.args as { text: string };
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
            const code = (event as CloseEvent | undefined)?.code;
            const reason = (event as CloseEvent | undefined)?.reason;
            console.log("Gemini Live Session Closed", { code, reason, event });

            const errorMsg = `AI session closed${code ? ` (code ${code})` : ''}${reason ? `: ${reason}` : ''}`;
            setError(errorMsg);
            
            // Update diagnostics
            setDiagnosticInfo(prev => ({
              ...prev,
              connectionStatus: 'disconnected',
              lastError: errorMsg,
            }));

            toast({
              title: "AI Disconnected",
              description: code || reason
                ? `Session closed${code ? ` (code ${code})` : ''}${reason ? `: ${reason}` : ''}`
                : "The AI session has ended. You can reconnect anytime.",
              variant: "destructive",
            });
            stopSession(true); // Keep camera on
          },
          onerror: (err) => {
            console.error("Gemini Live Error", err);
            const errorMsg = `Connection error: ${err?.message || 'Unknown error'}. Please try again.`;
            setError(errorMsg);
            
            // Update diagnostics
            setDiagnosticInfo(prev => ({
              ...prev,
              connectionStatus: 'disconnected',
              lastError: errorMsg,
            }));
            
            toast({
              title: "Connection Error",
              description: err?.message || "Failed to connect to AI. Check your API key.",
              variant: "destructive",
            });
            stopSession(true); // Keep camera on
          }
        }
      });

      // Surface promise rejections (some failures won't trigger callbacks)
      sessionPromise.catch((err: any) => {
        console.error("Gemini Live connect failed", err);
        const msg = err?.message || String(err);
        setError(`Connection failed: ${msg}`);
        toast({
          title: "Connection Failed",
          description: msg,
          variant: "destructive",
        });
        stopSession(true);
      });

      sessionPromiseRef.current = sessionPromise;

      // --- Video Streaming Loop ---
      // Send frames more frequently (was 1000ms, now 200ms for smoother vision)
      if (hasVideo) {
        videoIntervalRef.current = window.setInterval(async () => {
          if (!videoRef.current || !canvasRef.current || !sessionPromiseRef.current) return;

          const video = videoRef.current;
          if (video.videoWidth === 0 || video.videoHeight === 0) return;

          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          // Use fixed resolution for consistency
          const targetWidth = 640;
          const aspectRatio = video.videoWidth / video.videoHeight;
          const targetHeight = targetWidth / aspectRatio;

          canvas.width = targetWidth;
          canvas.height = targetHeight;

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];

          sessionPromiseRef.current.then(session => {
            session.sendRealtimeInput({
              media: {
                mimeType: 'image/jpeg',
                data: base64
              }
            });
          });
        }, 200);
      }

    } catch (e: unknown) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : "Failed to connect";
      setError(errorMessage);
      setIsConnecting(false);
      stopSession();
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 flex flex-col items-center">
      <Header />

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full max-w-6xl mt-4">
        {/* Left Column: Recipes - ALWAYS accessible */}
        <section className="lg:col-span-1 order-3 lg:order-1">
          <RecipePanel
            recipes={recipes}
            activeRecipe={activeRecipe}
            onSelectRecipe={setActiveRecipe}
            onDeleteRecipe={deleteRecipe}
            onAddRecipe={addRecipe}
            onParseUrl={parseRecipeFromUrl}
            onParseFile={parseRecipeFromFile}
            onParseText={parseRecipeFromText}
            loading={recipesLoading}
          />
        </section>

        {/* Center Column: Vision & Connection */}
        <section className="lg:col-span-1 flex flex-col gap-4 order-1 lg:order-2">
          {/* Show welcome hero when not connected, camera when connected */}
          {!isConnected ? (
            <div className="aspect-video bg-card rounded-2xl border border-border shadow-lg flex flex-col items-center justify-center p-6 text-center">
              <div className="relative mb-4">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                <div className="relative bg-background p-4 rounded-full border border-primary/20">
                  <ChefHat className="w-12 h-12 text-primary" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Chef G-Mini</h2>
              <p className="text-sm text-muted-foreground mb-4">
                {activeRecipe
                  ? `Ready to guide you through "${activeRecipe.title}"`
                  : "Add a recipe or start cooking freestyle"
                }
              </p>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Camera className="w-3 h-3" /> Vision</span>
                <span className="flex items-center gap-1"><Mic className="w-3 h-3" /> Voice</span>
              </div>
            </div>
          ) : (
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
          )}

          {/* Controls */}
          <div className="flex flex-col gap-4">
            <ConnectionButton
              isConnected={isConnected}
              isConnecting={isConnecting}
              onConnect={connectToGemini}
              onDisconnect={() => stopSession(false)}
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

          {/* Vision logs only when connected */}
          {isConnected && <VisionLogs logs={logs} />}
        </section>

        {/* Right Column */}
        <section className="flex flex-col gap-4 order-2 lg:order-3">
          {activeRecipe && (
            <ActiveRecipeCard
              recipe={activeRecipe}
              currentStep={currentStep}
              onStepChange={setCurrentStep}
            />
          )}

          {/* Only show conversation indicator when connected */}
          {isConnected && (
            <ConversationIndicator
              state={conversationState}
              isConnected={isConnected}
              volume={volume}
            />
          )}

          <TimerSection
            timers={timers}
            onPause={(id) => toggleTimer(id, true)}
            onResume={(id) => toggleTimer(id, false)}
            onDelete={removeTimer}
            onReset={resetTimer}
          />
        </section>
      </main>
      
      {/* Diagnostic Panel */}
      <DiagnosticPanel
        info={diagnosticInfo}
        isOpen={showDiagnostics}
        onToggle={() => setShowDiagnostics(!showDiagnostics)}
      />
    </div>
  );
};
