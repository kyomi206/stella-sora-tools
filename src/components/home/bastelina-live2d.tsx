'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Sparkles } from 'lucide-react';

const INTERACTION_MOTIONS = ['ChatA', 'ChatB', 'ChatC', 'ChatD', 'ChatE'];

export function BastelinaLive2D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const l2dInstanceRef = useRef<any>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const lastMotionRef = useRef<string>('');
  const lastInteractTimeRef = useRef<number>(0);

  // Initialize saved minimize state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sstt_bastelina_minimized');
      if (saved === 'true') {
        setIsMinimized(true);
      }
    } catch {
      // localStorage may fail in private mode
    }
  }, []);

  // Trigger a random interaction motion (ChatA..ChatE)
  const playRandomInteraction = useCallback((cooldownMs = 600) => {
    if (!l2dInstanceRef.current) return;

    const now = Date.now();
    if (now - lastInteractTimeRef.current < cooldownMs) return;
    lastInteractTimeRef.current = now;

    const candidates = INTERACTION_MOTIONS.filter((m) => m !== lastMotionRef.current);
    const chosen = candidates[Math.floor(Math.random() * candidates.length)] || INTERACTION_MOTIONS[0];
    lastMotionRef.current = chosen;

    try {
      const motions = l2dInstanceRef.current.getMotions?.() || {};
      if (motions[chosen]) {
        l2dInstanceRef.current.playMotion(chosen, 0, 3);
      } else if (motions.TapBody) {
        l2dInstanceRef.current.playMotion('TapBody', undefined, 3);
      } else if (motions.Idle) {
        l2dInstanceRef.current.playMotion('Idle', 0, 3);
      }
    } catch (err) {
      console.warn('[Bastelina] Motion trigger error:', err);
    }
  }, []);

  const playRandomInteractionRef = useRef(playRandomInteraction);
  useEffect(() => {
    playRandomInteractionRef.current = playRandomInteraction;
  });

  // Manage render loop and play interaction when tab visibility changes
  useEffect(() => {
    if (!isLoaded || isMinimized) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Pause WebGL rendering loop when tab is backgrounded
        l2dInstanceRef.current?.stop?.();
      } else if (document.visibilityState === 'visible') {
        // Resume WebGL rendering loop and greet user
        l2dInstanceRef.current?.start?.();
        setTimeout(() => {
          playRandomInteractionRef.current(1000);
        }, 300);
      }
    };

    const handleFocus = () => {
      l2dInstanceRef.current?.start?.();
      setTimeout(() => {
        playRandomInteractionRef.current(1000);
      }, 300);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isLoaded, isMinimized]);

  // Load Live2D Model
  useEffect(() => {
    if (isMinimized) return;

    let isMounted = true;
    let l2d: any = null;

    const disableMouseTracking = (instance: any) => {
      try {
        const l2d6 = instance?._state?.l2d6Model;
        if (l2d6) {
          if (l2d6.mouseMoveEventListener) {
            document.removeEventListener('mousemove', l2d6.mouseMoveEventListener);
            l2d6.mouseMoveEventListener = null;
          }
          if (l2d6.mouseEndedEventListener) {
            document.removeEventListener('mouseout', l2d6.mouseEndedEventListener);
            l2d6.mouseEndedEventListener = null;
          }
          l2d6.onMouseMove = () => {};
          l2d6.onMouseEnd = () => {};
          l2d6._subdelegates?.[0]?.getLive2DManager()?.onDrag(0, 0);
        }

        const l2d2 = instance?._state?.l2d2Model;
        if (l2d2?._boundMouseEvent) {
          document.removeEventListener('mousemove', l2d2._boundMouseEvent);
        }
      } catch (err) {
        console.warn('[Bastelina] Failed to disable mouse tracking:', err);
      }
    };

    if (typeof window !== 'undefined') {
      (window as any).__L2D_MAX_DPR = 1.25;
    }

    import('l2d')
      .then(({ init }) => {
        if (!isMounted || !canvasRef.current) return;

        try {
          l2d = init(canvasRef.current);
          l2dInstanceRef.current = l2d;
          disableMouseTracking(l2d);

          if (typeof window !== 'undefined') {
            (window as any).__sstt_bastelina = l2d;
          }

          l2d.on('loaded', () => {
            if (!isMounted) return;
            setIsLoaded(true);
            setLoadError(false);
            disableMouseTracking(l2d);

            // Greet user with a random interaction when switching to Home
            setTimeout(() => {
              if (isMounted) {
                playRandomInteractionRef.current(0);
              }
            }, 300);
          });

          l2d.load({
            path: '/live2d/bastelina/bastelina.model3.json',
            scale: 1.38,
            position: [0.22, -0.415],
            logLevel: 'warn',
          }).catch((err: any) => {
            console.error('[Bastelina] Failed to load model:', err);
            if (isMounted) setLoadError(true);
          });
        } catch (err) {
          console.error('[Bastelina] Init error:', err);
          if (isMounted) setLoadError(true);
        }
      })
      .catch((err) => {
        console.error('[Bastelina] Dynamic import error:', err);
        if (isMounted) setLoadError(true);
      });

    return () => {
      isMounted = false;
      if (l2d) {
        try {
          l2d.destroy();
        } catch (e) {
          console.warn('[Bastelina] Cleanup warning:', e);
        }
      }
      l2dInstanceRef.current = null;
      if (typeof window !== 'undefined') {
        delete (window as any).__sstt_bastelina;
      }
    };
  }, [isMinimized]);

  const toggleMinimize = (minimized: boolean) => {
    setIsMinimized(minimized);
    try {
      localStorage.setItem('sstt_bastelina_minimized', minimized ? 'true' : 'false');
    } catch {}
  };

  if (loadError) {
    return null;
  }

  // Minimized Floating Pill Mode
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-20 hidden lg:block">
        <button
          type="button"
          onClick={() => toggleMinimize(false)}
          className="group flex items-center gap-2.5 px-3 py-2 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-md hover:shadow-lg transition-all duration-200 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer"
          title="Show Bastelina"
        >
          <div className="size-6 rounded-full overflow-hidden bg-sky-100 dark:bg-sky-950/60 ring-1 ring-amber-400/50 flex-shrink-0">
            <img src="/bastelina.png" alt="Bastelina" className="size-full object-contain" />
          </div>
          <span>Bastelina</span>
          <Sparkles className="size-3.5 text-amber-500 group-hover:rotate-12 transition-transform" />
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="Bastelina Mascot"
      className="fixed bottom-0 -right-6 2xl:-right-2 z-20 pointer-events-none select-none hidden lg:block group"
    >
      <div className="relative flex flex-col items-center">
        {/* Floating Minimize Button (Appears on Hover) */}
        <div className="pointer-events-auto absolute top-6 right-4 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            type="button"
            onClick={() => toggleMinimize(true)}
            className="p-1.5 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 shadow-sm transition-colors cursor-pointer"
            title="Minimize"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Live2D Canvas (Non-blocking, isolated GPU layer, passes clicks through) */}
        <div
          className={`relative pointer-events-none transition-opacity duration-500 transform-gpu ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ transform: 'translateZ(0)' }}
        >
          <canvas
            ref={canvasRef}
            className="pointer-events-none w-[420px] h-[720px] 2xl:w-[480px] 2xl:h-[780px] object-contain"
            style={{ width: '420px', height: '720px' }}
          />

          {/* Narrow Hit-Box strictly over Bastelina's Figure */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => playRandomInteractionRef.current(600)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                playRandomInteractionRef.current(600);
              }
            }}
            aria-label="Interact with Bastelina"
            className="pointer-events-auto absolute bottom-0 right-2 w-[180px] 2xl:w-[210px] h-[640px] 2xl:h-[700px] cursor-pointer rounded-t-[80px] focus:outline-none"
            title="Click to interact with Bastelina"
          />
        </div>
      </div>
    </aside>
  );
}
