// LoadingIndicator - Progress indicator for file operations
// Owner: Edwin
// Location: src/ui/components/LoadingIndicator.tsx

import { Loader2, Upload, Download, FileText } from 'lucide-react';
import { create } from 'zustand';

interface LoadingState {
  isLoading: boolean;
  message: string;
  progress?: number;
  type: 'loading' | 'uploading' | 'downloading' | 'processing';
}

interface LoadingStore extends LoadingState {
  setLoading: (state: Partial<LoadingState>) => void;
  clearLoading: () => void;
}

export const useLoadingStore = create<LoadingStore>((set) => ({
  isLoading: false,
  message: '',
  progress: undefined,
  type: 'loading',

  setLoading: (state) => set((prev) => ({ ...prev, isLoading: true, ...state })),
  clearLoading: () => set({ isLoading: false, message: '', progress: undefined, type: 'loading' }),
}));

// Helper functions
export const loading = {
  start: (message: string, type: LoadingState['type'] = 'loading') => {
    useLoadingStore.getState().setLoading({ message, type, progress: undefined });
  },

  update: (message: string, progress?: number) => {
    useLoadingStore.getState().setLoading({ message, progress });
  },

  end: () => {
    useLoadingStore.getState().clearLoading();
  },
};

export const LoadingIndicator: React.FC = () => {
  const { isLoading, message, progress, type } = useLoadingStore();

  if (!isLoading) return null;

  const icons = {
    loading: <Loader2 className="w-6 h-6 animate-spin" />,
    uploading: <Upload className="w-6 h-6" />,
    downloading: <Download className="w-6 h-6" />,
    processing: <FileText className="w-6 h-6" />,
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999]">
      <div className="bg-gray-900 border-2 border-blue-500 rounded-lg p-8 min-w-[400px] shadow-2xl">
        <div className="flex flex-col items-center gap-4">
          {/* Icon */}
          <div className="text-blue-400">
            {icons[type]}
          </div>

          {/* Message */}
          <p className="text-white text-lg font-medium text-center">
            {message}
          </p>

          {/* Progress bar */}
          {progress !== undefined && (
            <div className="w-full">
              <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
              <p className="text-center text-sm text-gray-400 mt-2">
                {Math.round(progress)}%
              </p>
            </div>
          )}

          {/* Spinner for indeterminate progress */}
          {progress === undefined && type === 'loading' && (
            <div className="flex gap-2 justify-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
