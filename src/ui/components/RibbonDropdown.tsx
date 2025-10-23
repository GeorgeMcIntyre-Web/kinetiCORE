/**
 * Ribbon Dropdown Template Component
 * Owner: Agent 1 (George)
 *
 * Reusable dropdown component for RibbonToolbar buttons
 * Follows the ribbon button style pattern with integrated chevron
 *
 * @example
 * ```tsx
 * <RibbonDropdown
 *   icon={<Save size={24} />}
 *   tooltip="Save Options"
 *   onMainClick={() => console.log('Main action')}
 *   options={[
 *     { id: 'save', label: 'Save', icon: <Save size={20} />, onClick: () => {} },
 *     { id: 'export', label: 'Export', icon: <Download size={20} />, onClick: () => {} }
 *   ]}
 * />
 * ```
 */

import { useState, useRef, useEffect, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import './RibbonDropdown.css';

export interface DropdownOption {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  description?: string;
  active?: boolean;
}

export interface RibbonDropdownProps {
  /** Main icon to display (e.g., <Save size={24} />) */
  icon: ReactNode;

  /** Tooltip for the main button */
  tooltip: string;

  /** Callback when main button (icon) is clicked */
  onMainClick: () => void;

  /** Array of dropdown menu options */
  options: DropdownOption[];

  /** Optional custom width (default: 50px) */
  width?: number;
}

export const RibbonDropdown: React.FC<RibbonDropdownProps> = ({
  icon,
  tooltip,
  onMainClick,
  options,
  width = 50
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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

  const handleItemClick = (option: DropdownOption) => {
    option.onClick();
    setIsOpen(false);
  };

  const handleMainButtonClick = () => {
    onMainClick();
  };

  const handleDropdownClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <div className="ribbon-dropdown" ref={dropdownRef}>
      <div className="ribbon-dropdown-button-group">
        {/* Combined button - icon + chevron */}
        <button
          ref={buttonRef}
          className="ribbon-dropdown-main-btn"
          onClick={handleMainButtonClick}
          title={tooltip}
          style={{ width: `${width}px` }}
        >
          {icon}
          <ChevronDown
            size={10}
            className={`dropdown-chevron ${isOpen ? 'open' : ''}`}
            style={{ marginLeft: '2px' }}
          />
        </button>

        {/* Hidden clickable area for dropdown */}
        <button
          className="ribbon-dropdown-arrow-btn"
          onClick={handleDropdownClick}
          title="More options"
          style={{ position: 'absolute', right: 0, top: 0, width: '16px', height: '100%', opacity: 0 }}
        >
        </button>
      </div>

      {isOpen && (
        <div
          className="ribbon-dropdown-menu"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`
          }}
        >
          {options.map(option => (
            <button
              key={option.id}
              className={`ribbon-dropdown-item ${option.active ? 'active' : ''}`}
              onClick={() => handleItemClick(option)}
              title={option.description || option.label}
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
