import React from 'react';
import './ControlPanel.css';

function IconPlay()  {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 3l14 9-14 9V3z"/></svg>;
}
function IconStop()  {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>;
}
function IconVoice() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 1a3 3 0 0 1 3 3v8a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
}

export default function ControlPanel({ cameraStatus, onStart, onStop, onSpeak }) {
  const isActive = cameraStatus === 'active';

  return (
    <div className="control-panel" role="toolbar" aria-label="내비게이션 컨트롤">
      {!isActive ? (
        <button
          className="btn btn-primary btn-large"
          onClick={onStart}
          aria-label="내비게이션 시작"
          disabled={cameraStatus === 'requesting'}
        >
          {cameraStatus === 'requesting' ? (
            '연결 중...'
          ) : (
            <><IconPlay />내비게이션 시작</>
          )}
        </button>
      ) : (
        <>
          <button
            className="btn btn-danger btn-large"
            onClick={onStop}
            aria-label="내비게이션 중지"
          >
            <IconStop />중지
          </button>
          <button
            className="btn btn-secondary btn-large"
            onClick={onSpeak}
            aria-label="음성 안내 반복"
          >
            <IconVoice />음성 반복
          </button>
        </>
      )}
    </div>
  );
}
