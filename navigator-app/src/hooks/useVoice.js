import { useCallback, useEffect, useRef } from 'react';

export function useVoice() {
  const synthRef = useRef(window.speechSynthesis);

  // Chrome 모바일 버그 워크어라운드:
  // speechSynthesis 가 ~15초 후 자동 paused 상태로 빠지는 문제
  // 주기적으로 resume() 을 호출해 활성 상태를 유지
  useEffect(() => {
    const id = setInterval(() => {
      const synth = synthRef.current;
      if (synth && synth.paused) synth.resume();
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const speak = useCallback((text, { rate = 1, pitch = 1, lang = 'ko-KR' } = {}) => {
    const synth = synthRef.current;
    if (!synth) return;
    synth.cancel();
    // Chrome 모바일: cancel() 후 paused 상태가 되므로 resume() 필수
    synth.resume();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang  = lang;
    utter.rate  = rate;
    utter.pitch = pitch;
    synth.speak(utter);
  }, []);

  const stop = useCallback(() => {
    synthRef.current?.cancel();
  }, []);

  return { speak, stop };
}
