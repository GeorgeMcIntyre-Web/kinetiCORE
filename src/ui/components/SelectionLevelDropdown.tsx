/**
 * Selection Level Dropdown Component
 * Owner: Edwin
 *
 * Dropdown for selecting the level of selection: object, component, or mesh
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Box, Component, Grid3x3 } from 'lucide-react';
import './SelectionLevelDropdown.css';

export type SelectionLevel = 'object' | 'component' | 'mesh';

export interface SelectionLevelOption {
  id: SelectionLevel;
  label: string;
  icon: React.ReactNode;
  description: string;
}

export interface SelectionLevelDropdownProps {
  currentLevel: SelectionLevel;
  onLevelChange: (level: SelectionLevel) => void;
}

export const SelectionLevelDropdown: React.FC<SelectionLevelDropdownProps> = ({
  currentLevel,
  onLevelChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selectionLevelOptions: SelectionLevelOption[] = [
    {
      id: 'object',
      label: 'Object',
      icon: <Box size={24} />,
      description: 'Select entire objects'
    },
    {
      id: 'component',
      label: 'Component',
      icon: <Component size={24} />,
      description: 'Select components within objects'
    },
    {
      id: 'mesh',
      label: 'Mesh',
      icon: <Grid3x3 size={24} />,
      description: 'Select individual meshes'
    }
  ];

  const currentOption = selectionLevelOptions.find(option => option.id === currentLevel) || selectionLevelOptions[0];

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

  const handleItemClick = (option: SelectionLevelOption) => {
    onLevelChange(option.id);
    setIsOpen(false);
  };

  const handleMainButtonClick = () => {
    // Clicking the main button toggles dropdown
    setIsOpen(!isOpen);
  };

  return (
    <div className="selection-level-dropdown" ref={dropdownRef}>
      <button
        ref={buttonRef}
        className="selection-level-dropdown-btn ribbon-btn"
        onClick={handleMainButtonClick}
        title={`${currentOption.description} (Click to change)`}
      >
        {currentOption.icon}
        <ChevronDown size={10} className={`dropdown-chevron ${isOpen ? 'open' : ''}`} style={{ marginLeft: '2px' }} />
      </button>

      {isOpen && (
        <div
          className="selection-level-dropdown-menu"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`
          }}
        >
          {selectionLevelOptions.map(option => (
            <button
              key={option.id}
              className={`selection-level-dropdown-item ${option.id === currentLevel ? 'active' : ''}`}
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
