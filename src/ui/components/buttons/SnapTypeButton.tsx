/**
 * Snap Type Button Component
 * Owner: George
 * 
 * Systematic implementation of snap type buttons using ButtonTemplate
 * Follows the Button Implementation Process guidelines
 */

import { ButtonTemplate } from './ButtonTemplate';

export interface SnapTypeButtonProps {
  snapType: string;
  label: string;
  icon: string;
  disabled?: boolean;
  className?: string;
}

export function SnapTypeButton({ 
  snapType, 
  label, 
  icon, 
  disabled = false,
  className 
}: SnapTypeButtonProps) {
  return (
    <ButtonTemplate
      id={`snap_${snapType}`}
      label={label}
      icon={icon}
      action={`Toggle ${snapType} snapping`}
      stateKey={`snapSettings.${snapType}`}
      initialState={false}
      stateType="boolean"
      variant="ghost"
      size="sm"
      disabled={disabled}
      ariaLabel={`Toggle ${label} snapping`}
      keyboardShortcut={snapType.charAt(0)} // First letter as shortcut
      storeMethod={`setSnap${snapType.charAt(0).toUpperCase() + snapType.slice(1)}`}
      callback={(value) => {
        console.log(`[SnapTypeButton] ${snapType} snapping: ${value}`);
      }}
      className={className}
    />
  );
}
