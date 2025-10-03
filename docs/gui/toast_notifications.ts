// ToastNotifications - User feedback toast system
// Owner: Edwin
// Location: src/ui/components/ToastNotifications.tsx

import { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

// Zustand store for toast management
export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  
  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast = { ...toast, id };
    
    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));
    
    // Auto-remove after duration
    const duration = toast.duration || 3000;
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, duration);
  },
  
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

// Helper functions for common toasts
export const toast = {
  success: (message: string, duration?: number) => {
    useToastStore.getState().addToast({ type: 'success', message, duration });
  },
  error: (message: string, duration?: number) => {
    useToastStore.getState().addToast({ type: 'error', message, duration: duration || 5000 });
  },
  info: (message: string, duration?: number) => {
    useToastStore.getState().addToast({ type: 'info', message, duration });
  },
  warning: (message: string, duration?: number) => {
    useToastStore.getState().addToast({ type: 'warning', message, duration });
  },
};

// Toast component
const ToastItem: React.FC<{ toast: Toast; onClose: () => void }> = ({ toast, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300); // Match animation duration
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-400" />,
    error: <AlertCircle className="w-5 h-5 text-red-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />,
    warning: <AlertCircle className="w-5 h-5 text-yellow-400" />,
  };

  const bgColors = {
    success: 'bg-green-900 border-green-700',
    error: 'bg-red-900 border-red-700',
    info: 'bg-blue-900 border-blue-700',
    warning: 'bg-yellow-900 border-yellow-700',
  };

  return (
    <div
      className={`
        ${bgColors[toast.type]} border rounded-lg p-4 shadow-lg
        flex items-center gap-3 min-w-[300px] max-w-[500px]
        transform transition-all duration-300
        ${isExiting 
          ? 'translate-x-full opacity-0' 
          : 'translate-x-0 opacity-100'
        }
      `}
    >
      {icons[toast.type]}
      <p className="flex-1 text-sm text-white">{toast.message}</p>
      <button
        onClick={handleClose}
        className="text-gray-400 hover:text-white transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
};

// Toast container component
export const ToastNotifications: React.FC = () => {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onClose={() => removeToast(toast.id)} />
        </div>
      ))}
    </div>
  );
};

// Example usage:
// import { toast } from '@/ui/components/ToastNotifications';
// 
// toast.success('Object created successfully!');
// toast.error('Failed to load model');
// toast.info('Rendering in progress...');
// toast.warning('Unsaved changes detected');
