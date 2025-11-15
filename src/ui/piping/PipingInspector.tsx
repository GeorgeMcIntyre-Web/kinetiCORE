// Piping Inspector - Properties editor for nodes and segments
// Owner: Agent 1 (George) - Architecture Lead
// Phase 4: UI & Workflow

import React, { useState, useEffect } from 'react';
import { pipingStore } from '../../domain/factoryServices/piping/pipingStore';
import {
  PipingNode,
  PipingSegment,
  PipingNodeKind,
  PipingServiceType,
  PipingPlacementMode,
  PipingPlacementSettings,
} from '../../domain/factoryServices/piping/pipingTypes';
import { getSegmentWarnings } from '../../domain/factoryServices/piping/pipingValidation';
import { AlertTriangle } from 'lucide-react';
import { PLACEMENT_MODE_OPTIONS } from './placementModes';

const NODE_KINDS: PipingNodeKind[] = ['endpoint', 'support', 'branch', 'equipment'];
const SERVICE_TYPES: PipingServiceType[] = ['water', 'air', 'steam', 'vacuum'];

export const PipingInspector: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<PipingNode | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<PipingSegment | null>(null);
  const [placementSettings, setPlacementSettings] = useState<PipingPlacementSettings>(
    pipingStore.getPlacementSettings()
  );

  useEffect(() => {
    const updateSelection = () => {
      setPlacementSettings(pipingStore.getPlacementSettings());
      const selection = pipingStore.getSelection();

      if (selection.nodeId !== null) {
        const node = pipingStore.getNode(selection.nodeId);
        setSelectedNode(node ?? null);
        setSelectedSegment(null);
        return;
      }

      if (selection.segmentId !== null) {
        const segment = pipingStore.getSegment(selection.segmentId);
        setSelectedSegment(segment ?? null);
        setSelectedNode(null);
        return;
      }

      setSelectedNode(null);
      setSelectedSegment(null);
    };

    updateSelection();
    const unsubscribe = pipingStore.subscribe(updateSelection);
    return () => unsubscribe();
  }, []);

  // Node property handlers
  const handleNodeNameChange = (name: string) => {
    if (selectedNode === null) {
      return;
    }
    pipingStore.updateNode(selectedNode.id, { name });
  };

  const handleNodeKindChange = (kind: PipingNodeKind) => {
    if (selectedNode === null) {
      return;
    }
    pipingStore.updateNode(selectedNode.id, { kind });
  };

  const handleNodeServiceTypeChange = (serviceType: PipingServiceType) => {
    if (selectedNode === null) {
      return;
    }
    pipingStore.updateNode(selectedNode.id, { serviceType });
  };

  const handleNodePositionChange = (axis: 'x' | 'y' | 'z', value: string) => {
    if (selectedNode === null) {
      return;
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      return;
    }

    pipingStore.updateNode(selectedNode.id, {
      position: {
        ...selectedNode.position,
        [axis]: numValue,
      },
    });
  };

  // Segment property handlers
  const handleSegmentDiameterChange = (value: string) => {
    if (selectedSegment === null) {
      return;
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
      return;
    }

    pipingStore.updateSegment(selectedSegment.id, {
      nominalDiameterMm: numValue,
    });
  };

  const handleSegmentInsulationChange = (hasInsulation: boolean) => {
    if (selectedSegment === null) {
      return;
    }
    pipingStore.updateSegment(selectedSegment.id, { hasInsulation });
  };

  const handleSegmentSlopeChange = (value: string) => {
    if (selectedSegment === null) {
      return;
    }

    if (value === '') {
      pipingStore.updateSegment(selectedSegment.id, { slopePerMille: undefined });
      return;
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      return;
    }

    pipingStore.updateSegment(selectedSegment.id, { slopePerMille: numValue });
  };

  const handlePlacementSettingsModeChange = (mode: PipingPlacementMode) => {
    pipingStore.setPlacementMode(mode);
  };

  const handlePlacementSettingsElevationChange = (value: string) => {
    if (value === '') {
      pipingStore.setDefaultElevationZ(0);
      return;
    }

    const parsed = parseFloat(value);
    if (Number.isFinite(parsed) === false) {
      return;
    }

    // Convert from mm to meters
    pipingStore.setDefaultElevationZ(parsed / 1000);
  };

  const selectedNodeElevationMm =
    selectedNode !== null ? Math.round(selectedNode.position.y * 1000) : null;

  // No selection
  if (selectedNode === null && selectedSegment === null) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '32px 16px',
          color: '#64748b',
          fontSize: '13px',
        }}
      >
        Select a node or segment to edit properties.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Node Inspector */}
      {selectedNode !== null && (
        <div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#f1f5f9',
              marginBottom: '12px',
            }}
          >
            Node Properties
          </div>

            <div
              style={{
                marginBottom: '16px',
                padding: '12px',
                border: '1px solid #334155',
                borderRadius: '8px',
                backgroundColor: '#0b1629',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                Placement defaults
              </div>
              <label
                htmlFor="inspector-placement-mode"
                style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}
              >
                Placement mode
              </label>
              <select
                id="inspector-placement-mode"
                value={placementSettings.mode}
                onChange={(event) =>
                  handlePlacementSettingsModeChange(event.target.value as PipingPlacementMode)
                }
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '4px',
                  color: '#f1f5f9',
                  fontSize: '13px',
                }}
              >
                {PLACEMENT_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <label
                htmlFor="inspector-placement-elevation"
                style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}
              >
                Default elevation (mm)
              </label>
              <input
                id="inspector-placement-elevation"
                type="number"
                min="0"
                max="6000"
                step="50"
                value={placementSettings.defaultElevationZ * 1000}
                onChange={(e) => handlePlacementSettingsElevationChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '4px',
                  color: '#f1f5f9',
                  fontSize: '13px',
                }}
              />
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>
                Matches the Node Placement controls surfaced in the main panel.
              </p>
            </div>

            {/* Name */}
          <div style={{ marginBottom: '12px' }}>
            <label
              htmlFor="node-name"
              style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}
            >
              Name
            </label>
            <input
              id="node-name"
              type="text"
              value={selectedNode.name ?? ''}
              onChange={(e) => handleNodeNameChange(e.target.value)}
              placeholder="Optional node name"
              style={{
                width: '100%',
                padding: '6px 8px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '4px',
                color: '#f1f5f9',
                fontSize: '13px',
              }}
            />
          </div>

          {/* Kind */}
          <div style={{ marginBottom: '12px' }}>
            <label
              htmlFor="node-kind"
              style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}
            >
              Kind
            </label>
            <select
              id="node-kind"
              value={selectedNode.kind}
              onChange={(e) => handleNodeKindChange(e.target.value as PipingNodeKind)}
              style={{
                width: '100%',
                padding: '6px 8px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '4px',
                color: '#f1f5f9',
                fontSize: '13px',
              }}
            >
              {NODE_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
          </div>

          {/* Service Type */}
          <div style={{ marginBottom: '12px' }}>
            <label
              htmlFor="node-service-type"
              style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}
            >
              Service Type
            </label>
            <select
              id="node-service-type"
              value={selectedNode.serviceType}
              onChange={(e) => handleNodeServiceTypeChange(e.target.value as PipingServiceType)}
              style={{
                width: '100%',
                padding: '6px 8px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '4px',
                color: '#f1f5f9',
                fontSize: '13px',
              }}
            >
              {SERVICE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Position */}
          <div>
            <div
              style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '8px' }}
            >
              Position (meters)
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <label
                  htmlFor="node-pos-x"
                  style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}
                >
                  X
                </label>
                <input
                  id="node-pos-x"
                  type="number"
                  step="0.1"
                  value={selectedNode.position.x}
                  onChange={(e) => handleNodePositionChange('x', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    color: '#f1f5f9',
                    fontSize: '13px',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label
                  htmlFor="node-pos-y"
                  style={{
                    fontSize: '11px',
                    color: '#64748b',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Y (Elevation, m)
                </label>
                <input
                  id="node-pos-y"
                  type="number"
                  step="0.1"
                  value={selectedNode.position.y}
                  onChange={(e) => handleNodePositionChange('y', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    color: '#f1f5f9',
                    fontSize: '13px',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label
                  htmlFor="node-pos-z"
                  style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}
                >
                  Z
                </label>
                <input
                  id="node-pos-z"
                  type="number"
                  step="0.1"
                  value={selectedNode.position.z}
                  onChange={(e) => handleNodePositionChange('z', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    color: '#f1f5f9',
                    fontSize: '13px',
                  }}
                />
              </div>
            </div>
          </div>

            {selectedNodeElevationMm !== null && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '12px',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  backgroundColor: '#0b1629',
                  lineHeight: 1.4,
                }}
                aria-live="polite"
              >
                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Elevation summary
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9' }}>
                  Elevation: {selectedNodeElevationMm} mm (Y axis)
                </div>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0' }}>
                  Matches the Y value above. Align this with the node placement defaults when you
                  want consistent pipe heights.
                </p>
              </div>
            )}
        </div>
      )}

      {/* Segment Inspector */}
      {selectedSegment !== null && (
        <div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#f1f5f9',
              marginBottom: '12px',
            }}
          >
            Segment Properties
          </div>

          {/* Warnings Section */}
          {(() => {
            const network = pipingStore.getNetworkForSegment(selectedSegment.id);
            if (!network) {
              return null;
            }
            const warnings = getSegmentWarnings(selectedSegment, network.nodes);
            if (warnings.length === 0) {
              return null;
            }
            return (
              <div
                style={{
                  backgroundColor: '#422006',
                  border: '1px solid #78350f',
                  borderRadius: '4px',
                  padding: '12px',
                  marginBottom: '12px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#fbbf24',
                  }}
                >
                  <AlertTriangle size={14} />
                  Warnings
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {warnings.map((warning, index) => (
                    <div
                      key={index}
                      style={{
                        fontSize: '12px',
                        color: '#fde68a',
                        lineHeight: '1.4',
                      }}
                    >
                      • {warning.message}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Diameter */}
          <div style={{ marginBottom: '12px' }}>
            <label
              htmlFor="segment-diameter"
              style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}
            >
              Nominal Diameter (mm)
            </label>
            <input
              id="segment-diameter"
              type="number"
              step="1"
              min="1"
              value={selectedSegment.nominalDiameterMm}
              onChange={(e) => handleSegmentDiameterChange(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '4px',
                color: '#f1f5f9',
                fontSize: '13px',
              }}
            />
          </div>

          {/* Insulation */}
          <div style={{ marginBottom: '12px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#e2e8f0',
              }}
            >
              <input
                type="checkbox"
                checked={selectedSegment.hasInsulation}
                onChange={(e) => handleSegmentInsulationChange(e.target.checked)}
                style={{
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer',
                }}
              />
              Has Insulation
            </label>
          </div>

          {/* Slope */}
          <div>
            <label
              htmlFor="segment-slope"
              style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}
            >
              Slope (‰, optional)
            </label>
            <input
              id="segment-slope"
              type="number"
              step="0.1"
              value={selectedSegment.slopePerMille ?? ''}
              onChange={(e) => handleSegmentSlopeChange(e.target.value)}
              placeholder="Optional slope"
              style={{
                width: '100%',
                padding: '6px 8px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '4px',
                color: '#f1f5f9',
                fontSize: '13px',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
