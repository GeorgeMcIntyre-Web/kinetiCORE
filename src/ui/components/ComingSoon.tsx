import React from 'react';
import './ComingSoon.css';

interface ComingSoonProps {
  title?: string;
  message?: string;
  size?: 'compact' | 'regular';
}

export const ComingSoon: React.FC<ComingSoonProps> = ({
  title = 'Tool Palette',
  message = 'Coming Soon',
  size = 'compact',
}) => {
  return (
    <div className={`coming-soon ${size}`}>
      <div className="coming-soon-title">{title}</div>
      <div className="coming-soon-badge">{message}</div>
    </div>
  );
};

