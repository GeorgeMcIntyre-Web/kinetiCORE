// Piping Node List - Node management component
// Owner: Agent 1 (George) - Architecture Lead
// Phase 4: UI & Workflow

import React, { useState } from 'react';
import { pipingStore } from '../../domain/factoryServices/piping/pipingStore';
import { PipingNode } from '../../domain/factoryServices/piping/pipingTypes';
import { Circle, Trash2 } from 'lucide-react';

interface PipingNodeListProps {
  networkId: string;
  nodes: PipingNode[];
}

export const PipingNodeList: React.FC<PipingNodeListProps> = ({ networkId: _networkId, nodes }) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Subscribe to selection changes
  React.useEffect(() => {
    const updateSelection = () => {
      const selection = pipingStore.getSelection();
      setSelectedNodeId(selection.nodeId);
    };

    updateSelection();
    const unsubscribe = pipingStore.subscribe(updateSelection);
    return () => unsubscribe();
  }, []);

  const handleNodeClick = (nodeId: string) => {
    pipingStore.setSelectedNode(nodeId);
    pipingStore.setSelectedSegment(null); // Clear segment selection
  };

  const handleDeleteNode = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Check how many segments are connected
    const connectedSegments = pipingStore.getConnectedSegments(nodeId);

    if (connectedSegments.length > 1) {
      const confirmDelete = window.confirm(
        `This node has ${connectedSegments.length} connected segments. Deleting it will remove all connected segments. Continue?`
      );

      if (!confirmDelete) {
        return;
      }
    }

    pipingStore.deleteNode(nodeId);
  };

  return (
    <div>
      <div
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#94a3b8',
          marginBottom: '8px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        Nodes ({nodes.length})
      </div>

      {nodes.length === 0 && (
        <div
          style={{
            padding: '16px',
            textAlign: 'center',
            color: '#64748b',
            fontSize: '12px',
            border: '1px dashed #334155',
            borderRadius: '4px',
          }}
        >
          No nodes yet. Click in the viewport to create nodes.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {nodes.map((node) => {
          const isSelected = node.id === selectedNodeId;

          return (
            <div
              key={node.id}
              onClick={() => handleNodeClick(node.id)}
              style={{
                padding: '8px 10px',
                backgroundColor: isSelected ? '#0f172a' : '#1e293b',
                border: `1px solid ${isSelected ? '#06b6d4' : '#334155'}`,
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = '#0f172a';
                  e.currentTarget.style.borderColor = '#475569';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = '#1e293b';
                  e.currentTarget.style.borderColor = '#334155';
                }
              }}
            >
              <Circle
                size={14}
                style={{
                  color: isSelected ? '#06b6d4' : '#64748b',
                  flexShrink: 0,
                }}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: isSelected ? '#f1f5f9' : '#e2e8f0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {node.name ?? `Node ${node.id.slice(0, 8)}`}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#94a3b8',
                    marginTop: '2px',
                  }}
                >
                  {node.kind} • Y:{node.position.y.toFixed(2)}m
                </div>
              </div>

              <button
                onClick={(e) => handleDeleteNode(node.id, e)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
                title="Delete Node"
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#ef4444';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#94a3b8';
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
