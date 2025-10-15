// MJCF Loading Status Popup - Shows detailed loading progress and results
// Owner: George
// Location: src/ui/components/MJCFLoadingStatus.tsx

import React, { useState } from 'react';
import { CheckCircle, AlertCircle, Info, X, Loader2, Bot, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { create } from 'zustand';

export type MJCFLoadingStatus = 'idle' | 'loading' | 'success' | 'error' | 'warning';

export interface MJCFFileLoadingState {
  fileName: string;
  status: MJCFLoadingStatus;
  message: string;
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

export interface MJCFLoadingState {
  files: MJCFFileLoadingState[];
  currentFileIndex: number;
  totalFiles: number;
  overallStatus: MJCFLoadingStatus;
}

interface MJCFLoadingStore {
  loadingState: MJCFLoadingState;
  setLoadingState: (state: Partial<MJCFLoadingState>) => void;
  addFile: (fileName: string) => void;
  updateFile: (fileName: string, update: Partial<MJCFFileLoadingState>) => void;
  resetLoadingState: () => void;
  showPopup: boolean;
  setShowPopup: (show: boolean) => void;
}

const initialLoadingState: MJCFLoadingState = {
  files: [],
  currentFileIndex: 0,
  totalFiles: 0,
  overallStatus: 'idle',
};

export const useMJCFLoadingStore = create<MJCFLoadingStore>((set) => ({
  loadingState: initialLoadingState,
  showPopup: false,

  setLoadingState: (newState) =>
    set((state) => ({
      loadingState: { ...state.loadingState, ...newState },
    })),

  addFile: (fileName: string) =>
    set((state) => ({
      loadingState: {
        ...state.loadingState,
        files: [
          ...state.loadingState.files,
          {
            fileName,
            status: 'idle',
            message: '',
            stats: { bodies: 0, meshes: 0, joints: 0, actuators: 0, sensors: 0 },
            keyframeInfo: { found: false, count: 0, applied: false },
            modelType: { isOBJBased: false, isSTLBased: false, isMixed: false },
          },
        ],
        totalFiles: state.loadingState.totalFiles + 1,
      },
    })),

  updateFile: (fileName: string, update: Partial<MJCFFileLoadingState>) =>
    set((state) => ({
      loadingState: {
        ...state.loadingState,
        files: state.loadingState.files.map((file) =>
          file.fileName === fileName ? { ...file, ...update } : file
        ),
      },
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
  startBatch: (fileNames: string[]) => {
    useMJCFLoadingStore.getState().resetLoadingState();
    fileNames.forEach(fileName => {
      useMJCFLoadingStore.getState().addFile(fileName);
    });
    useMJCFLoadingStore.getState().setLoadingState({
      overallStatus: 'loading',
    });
    useMJCFLoadingStore.getState().setShowPopup(true);
  },

  start: (fileName: string) => {
    const store = useMJCFLoadingStore.getState();
    const existingFile = store.loadingState.files.find(f => f.fileName === fileName);

    if (!existingFile) {
      store.addFile(fileName);
    }

    store.updateFile(fileName, {
      status: 'loading',
      message: 'Starting MJCF import...',
    });
    store.setLoadingState({ overallStatus: 'loading' });
    store.setShowPopup(true);
  },

  // Update progress (legacy - ignored in new system)
  updateProgress: (_progress: number, _message: string) => {
    // No-op in new system - kept for backward compatibility
  },

  // Add warning (legacy - ignored in new system)
  addWarning: (_warning: string) => {
    // No-op in new system - kept for backward compatibility
  },

  // Add error (legacy - ignored in new system)
  addError: (_error: string) => {
    // No-op in new system - kept for backward compatibility
  },

  setModelAnalysis: (fileNameOrModelType: string | Partial<MJCFFileLoadingState['modelType']>, statsOrModelType?: Partial<MJCFFileLoadingState['stats']> | Partial<MJCFFileLoadingState['modelType']>, maybeStats?: Partial<MJCFFileLoadingState['stats']>) => {
    const store = useMJCFLoadingStore.getState();

    // New API: setModelAnalysis(fileName, modelType, stats)
    if (typeof fileNameOrModelType === 'string') {
      const fileName = fileNameOrModelType;
      const modelType = statsOrModelType as Partial<MJCFFileLoadingState['modelType']>;
      const stats = maybeStats!;
      const file = store.loadingState.files.find(f => f.fileName === fileName);
      if (file) {
        store.updateFile(fileName, {
          modelType: { ...file.modelType, ...modelType },
          stats: { ...file.stats, ...stats },
        });
      }
    } else {
      // Legacy API: setModelAnalysis(modelType, stats) - applies to currently loading file
      const modelType = fileNameOrModelType;
      const stats = statsOrModelType as Partial<MJCFFileLoadingState['stats']>;
      const currentFile = store.loadingState.files.find(f => f.status === 'loading');
      if (currentFile) {
        store.updateFile(currentFile.fileName, {
          modelType: { ...currentFile.modelType, ...modelType },
          stats: { ...currentFile.stats, ...stats },
        });
      }
    }
  },

  setKeyframeInfo: (fileNameOrKeyframeInfo: string | Partial<MJCFFileLoadingState['keyframeInfo']>, maybeKeyframeInfo?: Partial<MJCFFileLoadingState['keyframeInfo']>) => {
    const store = useMJCFLoadingStore.getState();

    // New API: setKeyframeInfo(fileName, keyframeInfo)
    if (typeof fileNameOrKeyframeInfo === 'string') {
      const fileName = fileNameOrKeyframeInfo;
      const keyframeInfo = maybeKeyframeInfo!;
      const file = store.loadingState.files.find(f => f.fileName === fileName);
      if (file) {
        store.updateFile(fileName, {
          keyframeInfo: { ...file.keyframeInfo, ...keyframeInfo },
        });
      }
    } else {
      // Legacy API: setKeyframeInfo(keyframeInfo) - applies to currently loading file
      const keyframeInfo = fileNameOrKeyframeInfo;
      const currentFile = store.loadingState.files.find(f => f.status === 'loading');
      if (currentFile) {
        store.updateFile(currentFile.fileName, {
          keyframeInfo: { ...currentFile.keyframeInfo, ...keyframeInfo },
        });
      }
    }
  },

  success: (fileNameOrMessage: string, maybeDetails?: string | string[]) => {
    const store = useMJCFLoadingStore.getState();

    // Determine if this is new API (fileName, message) or legacy API (message, details[])
    const isNewAPI = store.loadingState.files.some(f => f.fileName === fileNameOrMessage);

    if (isNewAPI) {
      // New API: success(fileName, message)
      const fileName = fileNameOrMessage;
      const message = typeof maybeDetails === 'string' ? maybeDetails : 'Import complete';
      store.updateFile(fileName, {
        status: 'success',
        message,
      });
    } else {
      // Legacy API: success(message, details[]) - applies to currently loading file
      const message = fileNameOrMessage;
      const currentFile = store.loadingState.files.find(f => f.status === 'loading');
      if (currentFile) {
        store.updateFile(currentFile.fileName, {
          status: 'success',
          message,
        });
      }
    }

    // Update overall status if all files are done
    const allDone = store.loadingState.files.every(f =>
      f.status === 'success' || f.status === 'error' || f.status === 'warning'
    );
    if (allDone) {
      const hasErrors = store.loadingState.files.some(f => f.status === 'error');
      const hasWarnings = store.loadingState.files.some(f => f.status === 'warning');
      store.setLoadingState({
        overallStatus: hasErrors ? 'error' : hasWarnings ? 'warning' : 'success',
      });
    }
  },

  error: (fileNameOrMessage: string, maybeErrors?: string | string[]) => {
    const store = useMJCFLoadingStore.getState();

    // Determine if this is new API (fileName, message) or legacy API (message, errors[])
    const isNewAPI = store.loadingState.files.some(f => f.fileName === fileNameOrMessage);

    if (isNewAPI) {
      // New API: error(fileName, message)
      const fileName = fileNameOrMessage;
      const message = typeof maybeErrors === 'string' ? maybeErrors : 'Import failed';
      store.updateFile(fileName, {
        status: 'error',
        message,
      });
    } else {
      // Legacy API: error(message, errors[]) - applies to currently loading file
      const message = fileNameOrMessage;
      const currentFile = store.loadingState.files.find(f => f.status === 'loading');
      if (currentFile) {
        store.updateFile(currentFile.fileName, {
          status: 'error',
          message,
        });
      }
    }

    // Update overall status if all files are done
    const allDone = store.loadingState.files.every(f =>
      f.status === 'success' || f.status === 'error' || f.status === 'warning'
    );
    if (allDone) {
      store.setLoadingState({ overallStatus: 'error' });
    }
  },

  warning: (fileNameOrMessage: string, maybeWarnings?: string | string[]) => {
    const store = useMJCFLoadingStore.getState();

    // Determine if this is new API (fileName, message) or legacy API (message, warnings[])
    const isNewAPI = store.loadingState.files.some(f => f.fileName === fileNameOrMessage);

    if (isNewAPI) {
      // New API: warning(fileName, message)
      const fileName = fileNameOrMessage;
      const message = typeof maybeWarnings === 'string' ? maybeWarnings : 'Import completed with warnings';
      store.updateFile(fileName, {
        status: 'warning',
        message,
      });
    } else {
      // Legacy API: warning(message, warnings[]) - applies to currently loading file
      const message = fileNameOrMessage;
      const currentFile = store.loadingState.files.find(f => f.status === 'loading');
      if (currentFile) {
        store.updateFile(currentFile.fileName, {
          status: 'warning',
          message,
        });
      }
    }

    // Update overall status if all files are done
    const allDone = store.loadingState.files.every(f =>
      f.status === 'success' || f.status === 'error' || f.status === 'warning'
    );
    if (allDone) {
      const hasErrors = store.loadingState.files.some(f => f.status === 'error');
      store.setLoadingState({
        overallStatus: hasErrors ? 'error' : 'warning',
      });
    }
  },
};

// Status indicator component for individual files (expandable)
const FileStatusIndicator: React.FC<{ file: MJCFFileLoadingState }> = ({ file }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const icons = {
    idle: <Info className="w-4 h-4 text-gray-400" />,
    loading: <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />,
    success: <CheckCircle className="w-4 h-4 text-green-400" />,
    error: <AlertCircle className="w-4 h-4 text-red-400" />,
    warning: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
  };

  const bgColors = {
    idle: 'bg-gray-800 border-gray-700',
    loading: 'bg-blue-900/30 border-blue-700',
    success: 'bg-green-900/30 border-green-700',
    error: 'bg-red-900/30 border-red-700',
    warning: 'bg-yellow-900/30 border-yellow-700',
  };

  const modelTypeText = file.modelType.isOBJBased ? 'OBJ-based' :
                        file.modelType.isSTLBased ? 'STL-based' :
                        file.modelType.isMixed ? 'Mixed' : 'Unknown';

  const canExpand = file.status === 'success' || file.status === 'error' || file.status === 'warning';

  return (
    <div className={`${bgColors[file.status]} border rounded`}>
      {/* Main row - always visible */}
      <div
        className={`flex items-center gap-2 px-3 py-2 ${canExpand ? 'cursor-pointer hover:bg-white/5' : ''}`}
        onClick={() => canExpand && setIsExpanded(!isExpanded)}
      >
        {canExpand && (
          isExpanded ? <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
        )}
        {icons[file.status]}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-white truncate">{file.fileName}</p>
          {file.status === 'success' && !isExpanded && (
            <p className="text-xs text-gray-400">
              {file.stats.bodies}B • {file.stats.meshes}M • {file.stats.joints}J
              {file.keyframeInfo.found && ` • ${file.keyframeInfo.count}K`}
            </p>
          )}
          {file.status === 'loading' && (
            <p className="text-xs text-blue-400">Loading...</p>
          )}
          {file.status === 'error' && file.message && !isExpanded && (
            <p className="text-xs text-red-400 truncate">{file.message}</p>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-3 pb-2 pt-1 border-t border-gray-700/50 space-y-2">
          {/* Success details */}
          {file.status === 'success' && (
            <>
              <div>
                <p className="text-xs font-medium text-gray-300 mb-1">Model Type:</p>
                <p className="text-xs text-gray-400">{modelTypeText}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-300 mb-1">Statistics:</p>
                <div className="grid grid-cols-2 gap-1 text-xs text-gray-400">
                  <div>• Bodies: {file.stats.bodies}</div>
                  <div>• Meshes: {file.stats.meshes}</div>
                  <div>• Joints: {file.stats.joints}</div>
                  <div>• Actuators: {file.stats.actuators}</div>
                  {file.stats.sensors > 0 && <div>• Sensors: {file.stats.sensors}</div>}
                </div>
              </div>
              {file.keyframeInfo.found && (
                <div>
                  <p className="text-xs font-medium text-gray-300 mb-1">Keyframes:</p>
                  <p className="text-xs text-gray-400">
                    Found {file.keyframeInfo.count} keyframe{file.keyframeInfo.count !== 1 ? 's' : ''}
                    {file.keyframeInfo.applied && ' (applied)'}
                  </p>
                </div>
              )}
              {file.message && (
                <div>
                  <p className="text-xs text-gray-400">{file.message}</p>
                </div>
              )}
            </>
          )}

          {/* Error details */}
          {file.status === 'error' && (
            <div>
              <p className="text-xs font-medium text-red-300 mb-1">Error:</p>
              <p className="text-xs text-red-400">{file.message || 'Unknown error occurred'}</p>
            </div>
          )}

          {/* Warning details */}
          {file.status === 'warning' && (
            <>
              <div>
                <p className="text-xs font-medium text-yellow-300 mb-1">Warning:</p>
                <p className="text-xs text-yellow-400">{file.message || 'Import completed with warnings'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-300 mb-1">Statistics:</p>
                <div className="grid grid-cols-2 gap-1 text-xs text-gray-400">
                  <div>• Bodies: {file.stats.bodies}</div>
                  <div>• Meshes: {file.stats.meshes}</div>
                  <div>• Joints: {file.stats.joints}</div>
                  <div>• Actuators: {file.stats.actuators}</div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Overall status header
const OverallStatusHeader: React.FC<{ status: MJCFLoadingStatus; totalFiles: number; completedFiles: number }> = ({ status, totalFiles, completedFiles }) => {
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
    <div className={`${bgColors[status]} border rounded-lg p-3`}>
      <div className="flex items-center gap-3">
        {icons[status]}
        <div className="flex-1">
          <h3 className="text-sm font-medium text-white">
            MJCF Import Status
          </h3>
          <p className="text-xs text-gray-300">
            {status === 'loading' ? `Processing ${completedFiles}/${totalFiles}...` :
             status === 'success' ? `Import Complete (${completedFiles}/${totalFiles})` :
             status === 'error' ? `Import Failed (${completedFiles}/${totalFiles})` :
             status === 'warning' ? `Complete with Warnings (${completedFiles}/${totalFiles})` : 'Ready'}
          </p>
        </div>
      </div>
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

  const completedFiles = loadingState.files.filter(f =>
    f.status === 'success' || f.status === 'error' || f.status === 'warning'
  ).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 max-w-md w-full mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-semibold text-white">MJCF Import</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Overall status header */}
        <div className="mb-3">
          <OverallStatusHeader
            status={loadingState.overallStatus}
            totalFiles={loadingState.totalFiles}
            completedFiles={completedFiles}
          />
        </div>

        {/* File list - compact scrollable */}
        <div className="space-y-2 max-h-96 overflow-y-auto mb-3 pr-1">
          {loadingState.files.map((file, index) => (
            <FileStatusIndicator key={index} file={file} />
          ))}
        </div>

        {/* Close button */}
        <div className="flex justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
          >
            {loadingState.overallStatus === 'loading' ? 'Hide' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
