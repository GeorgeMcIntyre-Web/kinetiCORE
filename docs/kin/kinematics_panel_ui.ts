// src/ui/components/KinematicsPanel.tsx
// Kinematics Panel - Progressive workflow from grounding to motion
// Owner: Edwin

import { useState, useEffect } from 'react';
import { 
  Anchor, 
  Link2, 
  Play, 
  Settings, 
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Zap,
  Target
} from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { KinematicsManager } from '../../kinematics/KinematicsManager';
import type { JointType } from '../../kinematics/KinematicsManager';
import './KinematicsPanel.css';

/**
 * Workflow steps for kinematics setup
 */
type WorkflowStep = 
  | 'select_model'    // Select imported model
  | 'ground_base'     // Ground the base part
  | 'create_joints'   // Define joints
  | 'test_motion'     // Test kinematics
  | 'complete';       // All done

interface KinematicsPanelProps {
  onClose?: () => void;
}

export const KinematicsPanel: React.FC<KinematicsPanelProps> = ({ onClose }) => {
  const selectedNodeId = useEditorStore(state => state.selectedNodeId);
  const kinematicsManager = KinematicsManager.getInstance();
  
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('select_model');
  const [groundedNodeId, setGroundedNodeId] = useState<string | null>(null);
  const [suggestedGroundId, setSuggestedGroundId] = useState<string | null>(null);
  const [joints, setJoints] = useState<any[]>([]);
  const [showJointCreator, setShowJointCreator] = useState(false);
  
  // Joint creation state
  const [jointParent, setJointParent] = useState<string>('');
  const [jointChild, setJointChild] = useState<string>('');
  const [jointType, setJointType] = useState<JointType>('revolute');
  const [jointName, setJointName] = useState('');

  // Auto-suggest ground node when model is selected
  useEffect(() => {
    if (selectedNodeId && currentStep === 'select_model') {
      const suggested = kinematicsManager.suggestGroundNode(selectedNodeId);
      setSuggestedGroundId(suggested);
      setCurrentStep('ground_base');
    }
  }, [selectedNodeId]);

  // Update joints list
  useEffect(() => {
    const updateJoints = () => {
      setJoints(kinematicsManager.getAllJoints());
    };
    
    updateJoints();
    const interval = setInterval(updateJoints, 500);
    return () => clearInterval(interval);
  }, []);

  const handleGroundNode = (nodeId: string) => {
    const success = kinematicsManager.groundNode(nodeId);
    if (success) {
      setGroundedNodeId(nodeId);
      setCurrentStep('create_joints');
    }
  };

  const handleQuickGround = () => {
    if (suggestedGroundId) {
      handleGroundNode(suggestedGroundId);
    }
  };

  const handleCreateJoint = () => {
    if (!jointParent || !jointChild) {
      alert('Please select both parent and child parts');
      return;
    }

    const joint = kinematicsManager.createJoint({
      name: jointName || `Joint_${joints.length + 1}`,
      type: jointType,
      parentNodeId: jointParent,
      childNodeId: jointChild,
    });

    if (joint) {
      setShowJointCreator(false);
      setJointParent('');
      setJointChild('');
      setJointName('');
      
      // Move to test step if we have joints
      if (joints.length === 0) {
        setCurrentStep('test_motion');
      }
    }
  };

  const handleDeleteJoint = (jointId: string) => {
    if (confirm('Delete this joint?')) {
      kinematicsManager.deleteJoint(jointId);
    }
  };

  return (
    <div className="kinematics-panel">
      <div className="panel-header">
        <h2>Kinematics Setup</h2>
        {onClose && (
          <button className="close-button" onClick={onClose}>×</button>
        )}
      </div>

      {/* Progress Indicator */}
      <div className="workflow-progress">
        <div className={`step ${currentStep === 'select_model' || currentStep === 'ground_base' ? 'active' : 'complete'}`}>
          <div className="step-number">1</div>
          <div className="step-label">Select Model</div>
        </div>
        <ChevronRight size={16} className="step-arrow" />
        
        <div className={`step ${currentStep === 'ground_base' ? 'active' : currentStep === 'create_joints' || currentStep === 'test_motion' || currentStep === 'complete' ? 'complete' : ''}`}>
          <div className="step-number">2</div>
          <div className="step-label">Ground Base</div>
        </div>
        <ChevronRight size={16} className="step-arrow" />
        
        <div className={`step ${currentStep === 'create_joints' ? 'active' : currentStep === 'test_motion' || currentStep === 'complete' ? 'complete' : ''}`}>
          <div className="step-number">3</div>
          <div className="step-label">Create Joints</div>
        </div>
        <ChevronRight size={16} className="step-arrow" />
        
        <div className={`step ${currentStep === 'test_motion' || currentStep === 'complete' ? 'active' : ''}`}>
          <div className="step-number">4</div>
          <div className="step-label">Test Motion</div>
        </div>
      </div>

      <div className="panel-content">
        {/* Step 1: Select Model */}
        {currentStep === 'select_model' && (
          <div className="step-content">
            <div className="info-box">
              <AlertCircle size={20} />
              <p>Select an imported model in the scene tree to begin</p>
            </div>
            <div className="instructions">
              <h3>Getting Started</h3>
              <ol>
                <li>Import a GLB file using the toolbar</li>
                <li>Click on the model in the scene tree</li>
                <li>We'll guide you through setting up kinematics</li>
              </ol>
            </div>
          </div>
        )}

        {/* Step 2: Ground Base */}
        {currentStep === 'ground_base' && (
          <div className="step-content">
            <div className="section-header">
              <Anchor size={20} />
              <h3>Ground the Base Part</h3>
            </div>
            
            <p className="instruction-text">
              First, we need to anchor the base part to the world. This is the part that won't move.
            </p>

            {suggestedGroundId && !groundedNodeId && (
              <div className="suggestion-box">
                <div className="suggestion-header">
                  <Zap size={18} />
                  <span>Smart Suggestion</span>
                </div>
                <p>We detected this part as the likely base:</p>
                <button 
                  className="quick-action-button"
                  onClick={handleQuickGround}
                >
                  <Target size={16} />
                  Ground Suggested Part
                </button>
                <p className="hint">Or select a different part from the scene tree and click below</p>
              </div>
            )}

            {selectedNodeId && !groundedNodeId && (
              <button 
                className="primary-button"
                onClick={() => handleGroundNode(selectedNodeId)}
              >
                <Anchor size={16} />
                Ground Selected Part
              </button>
            )}

            {groundedNodeId && (
              <div className="success-box">
                <CheckCircle size={20} />
                <p>Base part grounded successfully!</p>
                <button 
                  className="next-button"
                  onClick={() => setCurrentStep('create_joints')}
                >
                  Next: Create Joints
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Create Joints */}
        {currentStep === 'create_joints' && (
          <div className="step-content">
            <div className="section-header">
              <Link2 size={20} />
              <h3>Define Joints</h3>
            </div>

            <p className="instruction-text">
              Create joints to connect moving parts to each other or to the base.
            </p>

            {/* Joint List */}
            <div className="joints-list">
              {joints.map(joint => (
                <div key={joint.id} className="joint-item">
                  <div className="joint-info">
                    <Settings size={16} />
                    <span className="joint-name">{joint.name}</span>
                    <span className="joint-type">{joint.type}</span>
                  </div>
                  <button 
                    className="delete-button"
                    onClick={() => handleDeleteJoint(joint.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
              
              {joints.length === 0 && (
                <div className="empty-state">
                  <p>No joints created yet</p>
                </div>
              )}
            </div>

            {/* Joint Creator */}
            {!showJointCreator && (
              <button 
                className="primary-button"
                onClick={() => setShowJointCreator(true)}
              >
                + Create Joint
              </button>
            )}

            {showJointCreator && (
              <div className="joint-creator">
                <h4>New Joint</h4>
                
                <div className="form-group">
                  <label>Joint Name (optional)</label>
                  <input 
                    type="text"
                    placeholder="e.g., Shoulder Joint"
                    value={jointName}
                    onChange={(e) => setJointName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Joint Type</label>
                  <select 
                    value={jointType}
                    onChange={(e) => setJointType(e.target.value as JointType)}
                  >
                    <option value="revolute">Revolute (Rotation)</option>
                    <option value="prismatic">Prismatic (Sliding)</option>
                    <option value="fixed">Fixed (Rigid)</option>
                    <option value="spherical">Spherical (Ball Joint)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Parent Part (Fixed Side)</label>
                  <input 
                    type="text"
                    placeholder="Select from scene tree"
                    value={jointParent}
                    readOnly
                  />
                  <p className="hint">Click on the parent part in the scene tree</p>
                </div>

                <div className="form-group">
                  <label>Child Part (Moving Side)</label>
                  <input 
                    type="text"
                    placeholder="Select from scene tree"
                    value={jointChild}
                    readOnly
                  />
                  <p className="hint">Click on the child part in the scene tree</p>
                </div>

                <div className="button-group">
                  <button 
                    className="secondary-button"
                    onClick={() => setShowJointCreator(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    className="primary-button"
                    onClick={handleCreateJoint}
                  >
                    Create Joint
                  </button>
                </div>
              </div>
            )}

            {joints.length > 0 && (
              <button 
                className="next-button"
                onClick={() => setCurrentStep('test_motion')}
              >
                Next: Test Motion
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        )}

        {/* Step 4: Test Motion */}
        {currentStep === 'test_motion' && (
          <div className="step-content">
            <div className="section-header">
              <Play size={20} />
              <h3>Test Motion</h3>
            </div>

            <p className="instruction-text">
              Test your kinematic chain by moving the joints interactively.
            </p>

            <div className="joints-control">
              {joints.map(joint => (
                <div key={joint.id} className="joint-control">
                  <label>{joint.name}</label>
                  <div className="slider-group">
                    <span className="value">
                      {joint.type === 'revolute' 
                        ? `${(joint.position * 180 / Math.PI).toFixed(1)}°`
                        : `${joint.position.toFixed(1)}mm`
                      }
                    </span>
                    <input 
                      type="range"
                      min={joint.limits.lower}
                      max={joint.limits.upper}
                      value={joint.position}
                      step="0.01"
                      onChange={(e) => {
                        // TODO: Update joint position
                        console.log('Update joint:', joint.id, e.target.value);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="success-box">
              <CheckCircle size={20} />
              <p>Kinematics setup complete!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
