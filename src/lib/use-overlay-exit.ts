'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Keeps an overlay mounted for the length of its exit animation.
 *
 * Returns a close handler that plays `.modal-exit` / `.drawer-exit` before the
 * parent unmounts the overlay, plus the flag that class needs. Repeated calls
 * collapse into one close, and reduced-motion users close immediately.
 */
export function useOverlayExit(onClose: () => void, isOpen: boolean, duration = 140) {
  const [isClosing, setIsClosing] = useState(false);
  const timerRef = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    setIsClosing(false);
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [isOpen]);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    []
  );

  const requestClose = useCallback(() => {
    if (timerRef.current) return;

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      onCloseRef.current();
      return;
    }

    setIsClosing(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onCloseRef.current();
    }, duration);
  }, [duration]);

  return { requestClose, isClosing };
}
