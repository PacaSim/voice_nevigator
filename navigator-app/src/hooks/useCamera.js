import { useEffect, useRef, useState, useCallback } from 'react';

export function useCamera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | requesting | active | error
  const [errorMessage, setErrorMessage] = useState('');

  const startCamera = useCallback(async () => {
    setStatus('requesting');
    setErrorMessage('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStatus('active');
    } catch (err) {
      let msg = '카메라를 시작할 수 없습니다.';
      if (err.name === 'NotAllowedError') msg = '카메라 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.';
      else if (err.name === 'NotFoundError') msg = '카메라를 찾을 수 없습니다.';
      else if (err.name === 'NotReadableError') msg = '카메라가 다른 앱에서 사용 중입니다.';
      setErrorMessage(msg);
      setStatus('error');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStatus('idle');
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return { videoRef, status, errorMessage, startCamera, stopCamera };
}
