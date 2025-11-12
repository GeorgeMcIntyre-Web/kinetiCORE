import React from 'react';
import './ToolbarContainer.css';

export interface ToolbarContainerProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * ToolbarContainer – lightweight wrapper to visually group toolbar controls.
 * Designed to mimic the Essentials floating toolbar feel (subtle backdrop,
 * border, padding, rounded corners) without changing button behavior.
 */
export const ToolbarContainer: React.FC<ToolbarContainerProps> = ({
  title,
  children,
  className = '',
  style = {},
}) => {
  return (
    <div className={`toolbar-container ${className}`} style={style}>
      {title && <div className="toolbar-container__title">{title}</div>}
      <div className="toolbar-container__body">{children}</div>
    </div>
  );
};

export default ToolbarContainer;

