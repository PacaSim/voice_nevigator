import { useCallback, useRef } from 'react';

export function useVoice() {
  const synthRef = useRef(window.speechSynthesis);
  const utteranceRef = useRef(null);

  const speak = useCallback((text, { rate = 1, pitch = 1, lang = 'ko-KR' } = {}) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = rate;
    utter.pitch = pitch;
    utteranceRef.current = utter;
    synthRef.current.speak(utter);
  }, []);

  const stop = useCallback(() => {
    synthRef.current?.cancel();
  }, []);

  return { speak, stop };
}
