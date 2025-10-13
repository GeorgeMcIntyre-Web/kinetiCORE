/**
 * Button State Inspector
 * Owner: George
 * 
 * Debug component to inspect button states in real-time
 * Only shows in development mode
 */

import { useEditorStore } from '../../store/editorStore';

export function ButtonStateInspector() {
  const { state } = useEditorStore();
  
  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  const buttonStates = state.buttonStates || {};
  const buttonActions = state.buttonActions || {};
  
  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-white p-4 rounded-lg max-w-sm max-h-96 overflow-y-auto z-50">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-sm">Button States</h3>
        <button 
          onClick={() => {
            // Toggle visibility
            const inspector = document.querySelector('.button-state-inspector');
            if (inspector) {
              inspector.classList.toggle('hidden');
            }
          }}
          className="text-xs bg-gray-600 px-2 py-1 rounded"
        >
          Toggle
        </button>
      </div>
      
      <div className="space-y-2 text-xs">
        {/* Button States */}
        <div>
          <h4 className="font-semibold text-green-400 mb-1">States ({Object.keys(buttonStates).length})</h4>
          {Object.keys(buttonStates).length === 0 ? (
            <div className="text-gray-400 italic">No button states</div>
          ) : (
            <div className="space-y-1">
              {Object.entries(buttonStates).map(([id, value]) => (
                <div key={id} className="flex justify-between items-center">
                  <span className="text-blue-300 truncate">{id}:</span>
                  <span className="text-green-400 ml-2">
                    {typeof value === 'boolean' ? (value ? '✓' : '✗') : JSON.stringify(value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Button Actions */}
        <div>
          <h4 className="font-semibold text-yellow-400 mb-1">Actions ({Object.keys(buttonActions).length})</h4>
          {Object.keys(buttonActions).length === 0 ? (
            <div className="text-gray-400 italic">No button actions</div>
          ) : (
            <div className="space-y-1">
              {Object.keys(buttonActions).map((id) => (
                <div key={id} className="flex justify-between items-center">
                  <span className="text-blue-300 truncate">{id}:</span>
                  <span className="text-yellow-400 ml-2">✓</span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Quick Actions */}
        <div className="pt-2 border-t border-gray-600">
          <h4 className="font-semibold text-purple-400 mb-1">Quick Actions</h4>
          <div className="space-y-1">
            <button
              onClick={() => {
                console.log('[ButtonStateInspector] Current button states:', buttonStates);
                console.log('[ButtonStateInspector] Current button actions:', buttonActions);
              }}
              className="w-full text-left text-xs bg-gray-700 px-2 py-1 rounded hover:bg-gray-600"
            >
              Log to Console
            </button>
            <button
              onClick={() => {
                // Clear all button states
                const store = useEditorStore.getState();
                store.setButtonState('__clear_all__', {});
                console.log('[ButtonStateInspector] Cleared all button states');
              }}
              className="w-full text-left text-xs bg-red-700 px-2 py-1 rounded hover:bg-red-600"
            >
              Clear States
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
