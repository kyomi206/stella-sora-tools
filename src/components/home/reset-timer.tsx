'use client';

import { useEffect, useState } from 'react';

// Server daily reset is at 13:00 UTC-7 (which corresponds to 20:00 UTC)
const RESET_HOUR_UTC = 20;
const RESET_MINUTE_UTC = 0;

export function ResetTimer() {
  const [dailyTime, setDailyTime] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
  }>({ hours: 0, minutes: 0, seconds: 0 });

  const [weeklyTime, setWeeklyTime] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  const [localResetText, setLocalResetText] = useState<string>('');

  useEffect(() => {
    function calculateTime() {
      const now = new Date();

      // 1. Daily Reset: 13:00 UTC-7 = 20:00 UTC every day
      const nextDaily = new Date(now);
      nextDaily.setUTCHours(RESET_HOUR_UTC, RESET_MINUTE_UTC, 0, 0);
      if (now.getTime() >= nextDaily.getTime()) {
        nextDaily.setUTCDate(nextDaily.getUTCDate() + 1);
      }
      const diffDaily = Math.max(0, nextDaily.getTime() - now.getTime());
      setDailyTime({
        hours: Math.floor(diffDaily / (1000 * 60 * 60)),
        minutes: Math.floor((diffDaily % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diffDaily % (1000 * 60)) / 1000),
      });

      // 2. Weekly Reset: Monday 13:00 UTC-7 (Monday 20:00 UTC)
      const nextWeekly = new Date(now);
      nextWeekly.setUTCHours(RESET_HOUR_UTC, RESET_MINUTE_UTC, 0, 0);
      let daysUntilMon = (1 - now.getUTCDay() + 7) % 7;
      if (daysUntilMon === 0 && now.getTime() >= nextWeekly.getTime()) {
        daysUntilMon = 7;
      }
      nextWeekly.setUTCDate(now.getUTCDate() + daysUntilMon);
      const diffWeekly = Math.max(0, nextWeekly.getTime() - now.getTime());
      setWeeklyTime({
        days: Math.floor(diffWeekly / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diffWeekly % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diffWeekly % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diffWeekly % (1000 * 60)) / 1000),
      });

      // 3. User's local reset time format
      try {
        const timeStr = nextDaily.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        setLocalResetText(timeStr);
      } catch {
        setLocalResetText('13:00 UTC-7');
      }
    }

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const format2 = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Outer Section Title */}
      <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
        Reset Time Information
      </h2>

      {/* Main Card */}
      <div className="flex-1 p-6 game-card celestial-card border border-border bg-surface-card flex flex-col justify-center gap-5">
        {/* Daily Reset Countdown */}
        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-600 font-medium">
            <span>Next reset in:</span>
            {localResetText && (
              <span className="text-xs text-slate-500 font-normal">
                ({localResetText} local)
              </span>
            )}
          </div>
          <div suppressHydrationWarning className="text-2xl sm:text-3xl font-mono font-bold tracking-wider text-slate-900 mt-0.5 tabular-nums">
            {format2(dailyTime.hours)}:{format2(dailyTime.minutes)}:{format2(dailyTime.seconds)}
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
            {weeklyTime.days > 0 && (
              <span className="text-slate-600 mr-2 text-xl sm:text-2xl font-normal">
                {weeklyTime.days}d
              </span>
            )}
            {format2(weeklyTime.hours)}:{format2(weeklyTime.minutes)}:{format2(weeklyTime.seconds)}
          </div>
        </div>
      </div>
    </div>
  );
}
