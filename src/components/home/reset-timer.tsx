'use client';

import { useEffect, useState } from 'react';

// Server daily reset is at 13:00 UTC-7 (which corresponds to 20:00 UTC)
const RESET_HOUR_UTC = 20;
const RESET_MINUTE_UTC = 0;

interface TimerState {
  daily: { hours: number; minutes: number; seconds: number };
  weekly: { days: number; hours: number; minutes: number; seconds: number };
  localResetText: string;
}

function computeTimerState(): TimerState {
  const now = new Date();

  // 1. Daily Reset: 13:00 UTC-7 = 20:00 UTC every day
  const nextDaily = new Date(now);
  nextDaily.setUTCHours(RESET_HOUR_UTC, RESET_MINUTE_UTC, 0, 0);
  if (now.getTime() >= nextDaily.getTime()) {
    nextDaily.setUTCDate(nextDaily.getUTCDate() + 1);
  }
  const diffDaily = Math.max(0, nextDaily.getTime() - now.getTime());

  // 2. Weekly Reset: Monday 13:00 UTC-7 (Monday 20:00 UTC)
  const nextWeekly = new Date(now);
  nextWeekly.setUTCHours(RESET_HOUR_UTC, RESET_MINUTE_UTC, 0, 0);
  let daysUntilMon = (1 - now.getUTCDay() + 7) % 7;
  if (daysUntilMon === 0 && now.getTime() >= nextWeekly.getTime()) {
    daysUntilMon = 7;
  }
  nextWeekly.setUTCDate(now.getUTCDate() + daysUntilMon);
  const diffWeekly = Math.max(0, nextWeekly.getTime() - now.getTime());

  let localText = '13:00 UTC-7';
  try {
    localText = nextDaily.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {}

  return {
    daily: {
      hours: Math.floor(diffDaily / (1000 * 60 * 60)),
      minutes: Math.floor((diffDaily % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((diffDaily % (1000 * 60)) / 1000),
    },
    weekly: {
      days: Math.floor(diffWeekly / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diffWeekly % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((diffWeekly % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((diffWeekly % (1000 * 60)) / 1000),
    },
    localResetText: localText,
  };
}

export function ResetTimer() {
  const [timerState, setTimerState] = useState<TimerState>({
    daily: { hours: 0, minutes: 0, seconds: 0 },
    weekly: { days: 0, hours: 0, minutes: 0, seconds: 0 },
    localResetText: '',
  });

  useEffect(() => {
    setTimerState(computeTimerState());
    const interval = setInterval(() => {
      setTimerState(computeTimerState());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const format2 = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Outer Section Title */}
      <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
        Server Time
      </h2>

      {/* Main Card */}
      <div className="flex-1 p-6 game-card celestial-card border border-border bg-surface-card flex flex-col justify-center gap-5">
        {/* Daily Reset Countdown */}
        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-600 font-medium">
            <span>Next reset in:</span>
            {timerState.localResetText && (
              <span className="text-xs text-slate-500 font-normal">
                ({timerState.localResetText} local)
              </span>
            )}
          </div>
          <div suppressHydrationWarning className="text-2xl sm:text-3xl font-mono font-bold tracking-wider text-slate-900 mt-0.5 tabular-nums">
            {format2(timerState.daily.hours)}:{format2(timerState.daily.minutes)}:{format2(timerState.daily.seconds)}
          </div>
        </div>

        {/* Separator / Rhythm */}
        <div className="w-16 h-px bg-border-subtle mx-auto" />

        {/* Weekly Reset Countdown */}
        <div className="flex flex-col items-center justify-center text-center">
          <span className="text-xs sm:text-sm text-slate-600 font-medium">
            Next weekly reset in:
          </span>
          <div suppressHydrationWarning className="text-2xl sm:text-3xl font-mono font-bold tracking-wider text-slate-800 mt-0.5 tabular-nums">
            {timerState.weekly.days > 0 && (
              <span className="text-slate-600 mr-2 text-xl sm:text-2xl font-normal">
                {timerState.weekly.days}d
              </span>
            )}
            {format2(timerState.weekly.hours)}:{format2(timerState.weekly.minutes)}:{format2(timerState.weekly.seconds)}
          </div>
        </div>
      </div>
    </div>
  );
}
