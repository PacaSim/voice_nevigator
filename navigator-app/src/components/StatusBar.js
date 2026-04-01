import React from 'react';
import './StatusBar.css';

const STATUS_CONFIG = {
  idle:       { label: '대기 중',       icon: '⏸',  className: 'status-idle' },
  requesting: { label: '카메라 연결 중', icon: '🔄', className: 'status-requesting' },
  active:     { label: '탐색 중',       icon: '🔍', className: 'status-active' },
  error:      { label: '오류',          icon: '⚠️', className: 'status-error' },
};

export default function StatusBar({ cameraStatus, announcement, badge }) {
  const config = STATUS_CONFIG[cameraStatus] ?? STATUS_CONFIG.idle;

  return (
    <div className={`status-bar ${config.className}`} role="status" aria-live="polite" aria-atomic="true">
      <div className="status-indicator">
        <span className="status-icon" aria-hidden="true">{config.icon}</span>
        <span className="status-label">{config.label}</span>
        {badge && <span className="status-badge">{badge}</span>}
      </div>
      {announcement && (
        <div className="status-announcement" aria-live="assertive">
          {announcement}
        </div>
      )}
    </div>
  );
}
