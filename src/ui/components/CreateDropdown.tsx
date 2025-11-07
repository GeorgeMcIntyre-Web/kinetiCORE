/**
 * Create Dropdown Component
 * Owner: George (UI Consolidation)
 * 
 * Consolidates all primitive creation buttons into a single combobox dropdown
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronDown, 
  Box, 
  Circle, 
  Cylinder,
  Cone,
  Square,
  Pill,
  Disc,
  Diamond
} from 'lucide-react';
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
  onCreateCone?: () => void;
  onCreateTorus?: () => void;
  onCreatePlane?: () => void;
  onCreateGround?: () => void;
  onCreateCapsule?: () => void;
  onCreateDisc?: () => void;
  onCreateTorusKnot?: () => void;
  onCreatePolyhedron?: () => void;
  currentShape?: string;
}

export const CreateDropdown: React.FC<CreateDropdownProps> = ({
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
  currentShape: initialShape = 'box'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [currentShape, setCurrentShape] = useState(initialShape);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const createOptions: CreateOption[] = [
    {
      id: 'box',
      label: 'Box',
      icon: <Box size={16} />,
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
    },
    {
      id: 'cone',
      label: 'Cone',
      icon: <Cone size={24} />,
      onClick: onCreateCone || (() => {}),
      description: 'Create Cone'
    },
    {
      id: 'torus',
      label: 'Torus',
      icon: <Circle size={24} />,
      onClick: onCreateTorus || (() => {}),
      description: 'Create Torus'
    },
    {
      id: 'plane',
      label: 'Plane',
      icon: <Square size={24} />,
      onClick: onCreatePlane || (() => {}),
      description: 'Create Plane'
    },
    {
      id: 'ground',
      label: 'Ground',
      icon: <Square size={24} />,
      onClick: onCreateGround || (() => {}),
      description: 'Create Ground'
    },
    {
      id: 'capsule',
      label: 'Capsule',
      icon: <Pill size={24} />,
      onClick: onCreateCapsule || (() => {}),
      description: 'Create Capsule'
    },
    {
      id: 'disc',
      label: 'Disc',
      icon: <Disc size={24} />,
      onClick: onCreateDisc || (() => {}),
      description: 'Create Disc'
    },
    {
      id: 'torusknot',
      label: 'TorusKnot',
      icon: <Circle size={24} />,
      onClick: onCreateTorusKnot || (() => {}),
      description: 'Create Torus Knot'
    },
    {
      id: 'polyhedron',
      label: 'Polyhedron',
      icon: <Diamond size={24} />,
      onClick: onCreatePolyhedron || (() => {}),
      description: 'Create Polyhedron'
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
    setCurrentShape(option.id); // Update current shape when a shape is created
    setIsOpen(false);
  };

  const handleMainButtonClick = (e: React.MouseEvent) => {
    // Check if click was on the chevron area (right side)
    const button = e.currentTarget as HTMLButtonElement;
    const rect = button.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const buttonWidth = rect.width;
    
    // If click is in the right 20% of button, open dropdown instead
    if (clickX > buttonWidth * 0.8) {
      e.stopPropagation();
      e.preventDefault();
      setIsOpen(!isOpen);
    } else {
      // Clicking the main area executes the current shape action
      e.stopPropagation();
      currentOption.onClick();
      setCurrentShape(currentShape); // Keep current shape active
    }
  };

  return (
    <div className="create-dropdown" ref={dropdownRef}>
      <div className="create-dropdown-button-group">
        {/* Main button with icon, text, and integrated arrow */}
        <button
          ref={buttonRef}
          className="ribbon-btn create-dropdown-main-btn"
          onClick={handleMainButtonClick}
          title={`${currentOption.description} (Click to create ${currentOption.label})`}
        >
          <span className="create-dropdown-icon-wrapper">
            {currentOption.icon}
          </span>
          <span className="create-dropdown-label">
            {currentOption.label}
          </span>
          <span className="create-dropdown-chevron-wrapper">
            <ChevronDown 
              size={10} 
              className={`create-dropdown-chevron ${isOpen ? 'open' : ''}`}
            />
          </span>
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

