/**
 * Toolbar Dropdown Component
 * Owner: George (UI Consolidation)
 *
 * Simple dropdown menu for toolbar button groups
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import './ToolbarDropdown.css';

export interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export interface ToolbarDropdownProps {
  label: string;
  icon?: React.ReactNode;
  items: DropdownItem[];
  variant?: 'primary' | 'secondary';
}

export const ToolbarDropdown: React.FC<ToolbarDropdownProps> = ({
  label,
  icon,
  items,
  variant = 'secondary'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleItemClick = (item: DropdownItem) => {
    item.onClick();
    setIsOpen(false);
  };

  return (
    <div className="toolbar-dropdown" ref={dropdownRef}>
      <button
        className={`dropdown-trigger ${variant}`}
        onClick={() => setIsOpen(!isOpen)}
        title={label}
      >
        {icon && <span className="dropdown-icon">{icon}</span>}
        <span className="dropdown-label">{label}</span>
        <ChevronDown size={14} className={`dropdown-chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="dropdown-menu">
          {items.map(item => (
            <button
              key={item.id}
              className="dropdown-item"
              onClick={() => handleItemClick(item)}
              disabled={item.disabled}
            >
              {item.icon && <span className="item-icon">{item.icon}</span>}
              <span className="item-label">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
