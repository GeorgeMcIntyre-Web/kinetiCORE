/**
 * Debug panel to export tooling point cloud trees.
 * Dev tool only - for inspecting hierarchy + point counts.
 */

import React, { useState } from 'react';
import { SceneManager } from '../../scene/SceneManager';
import { buildToolingStructureFromScene, buildGeometryIndex } from '../../domain/tooling/babylonAdapter';
import { formatToolingPointTree } from '../../domain/tooling/debugTree';
import { FileDown, X } from 'lucide-react';

export const ToolingTreeDebugPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [fullTree, setFullTree] = useState('');
  const [filteredTree, setFilteredTree] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleExportTree = async () => {
    const scene = SceneManager.getInstance().getScene();
    if (!scene) {
      setError('No scene loaded');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Find the imported GLB root node (skip lights, cameras, etc.)
      let rootNode = scene.rootNodes.find(
        (n) =>
          n.name.includes('016ZF') ||
          n.name.includes('140_1E1') ||
          n.name.includes('CI00')
      );

      if (!rootNode) {
        console.log('[ToolingTreeDebug] Available root nodes:', scene.rootNodes.map(n => `${n.name} (${n.getClassName()})`));

        // PRIORITY 1: Look for __root__ node (GLB import root)
        rootNode = scene.rootNodes.find((n) => n.name === '__root__');

        // PRIORITY 2: If no __root__, find first Mesh (not GroundMesh, not light, not camera)
        if (!rootNode) {
          const candidates = scene.rootNodes.filter(
            (n) =>
              n.getClassName() === 'Mesh' &&
              !n.name.toLowerCase().includes('ground') &&
              !n.name.toLowerCase().includes('grid')
          );

          if (candidates.length === 0) {
            setError('No GLB root node found in scene. Please load the 016ZF_20142435_140_1E1_CI00.glb file first.');
            setIsLoading(false);
            return;
          }

          rootNode = candidates[0];
        }

        console.log('[ToolingTreeDebug] Using root node:', rootNode.name);
      }

      console.log('[ToolingTreeDebug] Building tooling structure...');
      const structure = buildToolingStructureFromScene(scene, rootNode);

      if (!structure.root) {
        setError('Failed to build tooling structure');
        setIsLoading(false);
        return;
      }

      console.log('[ToolingTreeDebug] Building geometry index...');
      const geometryIndex = await buildGeometryIndex(structure, scene, {
        stride: 10,
        maxPointsPerNode: 5000,
        useWorldSpace: true,
      });

      console.log('[ToolingTreeDebug] Formatting trees...');

      // Generate FULL tree
      const full = formatToolingPointTree(structure, geometryIndex, {});

      // Generate FILTERED tree (minPoints=500, NO depth limit)
      const filtered = formatToolingPointTree(structure, geometryIndex, {
        minPoints: 500,
      });

      // Generate filename from root node name
      // If root is __root__, use the first child's name instead
      let fixtureName = structure.root.name || 'fixture';
      if (fixtureName === '__root__' && structure.root.children && structure.root.children.length > 0) {
        fixtureName = structure.root.children[0].name || fixtureName;
      }
      const safeFixtureName = fixtureName.replace(/[^a-zA-Z0-9_-]/g, '_');

      // Download FULL tree as file
      const fullBlob = new Blob([full], { type: 'text/plain' });
      const fullUrl = URL.createObjectURL(fullBlob);
      const fullLink = document.createElement('a');
      fullLink.href = fullUrl;
      fullLink.download = `${safeFixtureName}-FULL-TREE.txt`;
      document.body.appendChild(fullLink);
      fullLink.click();
      document.body.removeChild(fullLink);
      URL.revokeObjectURL(fullUrl);

      // Download FILTERED tree as file
      const filteredBlob = new Blob([filtered], { type: 'text/plain' });
      const filteredUrl = URL.createObjectURL(filteredBlob);
      const filteredLink = document.createElement('a');
      filteredLink.href = filteredUrl;
      filteredLink.download = `${safeFixtureName}-FILTERED-TREE.txt`;
      document.body.appendChild(filteredLink);
      filteredLink.click();
      document.body.removeChild(filteredLink);
      URL.revokeObjectURL(filteredUrl);

      // Also log to console for easy copying
      console.log('\n=== TREE FULL 016ZF_20142435_140_1E1_CI00 ===');
      console.log(full);
      console.log('\n=== TREE FILTERED 016ZF_20142435_140_1E1_CI00 (minPoints=500) ===');
      console.log(filtered);

      setIsLoading(false);
      alert('Two tree files downloaded to your Downloads folder!');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(`Error: ${errorMsg}`);
      console.error('[ToolingTreeDebug] Error:', err);
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Export button */}
      <button
        onClick={handleExportTree}
        disabled={isLoading}
        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded flex items-center gap-2 transition-colors"
        title="Export point tree for 016ZF_20142435_140_1E1_CI00"
      >
        <FileDown size={16} />
        {isLoading ? 'Exporting...' : 'Export Point Tree'}
      </button>

      {/* Error display */}
      {error && (
        <div className="mt-2 p-2 bg-red-500 bg-opacity-20 border border-red-500 rounded text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Modal with trees */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">
                Tooling Point Cloud Trees - 016ZF_20142435_140_1E1_CI00
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto space-y-4">
              {/* FULL tree */}
              <div>
                <h3 className="text-lg font-medium text-cyan-400 mb-2">
                  FULL TREE (all nodes)
                </h3>
                <textarea
                  readOnly
                  value={fullTree}
                  className="w-full h-64 bg-gray-800 text-gray-100 font-mono text-sm p-3 rounded border border-gray-600 resize-none"
                  onClick={(e) => e.currentTarget.select()}
                />
              </div>

              {/* FILTERED tree */}
              <div>
                <h3 className="text-lg font-medium text-cyan-400 mb-2">
                  FILTERED TREE (minPoints=500, all depths)
                </h3>
                <textarea
                  readOnly
                  value={filteredTree}
                  className="w-full h-64 bg-gray-800 text-gray-100 font-mono text-sm p-3 rounded border border-gray-600 resize-none"
                  onClick={(e) => e.currentTarget.select()}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="mt-4 text-sm text-gray-400">
              Tip: Click textarea to select all, then Ctrl+C to copy. Trees are also logged to console.
            </div>
          </div>
        </div>
      )}
    </>
  );
};
