import { useEffect, useState } from 'react';

/**
 * The current time, as state that actually updates.
 *
 * Reading `Date.now()` during a render is a bug even when it looks harmless:
 * the value is captured at whatever moment React happened to re-render, so two
 * renders disagree and nothing re-runs when the clock moves. The booking screen
 * is the case that makes it visible — a member opens the time list at 4:58,
 * thinks for five minutes, and 5:00 is still offered because nothing told the
 * screen the time had passed.
 *
 * A minute is the right default. Anything faster re-renders a screen nobody is
 * looking at; anything slower and a slot can be offered after it has gone.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
