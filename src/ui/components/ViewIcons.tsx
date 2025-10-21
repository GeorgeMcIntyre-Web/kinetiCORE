/**
 * Custom View Icons
 * Owner: George (UI Enhancement)
 * 
 * Better 3D representation icons for camera views
 */

import React from 'react';

interface ViewIconProps {
  size?: number;
  className?: string;
}

// Top View Icon - Cube seen from above with top face highlighted
export const TopViewIcon: React.FC<ViewIconProps> = ({ size = 32, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Top face (solid black fill) */}
    <path d="M6 8L14 4L22 8L14 12Z" fill="currentColor" stroke="none" />
    
    {/* Visible edges (solid lines) */}
    <path d="M6 8L14 4L22 8" stroke="currentColor" fill="none" />
    <path d="M22 8L14 12L6 8" stroke="currentColor" fill="none" />
    
    {/* Front vertical edges */}
    <path d="M6 8L6 16" stroke="currentColor" fill="none" />
    <path d="M14 4L14 12" stroke="currentColor" fill="none" />
    <path d="M22 8L22 16" stroke="currentColor" fill="none" />
    
    {/* Bottom front edge */}
    <path d="M6 16L14 12L22 16" stroke="currentColor" fill="none" />
    
    {/* Hidden edges (dotted lines) */}
    <path d="M14 12L14 20" stroke="currentColor" strokeDasharray="2,2" fill="none" />
    <path d="M6 16L14 20" stroke="currentColor" strokeDasharray="2,2" fill="none" />
    <path d="M14 20L22 16" stroke="currentColor" strokeDasharray="2,2" fill="none" />
  </svg>
);

// Front View Icon - Cube seen from front with front face highlighted
export const FrontViewIcon: React.FC<ViewIconProps> = ({ size = 32, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Front face (solid black fill) */}
    <path d="M6 8L18 8L18 16L6 16Z" fill="currentColor" stroke="none" />
    
    {/* Visible edges (solid lines) */}
    <path d="M6 8L18 8L18 16L6 16L6 8" stroke="currentColor" fill="none" />
    <path d="M18 8L22 4" stroke="currentColor" fill="none" />
    <path d="M18 16L22 12" stroke="currentColor" fill="none" />
    <path d="M22 4L22 12" stroke="currentColor" fill="none" />

    {/* Hidden edges (dotted lines) */}
    <path d="M6 8L10 4" stroke="currentColor" strokeDasharray="2,2" fill="none" />
    <path d="M10 4L22 4" stroke="currentColor" strokeDasharray="2,2" fill="none" />
    <path d="M6 16L10 12" stroke="currentColor" strokeDasharray="2,2" fill="none" />
    <path d="M10 12L22 12" stroke="currentColor" strokeDasharray="2,2" fill="none" />
  </svg>
);

// Right View Icon - Cube seen from right side with right face highlighted
export const RightViewIcon: React.FC<ViewIconProps> = ({ size = 32, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Right face (solid black fill) */}
    <path d="M18 4L22 8L22 16L18 12Z" fill="currentColor" stroke="none" />

    {/* Visible edges (solid lines) */}
    <path d="M18 4L22 8L22 16L18 12L18 4" stroke="currentColor" fill="none" />
    <path d="M18 4L14 8" stroke="currentColor" fill="none" />
    <path d="M14 8L6 8" stroke="currentColor" fill="none" />
    <path d="M6 8L6 16" stroke="currentColor" fill="none" />
    <path d="M6 16L14 20" stroke="currentColor" fill="none" />
    <path d="M14 20L18 12" stroke="currentColor" fill="none" />

    {/* Hidden edges (dotted lines) */}
    <path d="M6 16L10 12" stroke="currentColor" strokeDasharray="2,2" fill="none" />
    <path d="M10 12L14 8" stroke="currentColor" strokeDasharray="2,2" fill="none" />
    <path d="M6 8L10 12" stroke="currentColor" strokeDasharray="2,2" fill="none" />
  </svg>
);

// Isometric View Icon - Simple cube outline
export const IsometricViewIcon: React.FC<ViewIconProps> = ({ size = 32, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Top face */}
    <path d="M12 2L20 6L12 10L4 6L12 2Z" />
    {/* Front face */}
    <path d="M4 6L4 14L12 18L12 10" />
    {/* Right face */}
    <path d="M20 6L20 14L12 18L12 10" />
  </svg>
);
