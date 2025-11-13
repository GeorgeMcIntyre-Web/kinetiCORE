/**
 * Create Dropdown Component
 * Owner: George (UI Consolidation)
 * 
 * Consolidates all primitive creation buttons into a single combobox dropdown
 */

import React, { useState, useRef, useEffect } from 'react';
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
  Diamond
} from 'lucide-react';
import './CreateDropdown.css';
// Ensure shared ribbon button styles are available outside RibbonToolbar usage (Professional mode)
import './RibbonToolbar.css';

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
  const chevronRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPosition({ top: rect.bottom + 12, left: rect.left });
    }
    setIsOpen((prev) => !prev);
  };

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
      icon: <Circle size={16} />,
      onClick: onCreateSphere || (() => {}),
      description: 'Create Sphere'
    },
    {
      id: 'cylinder',
      label: 'Cylinder',
      icon: <Cylinder size={16} />,
      onClick: onCreateCylinder || (() => {}),
      description: 'Create Cylinder'
    },
    {
      id: 'cone',
      label: 'Cone',
      icon: <Cone size={16} />,
      onClick: onCreateCone || (() => {}),
      description: 'Create Cone'
    },
    {
      id: 'torus',
      label: 'Torus',
      icon: <Circle size={16} />,
      onClick: onCreateTorus || (() => {}),
      description: 'Create Torus'
    },
    {
      id: 'plane',
      label: 'Plane',
      icon: <Square size={16} />,
      onClick: onCreatePlane || (() => {}),
      description: 'Create Plane'
    },
    {
      id: 'ground',
      label: 'Ground',
      icon: <Square size={16} />,
      onClick: onCreateGround || (() => {}),
      description: 'Create Ground'
    },
    {
      id: 'capsule',
      label: 'Capsule',
      icon: <Pill size={16} />,
      onClick: onCreateCapsule || (() => {}),
      description: 'Create Capsule'
    },
    {
      id: 'disc',
      label: 'Disc',
      icon: <Disc size={16} />,
      onClick: onCreateDisc || (() => {}),
      description: 'Create Disc'
    },
    {
      id: 'torusknot',
      label: 'TorusKnot',
      icon: <Circle size={16} />,
      onClick: onCreateTorusKnot || (() => {}),
      description: 'Create Torus Knot'
    },
    {
      id: 'polyhedron',
      label: 'Polyhedron',
      icon: <Diamond size={16} />,
      onClick: onCreatePolyhedron || (() => {}),
      description: 'Create Polyhedron'
    }
  ];

  const currentOption = createOptions.find(option => option.id === currentShape) || createOptions[0];

  // Calculate menu position when opened and on scroll/resize
  useEffect(() => {
    const updatePosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setMenuPosition({ top: rect.bottom + 12, left: rect.left });
      }
    };
    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen]);

  // Close dropdown when clicking outside (consider both button wrapper and portal menu)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const inButton = dropdownRef.current && dropdownRef.current.contains(target);
      const inMenu = menuRef.current && menuRef.current.contains(target);
      if (!inButton && !inMenu) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleItemClick = (option: CreateOption) => {
    console.log('[CreateDropdown] Item clicked:', option.id, option.label);
    option.onClick();
    setCurrentShape(option.id); // Update current shape when a shape is created
    setIsOpen(false);
  };

  const handleChevronMouseDown = (e: React.MouseEvent) => {
    // Open on mousedown to avoid any click delay
    e.stopPropagation();
    e.preventDefault();
    toggleMenu();
  };

  const handleMainButtonClick = (e: React.MouseEvent) => {
    // If click was on the chevron wrapper, don't handle it here (chevron handler will)
    if (chevronRef.current && chevronRef.current.contains(e.target as Node)) {
      return;
    }
    // Clicking the main area executes the current shape action
    e.stopPropagation();
    console.log('[CreateDropdown] Main button clicked, current shape:', currentShape);
    currentOption.onClick();
    setCurrentShape(currentShape); // Keep current shape active
  };

  return (
    <div className="create-dropdown" ref={dropdownRef}>
      <div className="create-dropdown-button-group">
        {/* Main button with icon, text, and integrated arrow */}
        <button
          type="button"
          ref={buttonRef}
          className="ribbon-btn create-dropdown-main-btn"
          onClick={handleMainButtonClick}
          title={`${currentOption.description} (Click to create ${currentOption.label})`}
        >
          <div className="create-dropdown-content-wrapper">
            <span className="create-dropdown-icon-wrapper">
              {currentOption.icon}
            </span>
            <span className="create-dropdown-label">
              {currentOption.label}
            </span>
          </div>
          <span 
            ref={chevronRef}
            className="create-dropdown-chevron-wrapper"
            onMouseDown={handleChevronMouseDown}
            onClick={(e) => { e.stopPropagation(); /* prevent double-toggle on click after mousedown */ }}
            >
            <ChevronDown
              size={14}
              className={`create-dropdown-chevron ${isOpen ? 'open' : ''}`}
            />
          </span>
        </button>
      </div>

      {isOpen && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            className="create-dropdown-menu"
            style={{
              position: 'fixed',
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              zIndex: 10000
            }}
          >
            {createOptions.map(option => (
              <button
                key={option.id}
                className={`create-dropdown-item ${option.id === currentShape ? 'active' : ''}`}
                onClick={() => handleItemClick(option)}
                title={option.description}
              >
                <div className="item-content-wrapper">
                  <span className="item-icon">{option.icon}</span>
                  <span className="item-label">{option.label}</span>
                </div>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};

