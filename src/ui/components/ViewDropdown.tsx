/**
 * View Dropdown Component
 * Owner: George (UI Consolidation)
 * 
 * Consolidates Top, Left, Right, and Isometric view buttons into a single dropdown
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { TopViewIcon, FrontViewIcon, RightViewIcon, IsometricViewIcon } from './ViewIcons';
import './ViewDropdown.css';

export interface ViewOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  description: string;
}

export interface ViewDropdownProps {
  onTopViewClick?: () => void;
  onRightViewClick?: () => void;
  onFrontViewClick?: () => void;
  onIsoViewClick?: () => void;
  currentView?: string;
}

export const ViewDropdown: React.FC<ViewDropdownProps> = ({
  onTopViewClick,
  onRightViewClick,
  onFrontViewClick,
  onIsoViewClick,
  currentView = 'front'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const viewOptions: ViewOption[] = [
    {
      id: 'front',
      label: 'Front',
      icon: <FrontViewIcon size={32} />,
      onClick: onFrontViewClick || (() => {}),
      description: 'Front View'
    },
    {
      id: 'right',
      label: 'Right',
      icon: <RightViewIcon size={32} />,
      onClick: onRightViewClick || (() => {}),
      description: 'Right View'
    },
    {
      id: 'top',
      label: 'Top',
      icon: <TopViewIcon size={32} />,
      onClick: onTopViewClick || (() => {}),
      description: 'Top View'
    },
    {
      id: 'iso',
      label: 'Isometric',
      icon: <IsometricViewIcon size={32} />,
      onClick: onIsoViewClick || (() => {}),
      description: 'Isometric View'
    }
  ];

  const currentOption = viewOptions.find(option => option.id === currentView) || viewOptions[0];

  // Calculate menu position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.left
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleItemClick = (option: ViewOption) => {
    option.onClick();
    setIsOpen(false);
  };

  const handleMainButtonClick = () => {
    // Clicking the main button executes the current view action
    currentOption.onClick();
  };

  const handleDropdownClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <div className="view-dropdown" ref={dropdownRef}>
      <div className="view-dropdown-button-group">
        {/* Combined button - view icon + chevron */}
        <button
          ref={buttonRef}
          className="view-dropdown-main-btn"
          onClick={handleMainButtonClick}
          title={`${currentOption.description} (Click to activate)`}
        >
          {currentOption.icon}
          <ChevronDown size={10} className={`dropdown-chevron ${isOpen ? 'open' : ''}`} style={{ marginLeft: '2px' }} />
        </button>

        {/* Hidden clickable area for dropdown */}
        <button
          className="view-dropdown-arrow-btn"
          onClick={handleDropdownClick}
          title="View Options"
          style={{ position: 'absolute', right: 0, top: 0, width: '16px', height: '100%', opacity: 0 }}
        >
        </button>
      </div>

      {isOpen && (
        <div
          className="view-dropdown-menu"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`
          }}
        >
          {viewOptions.map(option => (
            <button
              key={option.id}
              className={`view-dropdown-item ${option.id === currentView ? 'active' : ''}`}
              onClick={() => handleItemClick(option)}
              title={option.description}
            >
              <span className="item-icon">{option.icon}</span>
              <span className="item-label">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
