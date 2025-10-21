/**
 * BasePanel - Reusable Dark Mode Panel Component
 * Based on Asset Library styling for consistency
 */

import React from 'react';
import './BasePanel.css';

interface BasePanelProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onDock?: () => void;
  className?: string;
}

export const BasePanel: React.FC<BasePanelProps> = ({
  title,
  icon,
  children,
  onClose,
  onMinimize,
  onMaximize,
  onDock,
  className = '',
}) => {
  return (
    <div className={`base-panel-container ${className}`}>
      {/* Header */}
      <div className="base-panel-header">
        <div className="base-panel-title">
          {icon && <span className="base-panel-icon">{icon}</span>}
          {title}
        </div>
        
        <div className="base-panel-controls">
          {onMinimize && (
            <button
              className="base-panel-control-btn"
              onClick={onMinimize}
              title="Minimize"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <rect x="2" y="5" width="8" height="2" rx="1" />
              </svg>
            </button>
          )}
          
          {onMaximize && (
            <button
              className="base-panel-control-btn"
              onClick={onMaximize}
              title="Maximize"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <rect x="2" y="2" width="8" height="8" rx="1" />
              </svg>
            </button>
          )}
          
          {onDock && (
            <button
              className="base-panel-control-btn"
              onClick={onDock}
              title="Dock"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M2 2h8v8H2V2zm1 1v6h6V3H3z" />
              </svg>
            </button>
          )}
          
          {onClose && (
            <button
              className="base-panel-control-btn close-btn"
              onClick={onClose}
              title="Close"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M9.5 3.5L6.5 6.5L9.5 9.5L8.5 10.5L5.5 7.5L2.5 10.5L1.5 9.5L4.5 6.5L1.5 3.5L2.5 2.5L5.5 5.5L8.5 2.5L9.5 3.5Z" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* Body */}
      <div className="base-panel-body">
        {children}
      </div>
    </div>
  );
};

// Helper components for common patterns
export const BasePanelSection: React.FC<{
  title?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, hint, children, className = '' }) => (
  <div className={`base-panel-section ${className}`}>
    {(title || hint) && (
      <div className="base-panel-section-header">
        {title && <h3 className="base-panel-section-title">{title}</h3>}
        {hint && <span className="base-panel-section-hint">{hint}</span>}
      </div>
    )}
    {children}
  </div>
);

export const BasePanelButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'default' | 'primary';
  className?: string;
}> = ({ children, onClick, disabled = false, variant = 'default', className = '' }) => (
  <button
    className={`base-panel-btn ${variant === 'primary' ? 'base-panel-btn-primary' : ''} ${className}`}
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </button>
);

export const BasePanelSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, options, placeholder, className = '' }) => (
  <select
    className={`base-panel-select ${className}`}
    value={value}
    onChange={(e) => onChange(e.target.value)}
  >
    {placeholder && <option value="">{placeholder}</option>}
    {options.map(option => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

export const BasePanelDisabled: React.FC<{
  icon?: React.ReactNode;
  message: string;
  className?: string;
}> = ({ icon, message, className = '' }) => (
  <div className={`base-panel-disabled ${className}`}>
    {icon && <div className="base-panel-disabled-icon">{icon}</div>}
    <div>{message}</div>
  </div>
);
