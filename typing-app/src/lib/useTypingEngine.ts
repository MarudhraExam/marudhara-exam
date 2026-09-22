import { useCallback, useEffect, useRef, useState } from 'react';
import type { TypingStats } from '@/types';
import type { LayoutAdapter } from '@/lib/adapters/LayoutAdapter';

export interface TypingEngineState extends TypingStats {
  typed: string;
  expectedChar: string;
  isRunning: boolean;
}

interface UseTypingEngineOptions {
  text: string;
  adapter: LayoutAdapter;
  durationSeconds?: number;
  onComplete?: (stats: TypingStats) => void;
}

function toChars(str: string): string[] {
  return Array.from(str);
}

export function useTypingEngine({
  text,
  adapter,
  durationSeconds,
  onComplete,
}: UseTypingEngineOptions) {
  const targetChars = useRef<string[]>([]);
  const typedRef = useRef<string[]>([]);
  const errorsRef = useRef(0);
  const backspacesRef = useRef(0);
  const correctCharsRef = useRef(0);
  const wrongCharsRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);
  const adapterRef = useRef(adapter);

  useEffect(() => {
    adapterRef.current = adapter;
  }, [adapter]);

  const [typed, setTyped] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  // Reset when text or adapter changes. The adapter converts Unicode
  // practice text to the engine's comparison encoding (e.g. Kruti Dev ASCII).
  useEffect(() => {
    targetChars.current = toChars(adapter.toTargetText(text));
    typedRef.current = [];
    errorsRef.current = 0;
    backspacesRef.current = 0;
    correctCharsRef.current = 0;
    wrongCharsRef.current = 0;
    startTimeRef.current = null;
    completedRef.current = false;
    setTyped('');
    setElapsed(0);
    setIsRunning(false);
    setFinished(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [text, adapter]);

  const computeStats = useCallback((): TypingStats => {
    const secs = startTimeRef.current
      ? (Date.now() - startTimeRef.current) / 1000
      : 0;
    const elapsedSec = Math.max(secs, 1);
    const typedArr = typedRef.current;
    const target = targetChars.current;
    const totalTyped = typedArr.length;
    const correct = correctCharsRef.current;
    const accuracy = totalTyped > 0 ? (correct / totalTyped) * 100 : 100;
    // WPM = (correct characters / 5) / minutes.
    // For Hindi, each Unicode code point (consonant, matra, halant) counts
    // as one character. This is the standard 5-char-per-word convention
    // applied per code point, not per grapheme cluster.
    const wpm = Math.round((correct / 5) / (elapsedSec / 60));
    const progress =
      target.length > 0
        ? Math.min(100, (Math.min(totalTyped, target.length) / target.length) * 100)
        : 0;

    const typedStr = typedArr.join('');
    const targetStr = target.join('');
    const targetWords = targetStr.split(/\s+/).filter(Boolean);
    const typedWords = typedStr.split(/\s+/).filter(Boolean);
    let correctWords = 0;
    let wrongWords = 0;
    let skippedWords = 0;
    for (let i = 0; i < targetWords.length; i++) {
      if (i < typedWords.length) {
        if (typedWords[i] === targetWords[i]) correctWords++;
        else wrongWords++;
      } else {
        skippedWords++;
      }
    }

    return {
      wpm: isFinite(wpm) ? wpm : 0,
      accuracy: Math.round(accuracy * 10) / 10,
      errors: errorsRef.current,
      backspaces: backspacesRef.current,
      correctChars: correct,
      wrongChars: wrongCharsRef.current,
      correctWords,
      wrongWords,
      skippedWords,
      progress: Math.round(progress),
      elapsedSeconds: Math.round(elapsedSec),
      finished: completedRef.current,
    };
  }, []);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setFinished(true);
    setIsRunning(false);
    stopTimer();
    const stats = computeStats();
    onComplete?.(stats);
  }, [computeStats, onComplete, stopTimer]);

  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      const secs = startTimeRef.current
        ? (Date.now() - startTimeRef.current) / 1000
        : 0;
      setElapsed(secs);
      if (durationSeconds && secs >= durationSeconds) {
        finish();
      }
    }, 200);
    return () => stopTimer();
  }, [isRunning, durationSeconds, finish, stopTimer]);

  const start = useCallback(() => {
    if (completedRef.current) return;
    if (!startTimeRef.current) startTimeRef.current = Date.now();
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
    stopTimer();
  }, [stopTimer]);

  const restart = useCallback(() => {
    typedRef.current = [];
    errorsRef.current = 0;
    backspacesRef.current = 0;
    correctCharsRef.current = 0;
    wrongCharsRef.current = 0;
    startTimeRef.current = null;
    completedRef.current = false;
    setTyped('');
    setElapsed(0);
    setIsRunning(false);
    setFinished(false);
    stopTimer();
  }, [stopTimer]);

  const handleKey = useCallback(
    (physicalKey: string, shift: boolean = false) => {
      if (completedRef.current || !isRunning) return;

      if (physicalKey === 'Backspace') {
        backspacesRef.current++;
        if (typedRef.current.length > 0) {
          const removed = typedRef.current.pop();
          // Adjust correct/wrong counters for the removed char
          const idx = typedRef.current.length;
          const expected = targetChars.current[idx] ?? '';
          if (removed === expected) {
            correctCharsRef.current = Math.max(0, correctCharsRef.current - 1);
          } else {
            wrongCharsRef.current = Math.max(0, wrongCharsRef.current - 1);
          }
          setTyped(typedRef.current.join(''));
        }
        return;
      }

      const converted = adapterRef.current.convertKey(physicalKey, shift);
      if (converted === null) return;

      const idx = typedRef.current.length;
      const expected = targetChars.current[idx] ?? '';

      typedRef.current.push(converted);

      if (converted === expected) {
        correctCharsRef.current++;
      } else {
        wrongCharsRef.current++;
        errorsRef.current++;
      }

      setTyped(typedRef.current.join(''));

      if (typedRef.current.length >= targetChars.current.length) {
        finish();
      }
    },
    [isRunning, finish]
  );

  const expectedChar = targetChars.current[typedRef.current.length] ?? '';

  const stats = computeStats();

  const state: TypingEngineState = {
    ...stats,
    typed,
    expectedChar,
    isRunning,
    finished,
  };

  return {
    state,
    elapsed,
    start,
    pause,
    restart,
    finish,
    handleKey,
    computeStats,
  };
}
