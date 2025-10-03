// NumericInput - Drag-to-scrub numeric input component
// Owner: Edwin
// Location: src/ui/components/NumericInput.tsx

import { useState, useRef, useEffect } from 'react';
import { ChevronsLeftRight } from 'lucide-react';

interface NumericInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  dragSpeed?: number;
  precision?: number;
  unit?: string;
  axisColor?: 'red' | 'green' | 'blue' | 'default';
  disabled?: boolean;
}

export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  dragSpeed = 0.1,
  precision = 1,
  unit = '',
  axisColor = 'default',
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toFixed(precision));

  const inputRef = useRef<HTMLInputElement>(null);
  const dragStartX = useRef(0);
  const dragStartValue = useRef(0);

  const colorClasses = {
    red: 'border-red-500 focus:border-red-400',
    green: 'border-green-500 focus:border-green-400',
    blue: 'border-blue-500 focus:border-blue-400',
    default: 'border-gray-600 focus:border-blue-500',
  };

  const gripColorClasses = {
    red: 'text-red-500',
    green: 'text-green-500',
    blue: 'text-blue-500',
    default: 'text-gray-500',
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled || isEditing) return;

    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartValue.current = value;

    // Prevent text selection during drag
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartX.current;
      const deltaValue = deltaX * dragSpeed * step;
      const newValue = Math.max(min, Math.min(max, dragStartValue.current + deltaValue));

      onChange(parseFloat(newValue.toFixed(precision)));

      // Change cursor to indicate dragging
      document.body.style.cursor = 'ew-resize';
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [isDragging, onChange, min, max, step, precision, dragSpeed]);

  const handleInputFocus = () => {
    setIsEditing(true);
    setEditValue(value.toFixed(precision));
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    const numValue = parseFloat(editValue);
    if (!isNaN(numValue)) {
      onChange(Math.max(min, Math.min(max, numValue)));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setEditValue(value.toFixed(precision));
      inputRef.current?.blur();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(max, value + step));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(Math.max(min, value - step));
    }
  };

  const displayValue = isEditing ? editValue : value.toFixed(precision);

  // Background gradient classes for drag feedback
  const dragGradientClasses = {
    red: 'from-red-900/30 to-transparent',
    green: 'from-green-900/30 to-transparent',
    blue: 'from-blue-900/30 to-transparent',
    default: 'from-gray-700/50 to-transparent',
  };

  return (
    <div className="relative flex items-center group">
      {/* Drag indicator icon */}
      <div
        className={`
          absolute left-1 top-1/2 -translate-y-1/2 cursor-ew-resize
          transition-opacity pointer-events-none z-10
          ${gripColorClasses[axisColor]}
          ${disabled ? 'cursor-not-allowed opacity-30' : ''}
          ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}
        `}
      >
        <ChevronsLeftRight size={12} />
      </div>

      {/* Input field with gradient background on drag */}
      <div className="relative w-full" onMouseDown={handleMouseDown}>
        {/* Animated gradient background */}
        {isDragging && (
          <div
            className={`
              absolute inset-0 rounded pointer-events-none
              bg-gradient-to-r ${dragGradientClasses[axisColor]}
              animate-pulse
            `}
          />
        )}

        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={`
            relative w-full pl-6 pr-2 py-1.5 bg-gray-800 rounded text-sm
            text-white text-center font-mono transition-all
            ${colorClasses[axisColor]}
            ${isDragging ? 'select-none' : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-750'}
            focus:outline-none focus:bg-gray-750
          `}
        />

        {/* Unit label */}
        {unit && (
          <span
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs
              text-gray-500 pointer-events-none"
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};

// Axis-specific variants for X/Y/Z
export const XNumericInput: React.FC<Omit<NumericInputProps, 'axisColor'>> = (props) => (
  <NumericInput {...props} axisColor="red" />
);

export const YNumericInput: React.FC<Omit<NumericInputProps, 'axisColor'>> = (props) => (
  <NumericInput {...props} axisColor="green" />
);

export const ZNumericInput: React.FC<Omit<NumericInputProps, 'axisColor'>> = (props) => (
  <NumericInput {...props} axisColor="blue" />
);
