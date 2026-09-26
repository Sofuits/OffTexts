import { useCallback, useEffect, useState } from 'react';

/**
 * A countdown to when an action may be repeated — "Send a new code in 42s".
 *
 * Shared by the sign-up and password-reset code screens, which both have to
 * wait out the same server-side limit on sending another email.
 */

/** Seconds remaining until `until`, never negative. */
const secondsUntil = (until: number | null): number =>
  until === null ? 0 : Math.max(0, Math.ceil((until - Date.now()) / 1000));

/** @param initialSeconds A countdown already running when the screen opens, or null. */
export function useCountdown(initialSeconds: number | null): {
  secondsLeft: number;
  start: (seconds: number) => void;
} {
  const [until, setUntil] = useState<number | null>(() =>
    initialSeconds === null ? null : Date.now() + initialSeconds * 1000,
  );
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds ?? 0);

  useEffect(() => {
    if (until === null) return;

    // Recomputed from the end time on every tick rather than decremented, so a
    // backgrounded app comes back showing the right number, not a paused one.
    const timer = setInterval(() => {
      const left = secondsUntil(until);
      setSecondsLeft(left);
      if (left === 0) {
        clearInterval(timer);
        setUntil(null);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [until]);

  const start = useCallback((seconds: number) => {
    setUntil(Date.now() + seconds * 1000);
    setSecondsLeft(seconds);
  }, []);

  return { secondsLeft, start };
}
