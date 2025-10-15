// GLB Import Notification Component
// Provides clear messaging about GLB file limitations and capabilities
// Owner: AI Assistant

import React, { useState, useEffect } from 'react';

interface GLBImportNotificationProps {
  isVisible: boolean;
  onDismiss: () => void;
  fileName?: string;
  meshCount?: number;
  hasAnimations?: boolean;
}

export const GLBImportNotification: React.FC<GLBImportNotificationProps> = ({
  isVisible,
  onDismiss,
  fileName,
  meshCount = 0,
  hasAnimations = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (isVisible) {
      // Auto-dismiss after 10 seconds
      const timer = setTimeout(() => {
        onDismiss();
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [isVisible, onDismiss]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 shadow-lg rounded-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-yellow-800">
              GLB File Loaded - Visual Model Only
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                <strong>{fileName}</strong> has been loaded as a visual model.
              </p>
              
              {meshCount > 0 && (
                <p className="mt-1">
                  Loaded {meshCount} mesh{meshCount !== 1 ? 'es' : ''}.
                </p>
              )}
              
              {hasAnimations && (
                <p className="mt-1 text-blue-600">
                  ⚠️ This file contains animations that are not supported in robot mode.
                </p>
              )}

              <div className="mt-3">
                <button
                  type="button"
                  className="text-sm font-medium text-yellow-800 hover:text-yellow-900 underline"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? 'Hide' : 'Show'} limitations
                </button>
                
                {isExpanded && (
                  <div className="mt-2 space-y-2 text-xs">
                    <div className="bg-yellow-100 p-2 rounded">
                      <p className="font-medium text-yellow-800">What's NOT available:</p>
                      <ul className="mt-1 list-disc list-inside space-y-1 text-yellow-700">
                        <li>Joint controls and kinematics</li>
                        <li>Physics simulation</li>
                        <li>Actuator controls</li>
                        <li>Sensor data</li>
                        <li>Collision detection setup</li>
                      </ul>
                    </div>
                    
                    <div className="bg-green-100 p-2 rounded">
                      <p className="font-medium text-green-800">What IS available:</p>
                      <ul className="mt-1 list-disc list-inside space-y-1 text-green-700">
                        <li>Visual representation</li>
                        <li>Camera controls</li>
                        <li>Basic transformations</li>
                        <li>Material and texture viewing</li>
                      </ul>
                    </div>
                    
                    <div className="bg-blue-100 p-2 rounded">
                      <p className="font-medium text-blue-800">For robot functionality:</p>
                      <p className="text-blue-700">
                        Use MJCF (.xml) or URDF (.urdf) format files instead.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="ml-4 flex-shrink-0">
            <button
              type="button"
              className="inline-flex text-yellow-400 hover:text-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-yellow-50 rounded-md"
              onClick={onDismiss}
            >
              <span className="sr-only">Dismiss</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Hook for managing GLB notification state
export const useGLBImportNotification = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [notificationData, setNotificationData] = useState<{
    fileName?: string;
    meshCount?: number;
    hasAnimations?: boolean;
  }>({});

  const showNotification = (data: {
    fileName?: string;
    meshCount?: number;
    hasAnimations?: boolean;
  }) => {
    setNotificationData(data);
    setIsVisible(true);
  };

  const hideNotification = () => {
    setIsVisible(false);
    setNotificationData({});
  };

  return {
    isVisible,
    notificationData,
    showNotification,
    hideNotification
  };
};
