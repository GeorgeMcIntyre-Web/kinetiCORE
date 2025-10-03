// CollisionInspector - UI panel showing collision details
// Owner: Edwin

import * as React from 'react';
const { useState, useEffect } = React as any;
import { AlertTriangle, Eye, EyeOff, Info } from 'lucide-react';

interface CollisionStats {
  totalContacts: number;
  maxPenetration: number;
  avgPenetration: number;
  collisionPairs: number;
}

export const CollisionInspector = () => {
  const [stats, setStats] = useState({
    totalContacts: 0,
    maxPenetration: 0,
    avgPenetration: 0,
    collisionPairs: 0,
  });

  const [visualizationEnabled, setVisualizationEnabled] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const mockStats = {
        totalContacts: Math.floor(Math.random() * 10),
        maxPenetration: Math.random() * 0.005,
        avgPenetration: Math.random() * 0.002,
        collisionPairs: Math.floor(Math.random() * 5),
      };
      setStats(mockStats);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const hasCollisions = stats.totalContacts > 0;
  const severityLevel = stats.maxPenetration > 0.01 ? 'critical' : stats.maxPenetration > 0.005 ? 'warning' : 'normal';

  return (
    <div className="bg-gray-900 border-t border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle
            className={`w-5 h-5 ${
              severityLevel === 'critical' ? 'text-red-500' : severityLevel === 'warning' ? 'text-yellow-500' : 'text-green-500'
            }`}
          />
          <h3 className="text-sm font-semibold text-white">Collision Detection</h3>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowDetails(!showDetails)} className="p-1 hover:bg-gray-800 rounded transition-colors" title="Show Details">
            <Info className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={() => setVisualizationEnabled(!visualizationEnabled)}
            className={`p-1 rounded transition-colors ${visualizationEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'hover:bg-gray-800'}`}
            title={visualizationEnabled ? 'Hide Visualization' : 'Show Visualization'}
          >
            {visualizationEnabled ? <Eye className="w-4 h-4 text-white" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-gray-800 rounded p-2">
          <div className="text-xs text-gray-400">Contacts</div>
          <div className="text-lg font-bold text-white">{stats.totalContacts}</div>
        </div>
        <div className="bg-gray-800 rounded p-2">
          <div className="text-xs text-gray-400">Pairs</div>
          <div className="text-lg font-bold text-white">{stats.collisionPairs}</div>
        </div>
        <div className="bg-gray-800 rounded p-2">
          <div className="text-xs text-gray-400">Max Penetration</div>
          <div
            className={`text-lg font-bold ${
              severityLevel === 'critical' ? 'text-red-500' : severityLevel === 'warning' ? 'text-yellow-500' : 'text-green-500'
            }`}
          >
            {(stats.maxPenetration * 1000).toFixed(1)}mm
          </div>
        </div>
        <div className="bg-gray-800 rounded p-2">
          <div className="text-xs text-gray-400">Avg Penetration</div>
          <div className="text-lg font-bold text-white">{(stats.avgPenetration * 1000).toFixed(1)}mm</div>
        </div>
      </div>

      <div
        className={`text-xs font-semibold px-2 py-1 rounded text-center ${
          hasCollisions ? (severityLevel === 'critical' ? 'bg-red-900 text-red-200' : 'bg-yellow-900 text-yellow-200') : 'bg-green-900 text-green-200'
        }`}
      >
        {hasCollisions ? (severityLevel === 'critical' ? '⚠️ CRITICAL COLLISION DETECTED' : '⚠️ COLLISION DETECTED') : '✓ NO COLLISIONS'}
      </div>

      {showDetails && hasCollisions && (
        <div className="mt-3 bg-gray-800 rounded p-3 text-xs text-gray-300 space-y-2">
          <div>
            <strong>Visualization:</strong>
            <ul className="ml-4 mt-1 space-y-1">
              <li>🔴 Red spheres = Contact points</li>
              <li>🔵 Cyan arrows = Contact normals</li>
              <li>🟡 Yellow text = Penetration depth</li>
            </ul>
          </div>
          <div className="text-gray-500 italic">Tip: Contact normals point from first body to second body</div>
        </div>
      )}
    </div>
  );
};

