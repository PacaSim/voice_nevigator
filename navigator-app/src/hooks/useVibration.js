import { useCallback, useRef } from 'react';

/**
 * 위험도별 진동 패턴 (ms 단위: 진동, 정지, 진동, ...)
 *
 * 바로 앞  — 강한 3연속 펄스 (즉각 위험)
 * 가까이   — 2연속 펄스 (주의)
 * 멀리     — 짧은 단일 펄스 (인지)
 */
export const VIBRATION_PATTERNS = {
  immediate: [300, 100, 300, 100, 300],
  close:     [200, 120, 200],
  far:       [120],
};

/** distanceOrder(0~2) → 패턴 매핑 */
function patternForOrder(order) {
  if (order === 0) return VIBRATION_PATTERNS.immediate;
  if (order === 1) return VIBRATION_PATTERNS.close;
  return VIBRATION_PATTERNS.far;
}

/** 진동 API 지원 여부 */
function isSupported() {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/**
 * 햅틱(진동) 피드백 훅.
 *
 * @param {number} cooldownMs  - 진동 재발생 최소 간격 (기본 2000ms)
 * @returns {{ vibrateForThreat, cancel, supported }}
 */
export function useVibration(cooldownMs = 2000) {
  const lastVibrateRef = useRef(0);
  const supported = isSupported();

  /**
   * 가장 가까운 위협의 distanceOrder(0~2)를 받아 진동.
   * 쿨다운 내 재호출은 무시.
   */
  const vibrateForThreat = useCallback((distanceOrder) => {
    if (!supported) return;
    const now = Date.now();
    if (now - lastVibrateRef.current < cooldownMs) return;
    lastVibrateRef.current = now;
    navigator.vibrate(patternForOrder(distanceOrder));
  }, [supported, cooldownMs]);

  /** 진행 중인 진동 즉시 중단 */
  const cancel = useCallback(() => {
    if (supported) navigator.vibrate(0);
  }, [supported]);

  return { vibrateForThreat, cancel, supported };
}
