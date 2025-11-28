/**
 * ViewOptionsDropdown - alternate view selector placed beside the main View dropdown
 * Shows the same view options (Front/Right/Top/Isometric) in a separate component
 */

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import * as BABYLON from '@babylonjs/core';
import { SceneManager } from '../../scene/SceneManager';
import { TopViewIcon, FrontViewIcon, RightViewIcon, IsometricViewIcon } from './ViewIcons';
import './ViewOptionsDropdown.css';

export interface ViewOptionsDropdownProps {
  onTopViewClick?: () => void;
  onRightViewClick?: () => void;
  onFrontViewClick?: () => void;
  onIsoViewClick?: () => void;
  currentView?: string;
}

export const ViewOptionsDropdown: React.FC<ViewOptionsDropdownProps> = ({
  onTopViewClick,
  onRightViewClick,
  onFrontViewClick,
  onIsoViewClick,
  currentView = 'front'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  const runViewAction = (viewId: string, cb?: () => void) => {
    if (cb) {
      cb();
      return;
    }
    const camera = SceneManager.getInstance?.().getCamera?.();
    if (camera && camera instanceof BABYLON.ArcRotateCamera) {
      switch (viewId) {
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

  const viewOptions = [
    {
      id: 'front',
      label: 'Front',
      icon: <FrontViewIcon size={20} />,
      onClick: onFrontViewClick
    },
    {
      id: 'right',
      label: 'Right',
      icon: <RightViewIcon size={20} />,
      onClick: onRightViewClick
    },
    {
      id: 'top',
      label: 'Top',
      icon: <TopViewIcon size={20} />,
      onClick: onTopViewClick
    },
    {
      id: 'iso',
      label: 'Isometric',
      icon: <IsometricViewIcon size={20} />,
      onClick: onIsoViewClick
    }
  ];

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  const updateMenuPosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
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

  const toggleMenu = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsOpen((open) => !open);
  };

  const handleItemClick = (option: { id: string; onClick?: () => void }) => {
    runViewAction(option.id, option.onClick);
    setIsOpen(false);
  };

  return (
    <div className="view-options-dropdown" ref={dropdownRef}>
      <button
        ref={triggerRef}
        className="view-options-trigger"
        onClick={toggleMenu}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') toggleMenu(e);
        }}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <span className="view-options-label">Views</span>
        <ChevronDown size={12} className={`view-options-chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen &&
        createPortal(
          <div
            className="view-options-menu"
            role="menu"
            ref={menuRef}
            style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
          >
            {viewOptions.map((option) => (
              <button
                key={option.id}
                className={`view-options-item ${option.id === currentView ? 'active' : ''}`}
                onClick={() => handleItemClick(option)}
                role="menuitem"
                type="button"
              >
                <span className="view-options-item-icon">{option.icon}</span>
                <span className="view-options-item-label">{option.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};
