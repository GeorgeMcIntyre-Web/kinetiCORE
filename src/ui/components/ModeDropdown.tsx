/**
 * Mode Dropdown - sibling to Create dropdown, same styling as SelectionLevel dropdown
 */

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  Box,
  Circle,
  Cylinder,
  Cone,
  Square,
  Pill,
  Disc,
  Diamond,
} from 'lucide-react';
import './ModeDropdown.css';

export interface ModeOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  onClick?: () => void;
}

export interface ModeDropdownProps {
  currentMode?: string;
  onModeChange?: (id: string) => void;
  onCreateBox?: () => void;
  onCreateSphere?: () => void;
  onCreateCylinder?: () => void;
  onCreateCone?: () => void;
  onCreateTorus?: () => void;
  onCreatePlane?: () => void;
  onCreateGround?: () => void;
  onCreateCapsule?: () => void;
  onCreateDisc?: () => void;
  onCreateTorusKnot?: () => void;
  onCreatePolyhedron?: () => void;
}

export const ModeDropdown: React.FC<ModeDropdownProps> = ({
  currentMode = 'box',
  onModeChange,
  onCreateBox,
  onCreateSphere,
  onCreateCylinder,
  onCreateCone,
  onCreateTorus,
  onCreatePlane,
  onCreateGround,
  onCreateCapsule,
  onCreateDisc,
  onCreateTorusKnot,
  onCreatePolyhedron,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [selectedMode, setSelectedMode] = useState(currentMode);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedMode(currentMode);
  }, [currentMode]);

  const options: ModeOption[] = [
    { id: 'box', label: 'Box', icon: <Box size={18} />, description: 'Create Box', onClick: onCreateBox },
    { id: 'sphere', label: 'Sphere', icon: <Circle size={18} />, description: 'Create Sphere', onClick: onCreateSphere },
    { id: 'cylinder', label: 'Cylinder', icon: <Cylinder size={18} />, description: 'Create Cylinder', onClick: onCreateCylinder },
    { id: 'cone', label: 'Cone', icon: <Cone size={18} />, description: 'Create Cone', onClick: onCreateCone },
    { id: 'torus', label: 'Torus', icon: <Circle size={18} />, description: 'Create Torus', onClick: onCreateTorus },
    { id: 'plane', label: 'Plane', icon: <Square size={18} />, description: 'Create Plane', onClick: onCreatePlane },
    { id: 'ground', label: 'Ground', icon: <Square size={18} />, description: 'Create Ground', onClick: onCreateGround },
    { id: 'capsule', label: 'Capsule', icon: <Pill size={18} />, description: 'Create Capsule', onClick: onCreateCapsule },
    { id: 'disc', label: 'Disc', icon: <Disc size={18} />, description: 'Create Disc', onClick: onCreateDisc },
    { id: 'torusknot', label: 'TorusKnot', icon: <Circle size={18} />, description: 'Create Torus Knot', onClick: onCreateTorusKnot },
    { id: 'polyhedron', label: 'Polyhedron', icon: <Diamond size={18} />, description: 'Create Polyhedron', onClick: onCreatePolyhedron },
  ];

  const currentOption = options.find((opt) => opt.id === selectedMode) || options[0];

  const updateMenuPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({ top: rect.bottom + 4, left: rect.left });
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

  const toggleDropdown = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsOpen((prev) => !prev);
  };

  const handleMainClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.dropdown-chevron-hitbox')) return;
    // trigger current mode action if provided
    currentOption.onClick?.();
  };

  const handleChevronKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') toggleDropdown(e);
  };

  const handleItemClick = (option: ModeOption) => {
    option.onClick?.();
    setSelectedMode(option.id);
    onModeChange?.(option.id);
    setIsOpen(false);
  };

  return (
    <div className="mode-dropdown" ref={dropdownRef}>
      <button
        ref={buttonRef}
        className="mode-dropdown-btn"
        onClick={handleMainClick}
        title={`${currentOption.description} (Click to activate)`}
        type="button"
      >
        {currentOption.icon}
        <span className="mode-dropdown-label">{currentOption.label}</span>
        <span
          className="dropdown-chevron-hitbox"
          role="button"
          tabIndex={0}
          aria-label="Mode options"
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
            className="mode-dropdown-menu"
            ref={menuRef}
            style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
          >
            {options.map((option) => (
              <button
                key={option.id}
                className={`mode-dropdown-item ${option.id === currentOption.id ? 'active' : ''}`}
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
