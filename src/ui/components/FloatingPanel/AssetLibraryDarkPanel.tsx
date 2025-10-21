/**
 * AssetLibraryDarkPanel - Matches AssetLibraryPanelV2 styling exactly
 * Owner: Edwin
 * 
 * A reusable panel component that uses the exact same dark styling as AssetLibraryPanelV2
 * This ensures consistency across all panels that should match the Asset Library look
 */

import React from 'react';
import { X } from 'lucide-react';
import './AssetLibraryDarkPanel.css';

interface AssetLibraryDarkPanelProps {
  title: string;
  icon?: React.ReactNode;
  onClose?: () => void;
  children: React.ReactNode;
  className?: string;
}

export const AssetLibraryDarkPanel: React.FC<AssetLibraryDarkPanelProps> = ({ 
  title, 
  icon, 
  onClose, 
  children,
  className = ''
}) => {
  return (
    <div className={`asset-library-dark-panel ${className}`}>
      <div className="asset-library-dark-header">
        <h2 className="asset-library-dark-title">
          {icon && <span className="asset-library-dark-icon">{icon}</span>}
          {title}
        </h2>
        {onClose && (
          <button className="asset-library-dark-close-btn" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        )}
      </div>
      <div className="asset-library-dark-content">
        {children}
      </div>
    </div>
  );
};

interface AssetLibraryDarkSectionProps {
  title?: string;
  hint?: string;
  children: React.ReactNode;
}

export const AssetLibraryDarkSection: React.FC<AssetLibraryDarkSectionProps> = ({ title, hint, children }) => (
  <div className="asset-library-dark-section">
    {(title || hint) && (
      <div className="asset-library-dark-section-header">
        {title && <h3 className="asset-library-dark-section-title">{title}</h3>}
        {hint && <span className="asset-library-dark-section-hint">{hint}</span>}
      </div>
    )}
    {children}
  </div>
);

interface AssetLibraryDarkButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const AssetLibraryDarkButton: React.FC<AssetLibraryDarkButtonProps> = ({ icon, children, ...props }) => (
  <button className="asset-library-dark-button" {...props}>
    {icon}
    {children}
  </button>
);

interface AssetLibraryDarkSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode;
}

export const AssetLibraryDarkSelect: React.FC<AssetLibraryDarkSelectProps> = ({ children, ...props }) => (
  <select className="asset-library-dark-select" {...props}>
    {children}
  </select>
);

interface AssetLibraryDarkDisabledProps {
  icon?: React.ReactNode;
  message: string;
}

export const AssetLibraryDarkDisabled: React.FC<AssetLibraryDarkDisabledProps> = ({ icon, message }) => (
  <div className="asset-library-dark-disabled-overlay">
    {icon && <span className="asset-library-dark-disabled-icon">{icon}</span>}
    <span>{message}</span>
  </div>
);
