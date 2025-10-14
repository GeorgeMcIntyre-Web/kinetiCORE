// MJCF Loading Status Popup - Shows detailed loading progress and results
// Owner: George
// Location: src/ui/components/MJCFLoadingStatus.tsx

import React from 'react';
import { CheckCircle, AlertCircle, Info, X, Loader2, Bot, FileText, AlertTriangle } from 'lucide-react';
import { create } from 'zustand';

export type MJCFLoadingStatus = 'idle' | 'loading' | 'success' | 'error' | 'warning';

export interface MJCFLoadingState {
  status: MJCFLoadingStatus;
  fileName: string;
  progress: number;
  message: string;
  details: string[];
  warnings: string[];
  errors: string[];
  stats: {
    bodies: number;
    meshes: number;
    joints: number;
    actuators: number;
    sensors: number;
  };
  keyframeInfo: {
    found: boolean;
    count: number;
    applied: boolean;
  };
  modelType: {
    isOBJBased: boolean;
    isSTLBased: boolean;
    isMixed: boolean;
  };
}

interface MJCFLoadingStore {
  loadingState: MJCFLoadingState;
  setLoadingState: (state: Partial<MJCFLoadingState>) => void;
  resetLoadingState: () => void;
  showPopup: boolean;
  setShowPopup: (show: boolean) => void;
}

const initialLoadingState: MJCFLoadingState = {
  status: 'idle',
  fileName: '',
  progress: 0,
  message: '',
  details: [],
  warnings: [],
  errors: [],
  stats: {
    bodies: 0,
    meshes: 0,
    joints: 0,
    actuators: 0,
    sensors: 0,
  },
  keyframeInfo: {
    found: false,
    count: 0,
    applied: false,
  },
  modelType: {
    isOBJBased: false,
    isSTLBased: false,
    isMixed: false,
  },
};

export const useMJCFLoadingStore = create<MJCFLoadingStore>((set) => ({
  loadingState: initialLoadingState,
  showPopup: false,

  setLoadingState: (newState) =>
    set((state) => ({
      loadingState: { ...state.loadingState, ...newState },
    })),

  resetLoadingState: () =>
    set({
      loadingState: initialLoadingState,
      showPopup: false,
    }),

  setShowPopup: (show) => set({ showPopup: show }),
}));

// Helper functions for updating loading state
export const mjcfLoading = {
  start: (fileName: string) => {
    useMJCFLoadingStore.getState().setLoadingState({
      status: 'loading',
      fileName,
      progress: 0,
      message: 'Starting MJCF import...',
      details: [],
      warnings: [],
      errors: [],
    });
    useMJCFLoadingStore.getState().setShowPopup(true);
  },

  updateProgress: (progress: number, message: string, details?: string[]) => {
    useMJCFLoadingStore.getState().setLoadingState({
      progress,
      message,
      details: details || [],
    });
  },

  setModelAnalysis: (modelType: Partial<MJCFLoadingState['modelType']>, stats: Partial<MJCFLoadingState['stats']>) => {
    useMJCFLoadingStore.getState().setLoadingState({
      modelType: { ...useMJCFLoadingStore.getState().loadingState.modelType, ...modelType },
      stats: { ...useMJCFLoadingStore.getState().loadingState.stats, ...stats },
    });
  },

  setKeyframeInfo: (keyframeInfo: Partial<MJCFLoadingState['keyframeInfo']>) => {
    useMJCFLoadingStore.getState().setLoadingState({
      keyframeInfo: { ...useMJCFLoadingStore.getState().loadingState.keyframeInfo, ...keyframeInfo },
    });
  },

  addWarning: (warning: string) => {
    const state = useMJCFLoadingStore.getState().loadingState;
    useMJCFLoadingStore.getState().setLoadingState({
      warnings: [...state.warnings, warning],
    });
  },

  addError: (error: string) => {
    const state = useMJCFLoadingStore.getState().loadingState;
    useMJCFLoadingStore.getState().setLoadingState({
      errors: [...state.errors, error],
    });
  },

  success: (message: string, details?: string[]) => {
    useMJCFLoadingStore.getState().setLoadingState({
      status: 'success',
      progress: 100,
      message,
      details: details || [],
    });
  },

  error: (message: string, errors?: string[]) => {
    useMJCFLoadingStore.getState().setLoadingState({
      status: 'error',
      progress: 0,
      message,
      errors: errors || [],
    });
  },

  warning: (message: string, warnings?: string[]) => {
    useMJCFLoadingStore.getState().setLoadingState({
      status: 'warning',
      progress: 100,
      message,
      warnings: warnings || [],
    });
  },
};

// Status indicator component
const StatusIndicator: React.FC<{ status: MJCFLoadingStatus }> = ({ status }) => {
  const icons = {
    idle: <Info className="w-5 h-5 text-gray-400" />,
    loading: <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />,
    success: <CheckCircle className="w-5 h-5 text-green-400" />,
    error: <AlertCircle className="w-5 h-5 text-red-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-400" />,
  };

  const bgColors = {
    idle: 'bg-gray-900 border-gray-700',
    loading: 'bg-blue-900 border-blue-700',
    success: 'bg-green-900 border-green-700',
    error: 'bg-red-900 border-red-700',
    warning: 'bg-yellow-900 border-yellow-700',
  };

  return (
    <div className={`${bgColors[status]} border rounded-lg p-4 shadow-lg max-w-md`}>
      <div className="flex items-center gap-3">
        {icons[status]}
        <div className="flex-1">
          <h3 className="text-sm font-medium text-white mb-1">
            MJCF Import Status
          </h3>
          <p className="text-xs text-gray-300">
            {status === 'loading' ? 'Processing...' : 
             status === 'success' ? 'Import Complete' :
             status === 'error' ? 'Import Failed' :
             status === 'warning' ? 'Import Complete with Warnings' : 'Ready'}
          </p>
        </div>
      </div>
    </div>
  );
};

// Progress bar component
const ProgressBar: React.FC<{ progress: number; status: MJCFLoadingStatus }> = ({ progress, status }) => {
  const colors = {
    idle: 'bg-gray-600',
    loading: 'bg-blue-500',
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
  };

  return (
    <div className="w-full bg-gray-700 rounded-full h-2">
      <div
        className={`${colors[status]} h-2 rounded-full transition-all duration-300`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

// Main popup component
export const MJCFLoadingStatusPopup: React.FC = () => {
  const { loadingState, showPopup, setShowPopup } = useMJCFLoadingStore();

  if (!showPopup) return null;

  const handleClose = () => {
    setShowPopup(false);
    // Auto-reset after a delay
    setTimeout(() => {
      useMJCFLoadingStore.getState().resetLoadingState();
    }, 1000);
  };

  const getStatusMessage = () => {
    const { status, message, fileName, keyframeInfo, modelType, stats } = loadingState;
    
    if (status === 'success') {
      const modelTypeText = modelType.isOBJBased ? 'OBJ-based' : 
                           modelType.isSTLBased ? 'STL-based' : 
                           modelType.isMixed ? 'Mixed' : 'Unknown';
      
      const keyframeText = keyframeInfo.found ? 
        `Found ${keyframeInfo.count} keyframe${keyframeInfo.count !== 1 ? 's' : ''}` : 
        'No keyframes found';
      
      return `${fileName} loaded successfully! ${modelTypeText} model with ${stats.bodies} bodies, ${stats.meshes} meshes, ${stats.joints} joints. ${keyframeText}.`;
    }
    
    if (status === 'error') {
      return `Failed to load ${fileName}: ${message}`;
    }
    
    if (status === 'warning') {
      return `${fileName} loaded with warnings: ${message}`;
    }
    
    return message || 'Processing MJCF file...';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Bot className="w-6 h-6 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">MJCF Import</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Status indicator */}
        <div className="mb-4">
          <StatusIndicator status={loadingState.status} />
        </div>

        {/* Progress bar */}
        {loadingState.status === 'loading' && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Progress</span>
              <span>{loadingState.progress}%</span>
            </div>
            <ProgressBar progress={loadingState.progress} status={loadingState.status} />
          </div>
        )}

        {/* Main message */}
        <div className="mb-4">
          <p className="text-sm text-white">{getStatusMessage()}</p>
        </div>

        {/* Details */}
        {loadingState.details.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-medium text-gray-300 mb-2">Details:</h4>
            <ul className="text-xs text-gray-400 space-y-1">
              {loadingState.details.map((detail, index) => (
                <li key={index} className="flex items-center gap-2">
                  <FileText size={12} />
                  {detail}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Warnings */}
        {loadingState.warnings.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-medium text-yellow-300 mb-2">Warnings:</h4>
            <ul className="text-xs text-yellow-400 space-y-1">
              {loadingState.warnings.map((warning, index) => (
                <li key={index} className="flex items-center gap-2">
                  <AlertTriangle size={12} />
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Errors */}
        {loadingState.errors.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-medium text-red-300 mb-2">Errors:</h4>
            <ul className="text-xs text-red-400 space-y-1">
              {loadingState.errors.map((error, index) => (
                <li key={index} className="flex items-center gap-2">
                  <AlertCircle size={12} />
                  {error}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Stats */}
        {loadingState.status === 'success' && (
          <div className="mb-4">
            <h4 className="text-xs font-medium text-gray-300 mb-2">Model Statistics:</h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
              <div>Bodies: {loadingState.stats.bodies}</div>
              <div>Meshes: {loadingState.stats.meshes}</div>
              <div>Joints: {loadingState.stats.joints}</div>
              <div>Actuators: {loadingState.stats.actuators}</div>
            </div>
          </div>
        )}

        {/* Close button */}
        <div className="flex justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
          >
            {loadingState.status === 'loading' ? 'Cancel' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
