/**
 * Create Dropdown Component
 * Owner: George (UI Consolidation)
 * 
 * Consolidates Box, Sphere, and Cylinder create buttons into a single dropdown
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Box, Circle, Cylinder } from 'lucide-react';
import './CreateDropdown.css';

export interface CreateOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  description: string;
}

export interface CreateDropdownProps {
  onCreateBox?: () => void;
  onCreateSphere?: () => void;
  onCreateCylinder?: () => void;
  currentShape?: string;
}

export const CreateDropdown: React.FC<CreateDropdownProps> = ({
  onCreateBox,
  onCreateSphere,
  onCreateCylinder,
  currentShape = 'box'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const createOptions: CreateOption[] = [
    {
      id: 'box',
      label: 'Box',
      icon: <Box size={24} />,
      onClick: onCreateBox || (() => {}),
      description: 'Create Box'
    },
    {
      id: 'sphere',
      label: 'Sphere',
      icon: <Circle size={24} />,
      onClick: onCreateSphere || (() => {}),
      description: 'Create Sphere'
    },
    {
      id: 'cylinder',
      label: 'Cylinder',
      icon: <Cylinder size={24} />,
      onClick: onCreateCylinder || (() => {}),
      description: 'Create Cylinder'
    }
  ];

  const currentOption = createOptions.find(option => option.id === currentShape) || createOptions[0];

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

  const handleItemClick = (option: CreateOption) => {
    option.onClick();
    setIsOpen(false);
  };

  const handleMainButtonClick = () => {
    // Clicking the main button executes the current shape action
    currentOption.onClick();
  };

  const handleDropdownClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <div className="create-dropdown" ref={dropdownRef}>
      <div className="create-dropdown-button-group">
        {/* Combined button - shape icon + chevron */}
        <button
          ref={buttonRef}
          className="create-dropdown-main-btn"
          onClick={handleMainButtonClick}
          title={`${currentOption.description} (Click to create)`}
        >
          {currentOption.icon}
          <ChevronDown size={10} className={`dropdown-chevron ${isOpen ? 'open' : ''}`} style={{ marginLeft: '2px' }} />
        </button>

        {/* Hidden clickable area for dropdown */}
        <button
          className="create-dropdown-arrow-btn"
          onClick={handleDropdownClick}
          title="Create Options"
          style={{ position: 'absolute', right: 0, top: 0, width: '16px', height: '100%', opacity: 0 }}
        >
        </button>
      </div>

      {isOpen && (
        <div
          className="create-dropdown-menu"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`
          }}
        >
          {createOptions.map(option => (
            <button
              key={option.id}
              className={`create-dropdown-item ${option.id === currentShape ? 'active' : ''}`}
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

