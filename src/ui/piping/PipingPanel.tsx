// Piping Panel - Main UI for Factory Piping System
// Owner: Agent 1 (George) - Architecture Lead
// Phase 4: UI & Workflow

import React, { useState, useEffect } from 'react';
import { pipingStore } from '../../domain/factoryServices/piping/pipingStore';
import { describePipingNetwork } from '../../domain/factoryServices/piping/pipingDescription';
import {
  PipingNetwork,
  PipingServiceType,
  PipingPlacementMode,
  PipingPlacementSettings,
} from '../../domain/factoryServices/piping/pipingTypes';
import { PipingNodeList } from './PipingNodeList';
import { PipingSegmentList } from './PipingSegmentList';
import { PipingInspector } from './PipingInspector';
import { X } from 'lucide-react';

const SERVICE_TYPES: PipingServiceType[] = ['water', 'air', 'steam', 'vacuum'];
const PLACEMENT_PRESETS = [0.5, 1, 2];

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
  const [placementSettings, setPlacementSettings] = useState<PipingPlacementSettings>(
    pipingStore.getPlacementSettings()
  );

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

      setPlacementSettings(pipingStore.getPlacementSettings());
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

  const handlePlacementModeChange = (mode: PipingPlacementMode): void => {
    pipingStore.setPlacementMode(mode);
  };

  const handleElevationChange = (value: string): void => {
    if (value.trim() === '') {
      return;
    }
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed)) {
      return;
    }
    pipingStore.setDefaultElevation(parsed);
  };

  const handlePresetClick = (preset: number): void => {
    pipingStore.setDefaultElevation(preset);
  };

  if (!isVisible) {
    return null;
  }

  const activeNetwork = activeNetworkId !== null ? pipingStore.getNetwork(activeNetworkId) : null;

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
              <div
                style={{
                  padding: '12px',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  backgroundColor: '#0f172a',
                  marginBottom: '16px',
                }}
              >
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#f1f5f9',
                    marginBottom: '8px',
                  }}
                >
                  Node Placement
                </div>

                <div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#94a3b8',
                      marginBottom: '6px',
                    }}
                  >
                    Placement mode
                  </div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        color: '#e2e8f0',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="piping-placement-mode"
                        value="on_floor"
                        checked={placementSettings.mode === 'on_floor'}
                        onChange={() => handlePlacementModeChange('on_floor')}
                      />
                      On floor
                    </label>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        color: '#e2e8f0',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="piping-placement-mode"
                        value="fixed_height"
                        checked={placementSettings.mode === 'fixed_height'}
                        onChange={() => handlePlacementModeChange('fixed_height')}
                      />
                      Fixed height above floor
                    </label>
                  </div>
                </div>

                <div style={{ marginTop: '14px' }}>
                  <label
                    htmlFor="placement-default-elevation"
                    style={{
                      fontSize: '12px',
                      color: '#94a3b8',
                      display: 'block',
                      marginBottom: '6px',
                    }}
                  >
                    Default elevation (m)
                  </label>
                  <input
                    id="placement-default-elevation"
                    type="number"
                    min="0"
                    step="0.1"
                    value={placementSettings.defaultElevation}
                    onChange={(e) => handleElevationChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      backgroundColor: '#0a1424',
                      border: '1px solid #334155',
                      borderRadius: '4px',
                      color: '#f1f5f9',
                      fontSize: '13px',
                    }}
                  />
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#64748b',
                      marginTop: '4px',
                    }}
                  >
                    Applied when placement mode is fixed height.
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '12px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  {PLACEMENT_PRESETS.map((preset) => {
                    const isActive = placementSettings.defaultElevation === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handlePresetClick(preset)}
                        aria-label={`${preset.toFixed(1)} m preset`}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '4px',
                          border: isActive ? '1px solid #06b6d4' : '1px solid #334155',
                          backgroundColor: isActive ? '#082032' : 'transparent',
                          color: '#e2e8f0',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        {preset.toFixed(1)} m
                      </button>
                    );
                  })}
                </div>
              </div>

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
