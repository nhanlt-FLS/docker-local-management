import { useEffect, useRef } from 'react';

/**
 * Declarative setInterval. The latest callback is used without restarting the
 * timer on every render. Pass null as the delay to pause polling.
 */
export function useInterval(
  callback: () => void,
  delay: number | null,
  pauseWhenHidden = true,
): void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return undefined;

    const intervalId = window.setInterval(() => {
      if (!pauseWhenHidden || !document.hidden) callbackRef.current();
    }, delay);

    return () => window.clearInterval(intervalId);
  }, [delay, pauseWhenHidden]);
}
