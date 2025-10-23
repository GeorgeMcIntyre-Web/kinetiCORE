/**
 * SplashScreen - Production-ready app initialization screen
 * Owner: Agent 6 (Edwin)
 * 
 * Features:
 * - Branded loading screen with logo
 * - Progress indicator
 * - Smooth fade-out animation
 * - Error state handling
 * - Responsive design
 */

import React, { useEffect, useState } from 'react';
import { Zap, AlertCircle } from 'lucide-react';
import './SplashScreen.css';

export interface SplashScreenProps {
  /** Loading message to display */
  message?: string;
  /** Progress percentage (0-100), omit for indeterminate */
  progress?: number;
  /** Error message if initialization failed */
  error?: string;
  /** Callback when retry is clicked (error state) */
  onRetry?: () => void;
  /** Whether to show the splash screen */
  isVisible?: boolean;
  /** Duration of fade-out animation in ms */
  fadeOutDuration?: number;
}

const INSPIRING_MESSAGES = [
  'Powering the future of industrial automation...',
  'Bringing your robotic visions to life...',
  'Engineering precision, simulating perfection...',
  'Where innovation meets simulation...',
  'Accelerating the next generation of robotics...',
  'Transforming industrial workflows...',
];

export const SplashScreen: React.FC<SplashScreenProps> = ({
  message = 'Initializing kinetiCORE...',
  progress,
  error,
  onRetry,
  isVisible = true,
  fadeOutDuration = 500,
}) => {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isHidden, setIsHidden] = useState(!isVisible);
  const [inspiringMessage, setInspiringMessage] = useState(INSPIRING_MESSAGES[0]);

  // Cycle through inspiring messages
  useEffect(() => {
    const interval = setInterval(() => {
      setInspiringMessage(prev => {
        const currentIndex = INSPIRING_MESSAGES.indexOf(prev);
        const nextIndex = (currentIndex + 1) % INSPIRING_MESSAGES.length;
        return INSPIRING_MESSAGES[nextIndex];
      });
    }, 3000); // Change message every 3 seconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isVisible && !isFadingOut) {
      // Start fade-out animation
      setIsFadingOut(true);
      const timer = setTimeout(() => {
        setIsHidden(true);
      }, fadeOutDuration);
      return () => clearTimeout(timer);
    } else if (isVisible && isHidden) {
      // Show splash screen again if needed
      setIsHidden(false);
      setIsFadingOut(false);
    }
  }, [isVisible, isFadingOut, isHidden, fadeOutDuration]);

  if (isHidden) {
    return null;
  }

  return (
    <div 
      className={`splash-screen ${isFadingOut ? 'fade-out' : ''}`}
      style={{ 
        animationDuration: `${fadeOutDuration}ms`,
      }}
    >
      <div className="splash-content">
        {/* Logo and Branding */}
        <div className="splash-logo-container">
          <div className="splash-logo">
            <div className="splash-logo-gradient">
              <Zap className="splash-logo-icon" size={56} strokeWidth={2.5} />
            </div>
          </div>
          <h1 className="splash-title">kinetiCORE</h1>
          <p className="splash-subtitle">Industrial Simulation Platform</p>
          <p className="splash-tagline" key={inspiringMessage}>
            {inspiringMessage}
          </p>
        </div>

        {/* Loading State */}
        {!error && (
          <div className="splash-loading">
            {/* Progress Bar or Spinner */}
            {progress !== undefined ? (
              <div className="splash-progress-container">
                <div className="splash-progress-bar">
                  <div 
                    className="splash-progress-fill"
                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  />
                </div>
                <div className="splash-progress-text">
                  {Math.round(progress)}%
                </div>
              </div>
            ) : (
              <div className="splash-spinner">
                <div className="splash-spinner-ring"></div>
                <div className="splash-spinner-ring"></div>
                <div className="splash-spinner-ring"></div>
              </div>
            )}

            {/* Loading Message */}
            <p className="splash-message">{message}</p>

            {/* Feature Highlights */}
            <div className="splash-features">
              <div className="splash-feature">
                <span className="splash-feature-icon">🤖</span>
                <span className="splash-feature-text">URDF & MJCF Support</span>
              </div>
              <div className="splash-feature">
                <span className="splash-feature-icon">⚡</span>
                <span className="splash-feature-text">Real-time Physics</span>
              </div>
              <div className="splash-feature">
                <span className="splash-feature-icon">🎯</span>
                <span className="splash-feature-text">Inverse Kinematics</span>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="splash-error">
            <AlertCircle className="splash-error-icon" size={48} />
            <h2 className="splash-error-title">Initialization Failed</h2>
            <p className="splash-error-message">{error}</p>
            {onRetry && (
              <button 
                className="splash-retry-button"
                onClick={onRetry}
              >
                Try Again
              </button>
            )}
          </div>
        )}

        {/* Version Info */}
        <div className="splash-footer">
          <p className="splash-version">Version 0.1.0</p>
          <p className="splash-copyright">© 2025 kinetiCORE Team</p>
        </div>
      </div>
    </div>
  );
};

/**
 * Hook to manage splash screen state during app initialization
 * 
 * @example
 * const { showSplash, setProgress, setMessage, setError, completeSplash } = useSplashScreen();
 * 
 * useEffect(() => {
 *   initializeApp()
 *     .then(() => completeSplash())
 *     .catch(err => setError(err.message));
 * }, []);
 * 
 * return <SplashScreen isVisible={showSplash} progress={progress} message={message} error={error} />;
 */
export const useSplashScreen = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [message, setMessage] = useState('Initializing...');
  const [error, setError] = useState<string | undefined>(undefined);

  const completeSplash = () => {
    setIsVisible(false);
  };

  const reset = () => {
    setIsVisible(true);
    setProgress(undefined);
    setMessage('Initializing...');
    setError(undefined);
  };

  return {
    isVisible,
    progress,
    message,
    error,
    setProgress,
    setMessage,
    setError,
    completeSplash,
    reset,
  };
};
