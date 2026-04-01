import React from 'react';
import './CameraView.css';

function IconCamera() {
  return (
    <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="4" y="11" width="36" height="26" rx="5" stroke="white" strokeWidth="2.8" />
      <circle cx="22" cy="24" r="7" stroke="white" strokeWidth="2.8" />
      <circle cx="22" cy="24" r="3" fill="white" />
      <path d="M16 11V9a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v2" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

export default function CameraView({ videoRef, status, errorMessage, onStart }) {
  return (
    <div className="camera-container" role="region" aria-label="카메라 화면">
      <video
        ref={videoRef}
        className="camera-video"
        autoPlay
        playsInline
        muted
        aria-hidden="true"
      />

      {status !== 'active' && (
        <div className="camera-overlay">
          {status === 'idle' && (
            <div className="overlay-content">
              <div className="overlay-brand">
                <div className="overlay-icon"><IconCamera /></div>
                <p className="overlay-app-name">AI 보행 내비게이터</p>
                <p className="overlay-subtitle">교통약자를 위한 실시간<br />장애물 탐지 서비스</p>
              </div>
              <button
                className="btn btn-primary btn-large"
                onClick={onStart}
                aria-label="내비게이션 시작 — 카메라 권한이 필요합니다"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{marginRight:'0.5rem'}}>
                  <path d="M5 3l14 9-14 9V3z" fill="currentColor" />
                </svg>
                시작하기
              </button>
            </div>
          )}

          {status === 'requesting' && (
            <div className="overlay-content">
              <div className="spinner-wrap">
                <div className="spinner" role="status" aria-label="카메라 권한 요청 중" />
                <p className="overlay-text">카메라 연결 중</p>
                <p className="spinner-label">권한을 허용해 주세요</p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="overlay-content">
              <span className="error-icon" aria-hidden="true">⚠️</span>
              <p className="overlay-text error-text" role="alert">{errorMessage}</p>
              <button
                className="btn btn-primary btn-large"
                onClick={onStart}
                aria-label="카메라 다시 시작"
              >
                다시 시도
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
