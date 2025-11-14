// Piping Panel - Main UI for Factory Piping System
// Owner: Agent 1 (George) - Architecture Lead
// Phase 4: UI & Workflow

import React, { useState, useEffect, useId } from 'react';
import { pipingStore } from '../../domain/factoryServices/piping/pipingStore';
import { describePipingNetwork } from '../../domain/factoryServices/piping/pipingDescription';
import { PipingNetwork, PipingServiceType } from '../../domain/factoryServices/piping/pipingTypes';
import { PipingNodeList } from './PipingNodeList';
import { PipingSegmentList } from './PipingSegmentList';
import { PipingInspector } from './PipingInspector';
import { X, HelpCircle } from 'lucide-react';
import { useEditorStore, PipingPlacementMode } from '../store/editorStore';

const SERVICE_TYPES: PipingServiceType[] = ['water', 'air', 'steam', 'vacuum'];

interface PipingPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

type TabType = 'network' | 'properties' | 'description';

export const PipingPanel: React.FC<PipingPanelProps> = ({ isVisible, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('network');
  const [networks, setNetworks] = useState<PipingNetwork[]>([]);
  const [activeNetworkId, setActiveNetworkId] = useState<string | null>(null);
  const [description, setDescription] = useState<string[]>([]);
  const placementMode = useEditorStore((state) => state.pipingPlacementMode);
  const defaultElevationMm = useEditorStore((state) => state.pipingDefaultElevationMm);
  const setPlacementMode = useEditorStore((state) => state.setPipingPlacementMode);
  const setDefaultElevationMm = useEditorStore((state) => state.setPipingDefaultElevationMm);
  const placementIds = useId();

  // Subscribe to piping store changes
  useEffect(() => {
    const updateState = () => {
      const allNetworks = pipingStore.getAllNetworks();
      setNetworks(allNetworks);

      const selection = pipingStore.getSelection();
      setActiveNetworkId(selection.networkId);

      // Update description for active network
      if (selection.networkId !== null) {
        const network = pipingStore.getNetwork(selection.networkId);
        if (network !== undefined) {
          setDescription(describePipingNetwork(network));
        }
      } else {
        setDescription([]);
      }
    };

    updateState();
    const unsubscribe = pipingStore.subscribe(updateState);

    return () => {
      unsubscribe();
    };
  }, []);

  // Create default network if none exists
  useEffect(() => {
    if (isVisible && networks.length === 0) {
      const network = pipingStore.createNetwork({
        name: 'Water Network 1',
        serviceType: 'water',
      });
      pipingStore.setActiveNetwork(network.id);
    }
  }, [isVisible, networks.length]);

  const handlePlacementModeChange = (mode: PipingPlacementMode) => {
    if (mode === placementMode) {
      return;
    }
    setPlacementMode(mode);
  };

  const handleDefaultElevationChange = (value: string) => {
    if (value === '') {
      setDefaultElevationMm(0);
      return;
    }
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed) === false) {
      return;
    }
    setDefaultElevationMm(parsed);
  };

  if (!isVisible) {
    return null;
  }

  const activeNetwork = activeNetworkId !== null ? pipingStore.getNetwork(activeNetworkId) : null;
  const placementLegendId = `${placementIds}-placement`;
  const floorHintId = `${placementIds}-floor`;
  const fixedHintId = `${placementIds}-fixed`;
  const elevationHelpId = `${placementIds}-help`;

  return (
    <div
      style={{
        position: 'fixed',
        right: '16px',
        top: '120px',
        width: '360px',
        maxHeight: 'calc(100vh - 140px)',
        backgroundColor: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0f172a',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#f1f5f9' }}>
          Factory Piping
        </h2>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#94a3b8',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
          }}
          title="Close Piping Panel"
        >
          <X size={18} />
        </button>
      </div>

      {/* Network Selector */}
      {networks.length > 0 && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155' }}>
          <label
            htmlFor="network-select"
            style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}
          >
            Active Network
          </label>
          <select
            id="network-select"
            value={activeNetworkId ?? ''}
            onChange={(e) => {
              const networkId = e.target.value;
              pipingStore.setActiveNetwork(networkId !== '' ? networkId : null);
            }}
            style={{
              width: '100%',
              padding: '6px 8px',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '4px',
              color: '#f1f5f9',
              fontSize: '13px',
              marginBottom: '12px',
            }}
          >
            {networks.map((network) => (
              <option key={network.id} value={network.id}>
                {network.name} ({network.serviceType})
              </option>
            ))}
          </select>

          {/* Service Type for Active Network */}
          {activeNetwork && (
            <>
              <label
                htmlFor="service-type-select"
                style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}
              >
                Service Type
              </label>
              <select
                id="service-type-select"
                value={activeNetwork.serviceType}
                onChange={(e) => {
                  pipingStore.updateNetwork(activeNetwork.id, {
                    serviceType: e.target.value as PipingServiceType,
                  });
                }}
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
            </>
          )}
        </div>
      )}

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #334155',
          backgroundColor: '#0f172a',
        }}
      >
        <button
          onClick={() => setActiveTab('network')}
          style={{
            flex: 1,
            padding: '10px 12px',
            background: activeTab === 'network' ? '#1e293b' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'network' ? '2px solid #06b6d4' : '2px solid transparent',
            color: activeTab === 'network' ? '#06b6d4' : '#94a3b8',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          Network
        </button>
        <button
          onClick={() => setActiveTab('properties')}
          style={{
            flex: 1,
            padding: '10px 12px',
            background: activeTab === 'properties' ? '#1e293b' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'properties' ? '2px solid #06b6d4' : '2px solid transparent',
            color: activeTab === 'properties' ? '#06b6d4' : '#94a3b8',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          Properties
        </button>
        <button
          onClick={() => setActiveTab('description')}
          style={{
            flex: 1,
            padding: '10px 12px',
            background: activeTab === 'description' ? '#1e293b' : 'transparent',
            border: 'none',
            borderBottom:
              activeTab === 'description' ? '2px solid #06b6d4' : '2px solid transparent',
            color: activeTab === 'description' ? '#06b6d4' : '#94a3b8',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          Description
        </button>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
          {activeTab === 'network' && activeNetwork !== null && activeNetwork !== undefined && (
            <div>
              <section
                aria-labelledby={placementLegendId}
                style={{
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '12px',
                  backgroundColor: '#0f172a',
                  marginBottom: '16px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                    gap: '8px',
                  }}
                >
                  <div
                    id={placementLegendId}
                    style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9' }}
                  >
                    Node Placement
                  </div>
                  <button
                    type="button"
                    aria-label="Why use fixed height placement?"
                    title="Use fixed height to drop nodes at a standard overhead run. Common offsets: 500, 1000, or 2000 mm."
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      color: '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'help',
                    }}
                  >
                    <HelpCircle size={16} />
                  </button>
                </div>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 12px' }}>
                  Choose how new nodes capture elevation when you click in the scene. The default
                  applies to every placement until you change it.
                </p>

                <fieldset
                  style={{ border: 'none', margin: 0, padding: 0 }}
                  aria-describedby={placementLegendId}
                >
                  <legend
                    style={{
                      fontSize: '12px',
                      color: '#94a3b8',
                      marginBottom: '8px',
                      fontWeight: 500,
                    }}
                  >
                    Node placement mode
                  </legend>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label
                      style={{
                        display: 'flex',
                        gap: '10px',
                        border:
                          placementMode === 'floor' ? '1px solid #06b6d4' : '1px solid #1f2937',
                        borderRadius: '6px',
                        padding: '8px 10px',
                        backgroundColor: '#0b1629',
                        cursor: 'pointer',
                        alignItems: 'flex-start',
                      }}
                    >
                      <input
                        type="radio"
                        name="piping-placement-mode"
                        value="floor"
                        checked={placementMode === 'floor'}
                        onChange={() => handlePlacementModeChange('floor')}
                        aria-describedby={floorHintId}
                        style={{ marginTop: '4px' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
                          On floor
                        </div>
                        <p
                          id={floorHintId}
                          style={{
                            margin: '2px 0 0',
                            fontSize: '12px',
                            color: '#94a3b8',
                            lineHeight: 1.4,
                          }}
                        >
                          Nodes land exactly on the surface you click.
                        </p>
                      </div>
                    </label>
                    <label
                      style={{
                        display: 'flex',
                        gap: '10px',
                        border:
                          placementMode === 'fixed_height'
                            ? '1px solid #06b6d4'
                            : '1px solid #1f2937',
                        borderRadius: '6px',
                        padding: '8px 10px',
                        backgroundColor: '#0b1629',
                        cursor: 'pointer',
                        alignItems: 'flex-start',
                      }}
                    >
                      <input
                        type="radio"
                        name="piping-placement-mode"
                        value="fixed_height"
                        checked={placementMode === 'fixed_height'}
                        onChange={() => handlePlacementModeChange('fixed_height')}
                        aria-describedby={fixedHintId}
                        style={{ marginTop: '4px' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
                          Fixed height above floor
                        </div>
                        <p
                          id={fixedHintId}
                          style={{
                            margin: '2px 0 0',
                            fontSize: '12px',
                            color: '#94a3b8',
                            lineHeight: 1.4,
                          }}
                        >
                          Nodes land at floor height plus the offset below along the up-axis.
                        </p>
                      </div>
                    </label>
                  </div>
                </fieldset>

                <label
                  htmlFor="piping-default-elevation"
                  style={{
                    fontSize: '12px',
                    color: '#94a3b8',
                    display: 'block',
                    margin: '12px 0 4px',
                  }}
                >
                  Default elevation (mm)
                </label>
                <input
                  id="piping-default-elevation"
                  type="number"
                  min="0"
                  max="6000"
                  step="50"
                  value={defaultElevationMm}
                  onChange={(e) => handleDefaultElevationChange(e.target.value)}
                  aria-describedby={elevationHelpId}
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
                <p
                  id={elevationHelpId}
                  style={{
                    fontSize: '12px',
                    color: '#94a3b8',
                    margin: '6px 0 0',
                    lineHeight: 1.4,
                  }}
                >
                  Use 0 mm for floor-level placement. Typical pipe racks use 500, 1000, or 2000 mm
                  offsets.
                </p>
              </section>

              <PipingNodeList networkId={activeNetwork.id} nodes={activeNetwork.nodes} />
              <div style={{ height: '16px' }} />
              <PipingSegmentList
                networkId={activeNetwork.id}
                segments={activeNetwork.segments}
                nodes={activeNetwork.nodes}
              />
            </div>
          )}

        {activeTab === 'network' && activeNetwork === null && (
          <div
            style={{
              textAlign: 'center',
              padding: '32px 16px',
              color: '#64748b',
              fontSize: '13px',
            }}
          >
            No active network selected.
          </div>
        )}

        {activeTab === 'properties' && <PipingInspector />}

        {activeTab === 'description' && (
          <div>
            {description.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '32px 16px',
                  color: '#64748b',
                  fontSize: '13px',
                }}
              >
                No piping network defined yet.
              </div>
            )}
            {description.length > 0 && (
              <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: '1.6' }}>
                {description.map((line, index) => (
                  <p key={index} style={{ margin: '8px 0' }}>
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
