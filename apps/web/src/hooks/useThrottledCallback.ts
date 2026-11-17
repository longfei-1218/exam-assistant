import { useCallback, useRef } from 'react';

export function useThrottledCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  wait = 800,
) {
  const lastRun = useRef(0);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback(
    (...args: Args) => {
      const now = Date.now();
      if (now - lastRun.current < wait) {
        return;
      }
      lastRun.current = now;
      callbackRef.current(...args);
    },
    [wait],
  );
}
