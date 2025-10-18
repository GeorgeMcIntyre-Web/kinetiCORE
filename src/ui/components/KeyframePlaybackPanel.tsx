/**
 * Keyframe Playback Panel
 * Owner: George + Edwin
 *
 * Displays and controls MJCF keyframe poses for the active robot/device
 * Integrates with MJCFKeyframeManager to apply saved poses
 */

import { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, CheckCircle } from 'lucide-react';
import { MJCFKeyframeManager, KeyframeObject } from '../../loaders/mjcf/MJCFKeyframeManager';
import { ForwardKinematicsSolver } from '../../kinematics/ForwardKinematicsSolver';
import './KeyframePlaybackPanel.css';

export interface KeyframePlaybackPanelProps {
  robotId: string;
  robotName: string;
  joints: any[]; // Current joint states
}

export const KeyframePlaybackPanel: React.FC<KeyframePlaybackPanelProps> = ({
  robotId,
  robotName,
  joints
}) => {
  const [keyframes, setKeyframes] = useState<KeyframeObject[]>([]);
  const [selectedKeyframe, setSelectedKeyframe] = useState<KeyframeObject | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentKeyframeIndex, setCurrentKeyframeIndex] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [loopPlayback, setLoopPlayback] = useState(false);

  const keyframeManager = MJCFKeyframeManager.getInstance();
  const fkSolver = ForwardKinematicsSolver.getInstance();

  // Load keyframes for this robot
  useEffect(() => {
    // Get registered keyframes from the manager
    const registeredKeyframes = keyframeManager.getKeyframes?.(robotId) || [];
    setKeyframes(registeredKeyframes);

    if (registeredKeyframes.length > 0 && !selectedKeyframe) {
      setSelectedKeyframe(registeredKeyframes[0]);
      setCurrentKeyframeIndex(0);
    }
  }, [robotId, keyframeManager, selectedKeyframe]);

  // Apply a specific keyframe to the robot
  const applyKeyframe = (keyframe: KeyframeObject) => {
    console.log(`[KeyframePlayback] Applying keyframe: ${keyframe.name} to ${robotName}`);

    // Check if keyframe has already been applied to prevent double application
    if (keyframeManager.hasBeenApplied(robotId, keyframe.name)) {
      console.warn(`[KeyframePlayback] Keyframe '${keyframe.name}' already applied, skipping`);
      return;
    }

    // Apply joint values from keyframe
    if (keyframe.jointValues && keyframe.jointValues.length > 0) {
      // Filter to movable joints only
      const movableJoints = joints.filter(j =>
        j.type === 'revolute' || j.type === 'prismatic' || j.type === 'continuous'
      );

      // Apply each joint value
      movableJoints.forEach((joint, index) => {
        if (index < keyframe.jointValues.length) {
          const value = keyframe.jointValues[index];
          fkSolver.updateJointPosition(joint.id, value);
        }
      });

      // Mark keyframe as applied
      keyframeManager.markApplied(robotId, keyframe.name);
      console.log(`[KeyframePlayback] ✅ Applied keyframe '${keyframe.name}' with ${keyframe.jointValues.length} joint values`);
    } else {
      console.warn(`[KeyframePlayback] Keyframe '${keyframe.name}' has no joint values`);
    }
  };

  // Handle keyframe selection from list
  const handleKeyframeSelect = (keyframe: KeyframeObject, index: number) => {
    setSelectedKeyframe(keyframe);
    setCurrentKeyframeIndex(index);
    setIsPlaying(false); // Stop playback when manually selecting
  };

  // Apply the currently selected keyframe
  const handleApplyKeyframe = () => {
    if (selectedKeyframe) {
      applyKeyframe(selectedKeyframe);
    }
  };

  // Reset to home position (first keyframe or all zeros)
  const handleResetToHome = () => {
    if (keyframes.length > 0) {
      const homeKeyframe = keyframes.find(k => k.name.toLowerCase() === 'home') || keyframes[0];
      applyKeyframe(homeKeyframe);
      setSelectedKeyframe(homeKeyframe);
      setCurrentKeyframeIndex(0);
    } else {
      // No keyframes - reset all joints to zero
      const movableJoints = joints.filter(j =>
        j.type === 'revolute' || j.type === 'prismatic' || j.type === 'continuous'
      );
      movableJoints.forEach(joint => {
        fkSolver.updateJointPosition(joint.id, 0);
      });
    }
  };

  // Playback controls
  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handlePrevious = () => {
    if (keyframes.length === 0) return;
    const newIndex = currentKeyframeIndex > 0 ? currentKeyframeIndex - 1 : keyframes.length - 1;
    setCurrentKeyframeIndex(newIndex);
    setSelectedKeyframe(keyframes[newIndex]);
    applyKeyframe(keyframes[newIndex]);
  };

  const handleNext = () => {
    if (keyframes.length === 0) return;
    const newIndex = currentKeyframeIndex < keyframes.length - 1 ? currentKeyframeIndex + 1 : 0;
    setCurrentKeyframeIndex(newIndex);
    setSelectedKeyframe(keyframes[newIndex]);
    applyKeyframe(keyframes[newIndex]);
  };

  // Automatic playback effect
  useEffect(() => {
    if (!isPlaying || keyframes.length === 0) return;

    const interval = setInterval(() => {
      setCurrentKeyframeIndex(prevIndex => {
        let newIndex = prevIndex + 1;

        // Handle end of sequence
        if (newIndex >= keyframes.length) {
          if (loopPlayback) {
            newIndex = 0; // Loop back to start
          } else {
            setIsPlaying(false); // Stop at end
            return prevIndex;
          }
        }

        // Apply the new keyframe
        const nextKeyframe = keyframes[newIndex];
        setSelectedKeyframe(nextKeyframe);
        applyKeyframe(nextKeyframe);

        return newIndex;
      });
    }, 2000 / playbackSpeed); // Base speed: 2 seconds per keyframe

    return () => clearInterval(interval);
  }, [isPlaying, keyframes, loopPlayback, playbackSpeed]);

  if (keyframes.length === 0) {
    return (
      <div className="keyframe-playback-panel">
        <div className="keyframe-header">
          <h3>Keyframe Poses</h3>
          <span className="keyframe-count">No keyframes available</span>
        </div>
        <div className="keyframe-empty-state">
          <p className="empty-message">This robot has no saved keyframe poses.</p>
          <p className="empty-hint">Import an MJCF model with keyframe data to see poses here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="keyframe-playback-panel">
      {/* Header */}
      <div className="keyframe-header">
        <h3>Keyframe Poses</h3>
        <span className="keyframe-count">{keyframes.length} poses</span>
      </div>

      {/* Keyframe List */}
      <div className="keyframe-list">
        {keyframes.map((keyframe, index) => (
          <button
            key={`${robotId}-${keyframe.name}-${index}`}
            className={`keyframe-item ${selectedKeyframe?.name === keyframe.name ? 'active' : ''}`}
            onClick={() => handleKeyframeSelect(keyframe, index)}
          >
            <div className="keyframe-item-content">
              <span className="keyframe-name">{keyframe.name}</span>
              {keyframe.description && (
                <span className="keyframe-description">{keyframe.description}</span>
              )}
            </div>
            {selectedKeyframe?.name === keyframe.name && (
              <CheckCircle className="keyframe-active-icon" size={16} />
            )}
          </button>
        ))}
      </div>

      {/* Playback Controls */}
      <div className="keyframe-controls">
        <div className="playback-buttons">
          <button
            className="control-btn"
            onClick={handlePrevious}
            title="Previous keyframe"
          >
            <SkipBack size={18} />
          </button>

          {isPlaying ? (
            <button
              className="control-btn play-pause"
              onClick={handlePause}
              title="Pause playback"
            >
              <Pause size={18} />
            </button>
          ) : (
            <button
              className="control-btn play-pause"
              onClick={handlePlay}
              title="Play sequence"
            >
              <Play size={18} />
            </button>
          )}

          <button
            className="control-btn"
            onClick={handleNext}
            title="Next keyframe"
          >
            <SkipForward size={18} />
          </button>
        </div>

        <div className="playback-options">
          <label className="playback-option">
            <input
              type="checkbox"
              checked={loopPlayback}
              onChange={(e) => setLoopPlayback(e.target.checked)}
            />
            <span>Loop</span>
          </label>

          <div className="playback-speed">
            <label>Speed:</label>
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            >
              <option value={0.5}>0.5x</option>
              <option value={1.0}>1.0x</option>
              <option value={1.5}>1.5x</option>
              <option value={2.0}>2.0x</option>
            </select>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="keyframe-actions">
        <button
          className="action-btn primary"
          onClick={handleApplyKeyframe}
          disabled={!selectedKeyframe}
        >
          Apply Pose
        </button>
        <button
          className="action-btn secondary"
          onClick={handleResetToHome}
        >
          <RotateCcw size={16} />
          Reset to Home
        </button>
      </div>

      {/* Current Keyframe Info */}
      {selectedKeyframe && (
        <div className="keyframe-info">
          <div className="info-header">Current Pose</div>
          <div className="info-content">
            <div className="info-row">
              <span className="info-label">Name:</span>
              <span className="info-value">{selectedKeyframe.name}</span>
            </div>
            {selectedKeyframe.description && (
              <div className="info-row">
                <span className="info-label">Description:</span>
                <span className="info-value">{selectedKeyframe.description}</span>
              </div>
            )}
            <div className="info-row">
              <span className="info-label">Joints:</span>
              <span className="info-value">{selectedKeyframe.jointValues.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
