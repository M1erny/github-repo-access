import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, Type } from '@google/genai';
import type { FunctionDeclaration, LiveServerMessage } from '@google/genai';
import { Timer, VisionLog } from '@/types/chef';
import { base64ToUint8Array, decodeAudioData, createPcmBlob } from '@/services/audioUtils';
import { Header } from './Header';
import { CameraFeed } from './CameraFeed';
import { ConnectionButton } from './ConnectionButton';
import { VisionLogs } from './VisionLogs';
import { AudioVisualizerSection } from './AudioVisualizer';
import { TimerSection } from './TimerSection';
import { RecipePanel } from './RecipePanel';
import { ActiveRecipeCard } from './ActiveRecipeCard';
import { useRecipes, Recipe } from '@/hooks/useRecipes';
import { toast } from '@/hooks/use-toast';

// --- Tool Definitions ---
const createTimerTool: FunctionDeclaration = {
  name: 'createTimer',
  description: 'Create a new cooking timer. Use this when the user asks or when you visually observe an event requiring a timer (e.g. pasta entering water).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      label: { type: Type.STRING, description: 'Label for the timer (e.g., Pasta, Chicken, Rice)' },
      durationSeconds: { type: Type.NUMBER, description: 'Duration in seconds' },
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
  description: 'Log a brief visual observation of the video feed. Call this tool FREQUENTLY (every 2-3 seconds) to describe the scene.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      text: { type: Type.STRING, description: 'Literal description of the visual scene (e.g. "Empty pot on stove", "Hand holding a red onion"). Do not hallucinate.' },
    },
    required: ['text'],
  },
};

const getActiveRecipeTool: FunctionDeclaration = {
  name: 'getActiveRecipe',
  description: 'Get the currently active recipe the user is cooking, including ingredients and step-by-step instructions.',
  parameters: { type: Type.OBJECT, properties: {} },
};

interface ChefAppProps {
  apiKey: string | null;
}

export const ChefApp: React.FC<ChefAppProps> = ({ apiKey }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const [timers, setTimers] = useState<Timer[]>([]);
  const [logs, setLogs] = useState<VisionLog[]>([]);
  const [error, setError] = useState<string | null>(null);

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
  }, [activeRecipe]);

  // --- Audio/Video Cleanup ---
  const stopSession = useCallback(() => {
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

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    sessionPromiseRef.current = null;
    setIsConnected(false);
    setIsSpeaking(false);
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

  // Build system instruction with active recipe context
  const buildSystemInstruction = () => {
    let instruction = `You are Chef G-Mini, an elite expert chef and kitchen assistant.

YOUR CAPABILITIES:
1. You can SEE via the user's camera.
2. You can HEAR the user.
3. You can MANAGE TIMERS.
4. You can ACCESS the user's saved recipes using the getActiveRecipe tool.

CRITICAL INSTRUCTION FOR VISION:
- You MUST act as a LITERAL OBSERVER.
- Use the 'logObservation' tool CONSTANTLY (every few seconds) to describe exactly what is in the frame.
- Describe ingredients, cookware, steam, colors, and actions.
- If the view is unclear, say "Vision unclear".
- DO NOT HALLUCINATE ingredients that are not visible.

RECIPE GUIDANCE - THIS IS YOUR PRIMARY FUNCTION:
- When a recipe is active, you are the user's cooking guide. Proactively help them through each step!
- Call 'getActiveRecipe' frequently to check the current recipe and track progress.
- Guide users step-by-step: "Now we're on step 3: sauté the onions until golden..."
- When you see them complete a step, congratulate them and move to the next.
- Suggest timers for cooking steps: "This needs to simmer for 10 minutes, want me to set a timer?"
- If they seem stuck, offer tips: "I see you're chopping - remember to dice the onion finely for this recipe."
- Answer questions about the recipe: ingredients, substitutions, techniques.
- Warn about common mistakes: "Be careful not to overcook the garlic, it burns quickly!"

COOKING ASSISTANCE:
- If you see water boiling or ingredients being added, offer to set a timer.
- If the user asks about ingredients, look at what is on the table and suggest what goes well with them.
- Keep your audio responses concise and helpful, like a busy head chef.`;

    if (activeRecipeRef.current) {
      instruction += `

ACTIVE RECIPE - "${activeRecipeRef.current.title}":
You are ACTIVELY guiding the user through this recipe. Be proactive!

INGREDIENTS NEEDED:
${activeRecipeRef.current.ingredients?.map((ing, i) => `${i + 1}. ${ing}`).join('\n') || 'No ingredients listed'}

STEP-BY-STEP INSTRUCTIONS:
${activeRecipeRef.current.instructions?.map((step, i) => `Step ${i + 1}: ${step}`).join('\n') || 'No instructions listed'}

Start by greeting them and asking which step they're on, or if they're ready to begin from step 1.`;
    } else {
      instruction += `

No recipe is currently selected. If the user wants to cook something, suggest they add a recipe from the panel on the left, or you can help them freestyle cook based on what you see!`;
    }

    return instruction;
  };

  // --- Gemini Connection ---
  const connectToGemini = async () => {
    if (!apiKey) {
      setError("API Key not configured. Please add your Gemini API key.");
      return;
    }

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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15 }
        }
      });
      mediaStreamRef.current = stream;

      // Setup Video Preview
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
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
        model: 'gemini-2.5-flash-preview-native-audio-dialog',
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
            console.log("Gemini Live Session Opened");
            toast({
              title: "Connected",
              description: activeRecipeRef.current 
                ? `Chef G-Mini is ready to guide you through "${activeRecipeRef.current.title}"!`
                : "Chef G-Mini is ready to help!",
            });
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Handle Audio Output
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              setIsSpeaking(true);
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
                if (sourcesRef.current.size === 0) setIsSpeaking(false);
              };
            }

            // Handle Tool Calls
            if (msg.toolCall) {
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
                  if (recipe) {
                    result = {
                      title: recipe.title,
                      ingredients: recipe.ingredients,
                      instructions: recipe.instructions,
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
          onclose: () => {
            console.log("Gemini Live Session Closed");
            stopSession();
          },
          onerror: (err) => {
            console.error("Gemini Live Error", err);
            setError("Connection error. Please try again.");
            stopSession();
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
            canvasRef={canvasRef}
          />

          {/* Controls */}
          <div className="flex flex-col gap-4">
            <ConnectionButton
              isConnected={isConnected}
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
          {activeRecipe && <ActiveRecipeCard recipe={activeRecipe} />}
          
          <AudioVisualizerSection isSpeaking={isSpeaking} volume={volume} />
          
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
