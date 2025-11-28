/**
 * View Dropdown Component
 * Owner: George (UI Consolidation)
 * 
 * Consolidates Top, Left, Right, and Isometric view buttons into a single dropdown
 */

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import * as BABYLON from '@babylonjs/core';
import { SceneManager } from '../../scene/SceneManager';
import { TopViewIcon, FrontViewIcon, RightViewIcon, IsometricViewIcon } from './ViewIcons';
import './ViewDropdown.css';

export interface ViewOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
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
  const menuRef = useRef<HTMLDivElement>(null);

  const runViewAction = (option: ViewOption) => {
    if (option.onClick) {
      option.onClick();
      return;
    }
    const camera = SceneManager.getInstance?.().getCamera?.();
    if (camera && camera instanceof BABYLON.ArcRotateCamera) {
      switch (option.id) {
        case 'top':
          camera.alpha = -Math.PI / 2;
          camera.beta = 0.001;
          break;
        case 'right':
          camera.alpha = 0;
          camera.beta = Math.PI / 2.2;
          break;
        case 'front':
          camera.alpha = Math.PI;
          camera.beta = Math.PI / 2.2;
          break;
        case 'iso':
          camera.alpha = Math.PI / 4;
          camera.beta = Math.PI / 3;
          break;
      }
    }
  };

  const viewOptions: ViewOption[] = [
    {
      id: 'front',
      label: 'Front',
      icon: <FrontViewIcon size={32} />,
      onClick: onFrontViewClick,
      description: 'Front View'
    },
    {
      id: 'right',
      label: 'Right',
      icon: <RightViewIcon size={32} />,
      onClick: onRightViewClick,
      description: 'Right View'
    },
    {
      id: 'top',
      label: 'Top',
      icon: <TopViewIcon size={32} />,
      onClick: onTopViewClick,
      description: 'Top View'
    },
    {
      id: 'iso',
      label: 'Isometric',
      icon: <IsometricViewIcon size={32} />,
      onClick: onIsoViewClick,
      description: 'Isometric View'
    }
  ];

  const currentOption = viewOptions.find(option => option.id === currentView) || viewOptions[0];

  // Keep menu aligned to the trigger in viewport space (avoids getting clipped by canvas)
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

  const handleItemClick = (option: ViewOption) => {
    runViewAction(option);
    setIsOpen(false);
  };

  const toggleDropdown = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setIsOpen((prev) => !prev);
  };

  const handleMainButtonClick = (e: React.MouseEvent) => {
    // If the click originated from the chevron hit area, don't trigger the view action
    const target = e.target as HTMLElement;
    if (target.closest('.dropdown-chevron-hitbox')) {
      return;
    }
    runViewAction(currentOption);
  };

  const handleChevronKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      toggleDropdown(e);
    }
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
          type="button"
        >
          {currentOption.icon}
          <span
            className="dropdown-chevron-hitbox"
            role="button"
            tabIndex={0}
            aria-label="View options"
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
      </div>

      {isOpen &&
        createPortal(
          <div
            className="view-dropdown-menu"
            ref={menuRef}
            style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
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
          </div>,
          document.body
        )}
    </div>
  );
};
