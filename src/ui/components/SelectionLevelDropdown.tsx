/**
 * Selection Level Dropdown Component
 * Owner: Edwin
 *
 * Dropdown for selecting the level of selection: object, component, or mesh
 */

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const menuRef = useRef<HTMLDivElement>(null);

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

  const updateMenuPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.left
      });
    }
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updateMenuPosition();
      window.addEventListener('resize', updateMenuPosition);
      window.addEventListener('scroll', updateMenuPosition, true);
      return () => {
        window.removeEventListener('resize', updateMenuPosition);
        window.removeEventListener('scroll', updateMenuPosition, true);
      };
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
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

  const toggleDropdown = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsOpen((prev) => !prev);
  };

  const handleMainButtonClick = (e: React.MouseEvent) => {
    // If click came from chevron hitbox, let chevron handler manage toggle
    const target = e.target as HTMLElement;
    if (target.closest('.dropdown-chevron-hitbox')) return;
    toggleDropdown(e);
  };

  const handleChevronKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      toggleDropdown(e);
    }
  };

  return (
    <div className="selection-level-dropdown" ref={dropdownRef}>
      <button
        ref={buttonRef}
        className="selection-level-dropdown-btn"
        onClick={handleMainButtonClick}
        title={`${currentOption.description} (Click to change)`}
        type="button"
      >
        {currentOption.icon}
        <span
          className="dropdown-chevron-hitbox"
          role="button"
          tabIndex={0}
          aria-label="Selection level options"
          onClick={toggleDropdown}
          onKeyDown={handleChevronKey}
        >
          <ChevronDown
            size={10}
            className={`dropdown-chevron ${isOpen ? 'open' : ''}`}
            aria-hidden="true"
          />
        </span>
      </button>

      {isOpen &&
        createPortal(
          <div
            className="selection-level-dropdown-menu"
            ref={menuRef}
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
          </div>,
          document.body
        )}
    </div>
  );
};
