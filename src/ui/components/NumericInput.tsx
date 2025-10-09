// NumericInput - Drag-to-scrub numeric input component
// Owner: Edwin
// Location: src/ui/components/NumericInput.tsx

import { useState, useRef } from 'react';

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
  onFocus?: () => void;
  onBlur?: () => void;
}

export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  precision = 1,
  unit = '',
  axisColor = 'default',
  disabled = false,
  onFocus,
  onBlur,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toFixed(precision));

  const inputRef = useRef<HTMLInputElement>(null);

  const colorClasses = {
    red: 'border-red-500 focus:border-red-400',
    green: 'border-green-500 focus:border-green-400',
    blue: 'border-blue-500 focus:border-blue-400',
    default: 'border-gray-600 focus:border-blue-500',
  };

  // Drag functionality removed - keyboard input only

  const handleInputFocus = () => {
    setIsEditing(true);
    setEditValue(value.toFixed(precision));
    onFocus?.();
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    const numValue = parseFloat(editValue);
    if (!isNaN(numValue)) {
      onChange(Math.max(min, Math.min(max, numValue)));
    }
    onBlur?.();
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

  return (
    <div className="relative flex items-center">
      {/* Input field - keyboard only */}
      <div className="relative w-full">
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
            w-full px-2 py-1.5 bg-gray-800 rounded text-sm
            text-white text-center font-mono transition-all
            ${colorClasses[axisColor]}
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
