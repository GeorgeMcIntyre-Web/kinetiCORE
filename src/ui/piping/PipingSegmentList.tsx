// Piping Segment List - Segment management component
// Owner: Agent 1 (George) - Architecture Lead
// Phase 4: UI & Workflow

import React, { useState } from 'react';
import { pipingStore } from '../../domain/factoryServices/piping/pipingStore';
import { PipingSegment, PipingNode } from '../../domain/factoryServices/piping/pipingTypes';
import { getSegmentWarnings } from '../../domain/factoryServices/piping/pipingValidation';
import { Minus, Trash2, AlertTriangle } from 'lucide-react';

interface PipingSegmentListProps {
  networkId: string;
  segments: PipingSegment[];
  nodes: PipingNode[];
}

export const PipingSegmentList: React.FC<PipingSegmentListProps> = ({
  networkId: _networkId,
  segments,
  nodes,
}) => {
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  // Subscribe to selection changes
  React.useEffect(() => {
    const updateSelection = () => {
      const selection = pipingStore.getSelection();
      setSelectedSegmentId(selection.segmentId);
    };

    updateSelection();
    const unsubscribe = pipingStore.subscribe(updateSelection);
    return () => unsubscribe();
  }, []);

  const handleSegmentClick = (segmentId: string) => {
    pipingStore.setSelectedSegment(segmentId);
    pipingStore.setSelectedNode(null); // Clear node selection
  };

  const handleDeleteSegment = (segmentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    pipingStore.deleteSegment(segmentId);
  };

  const getNodeName = (nodeId: string): string => {
    const node = nodes.find((n) => n.id === nodeId);
    if (node === undefined) {
      return 'Unknown';
    }
    return node.name ?? `Node ${node.id.slice(0, 8)}`;
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
        Segments ({segments.length})
      </div>

      {segments.length === 0 && (
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
          No segments yet. Shift+click nodes to create segments.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {segments.map((segment) => {
          const isSelected = segment.id === selectedSegmentId;
          const warnings = getSegmentWarnings(segment, nodes);
          const hasWarnings = warnings.length > 0;

          return (
            <div
              key={segment.id}
              onClick={() => handleSegmentClick(segment.id)}
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
              <Minus
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
                  {getNodeName(segment.fromNodeId)} → {getNodeName(segment.toNodeId)}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#94a3b8',
                    marginTop: '2px',
                  }}
                >
                  ⌀{segment.nominalDiameterMm}mm
                  {segment.hasInsulation && ' • Insulated'}
                </div>
                {hasWarnings && (
                  <div
                    style={{
                      fontSize: '10px',
                      color: '#fbbf24',
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    title={warnings.map((w) => w.message).join('\n')}
                  >
                    <AlertTriangle size={10} />
                    {warnings.length} warning{warnings.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>

              <button
                onClick={(e) => handleDeleteSegment(segment.id, e)}
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
                title="Delete Segment"
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
