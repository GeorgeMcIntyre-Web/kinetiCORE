import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { useEditorStore } from './ui/store/editorStore';

// Expose useEditorStore to window for debugging
if (typeof window !== 'undefined') {
  (window as any).useEditorStore = useEditorStore;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);