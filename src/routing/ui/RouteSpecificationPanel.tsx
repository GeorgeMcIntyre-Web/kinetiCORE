// Route Specification Panel - Configure route physical properties
// Owner: Routing System Team

import React, { useState } from 'react';
import {
  ElectricalSpec,
  PipeSpec,
  CableTraySpec,
  ConduitSpec,
  DEFAULT_ELECTRICAL_SPEC,
  DEFAULT_PIPE_SPEC,
  DEFAULT_CABLE_TRAY_SPEC,
  DEFAULT_CONDUIT_SPEC,
  AWG_TO_METRIC,
  PIPE_SIZES,
  FLUID_PROPERTIES,
  calculateCableDiameter,
  validatePipeSize,
  getRecommendedConduitSize,
} from '../specifications/RouteSpecifications';
import { RouteType } from '../core/types';

interface RouteSpecificationPanelProps {
  routeType: RouteType;
  onSpecChange: (spec: ElectricalSpec | PipeSpec | CableTraySpec | ConduitSpec) => void;
  initialSpec?: ElectricalSpec | PipeSpec | CableTraySpec | ConduitSpec;
}

export const RouteSpecificationPanel: React.FC<RouteSpecificationPanelProps> = ({
  routeType,
  onSpecChange,
  initialSpec,
}) => {
  const [electricalSpec, setElectricalSpec] = useState<ElectricalSpec>(
    (initialSpec as ElectricalSpec) || DEFAULT_ELECTRICAL_SPEC
  );
  const [pipeSpec, setPipeSpec] = useState<PipeSpec>(
    (initialSpec as PipeSpec) || DEFAULT_PIPE_SPEC
  );
  const [traySpec, setTraySpec] = useState<CableTraySpec>(
    (initialSpec as CableTraySpec) || DEFAULT_CABLE_TRAY_SPEC
  );
  const [conduitSpec, setConduitSpec] = useState<ConduitSpec>(
    (initialSpec as ConduitSpec) || DEFAULT_CONDUIT_SPEC
  );

  // Render electrical specification form
  const renderElectricalSpec = () => (
    <div className="spec-form">
      <h3 className="spec-section-title">Cable Configuration</h3>

      <div className="spec-row">
        <label>Core Count:</label>
        <input
          type="number"
          value={electricalSpec.coreCount}
          onChange={(e) => {
            const updated = { ...electricalSpec, coreCount: parseInt(e.target.value) };
            updated.outerDiameter = calculateCableDiameter(updated);
            setElectricalSpec(updated);
            onSpecChange(updated);
          }}
          min={1}
          max={100}
        />
        <span className="spec-unit">conductors</span>
      </div>

      <div className="spec-row">
        <label>Wire Gauge:</label>
        <select
          value={electricalSpec.wireGauge}
          onChange={(e) => {
            const gauge = e.target.value;
            const diameter = AWG_TO_METRIC[gauge]?.diameter || 0.0025;
            const updated = { ...electricalSpec, wireGauge: gauge, wireDiameter: diameter };
            updated.outerDiameter = calculateCableDiameter(updated);
            setElectricalSpec(updated);
            onSpecChange(updated);
          }}
        >
          {Object.keys(AWG_TO_METRIC).map((gauge) => (
            <option key={gauge} value={gauge}>
              {gauge} ({AWG_TO_METRIC[gauge].mm2} mm²)
            </option>
          ))}
        </select>
      </div>

      <div className="spec-row">
        <label>Bundle Type:</label>
        <select
          value={electricalSpec.bundleType}
          onChange={(e) => {
            const updated = {
              ...electricalSpec,
              bundleType: e.target.value as ElectricalSpec['bundleType'],
            };
            setElectricalSpec(updated);
            onSpecChange(updated);
          }}
        >
          <option value="single">Single Core</option>
          <option value="twisted-pair">Twisted Pair</option>
          <option value="multi-core">Multi-Core</option>
          <option value="ribbon">Ribbon Cable</option>
        </select>
      </div>

      <div className="spec-row">
        <label>Voltage:</label>
        <input
          type="number"
          value={electricalSpec.voltage}
          onChange={(e) => {
            const updated = { ...electricalSpec, voltage: parseFloat(e.target.value) };
            setElectricalSpec(updated);
            onSpecChange(updated);
          }}
        />
        <span className="spec-unit">V</span>
      </div>

      <div className="spec-row">
        <label>Current Rating:</label>
        <input
          type="number"
          value={electricalSpec.current}
          onChange={(e) => {
            const updated = { ...electricalSpec, current: parseFloat(e.target.value) };
            setElectricalSpec(updated);
            onSpecChange(updated);
          }}
        />
        <span className="spec-unit">A</span>
      </div>

      <div className="spec-info">
        <strong>Calculated Cable Diameter:</strong> {(electricalSpec.outerDiameter * 1000).toFixed(1)} mm
      </div>
    </div>
  );

  // Render pipe specification form
  const renderPipeSpec = () => {
    const validation = validatePipeSize(pipeSpec);

    return (
      <div className="spec-form">
        <h3 className="spec-section-title">Pipe Configuration</h3>

        <div className="spec-row">
          <label>Nominal Size:</label>
          <select
            value={pipeSpec.nominalSize}
            onChange={(e) => {
              const size = e.target.value;
              const dims = PIPE_SIZES[size];
              const updated = {
                ...pipeSpec,
                nominalSize: size,
                outerDiameter: dims.od,
                innerDiameter: dims.id,
              };
              setPipeSpec(updated);
              onSpecChange(updated);
            }}
          >
            {Object.keys(PIPE_SIZES).map((size) => (
              <option key={size} value={size}>
                {size} (OD: {(PIPE_SIZES[size].od * 1000).toFixed(1)}mm)
              </option>
            ))}
          </select>
        </div>

        <div className="spec-row">
          <label>Material:</label>
          <select
            value={pipeSpec.material}
            onChange={(e) => {
              const updated = {
                ...pipeSpec,
                material: e.target.value as PipeSpec['material'],
              };
              setPipeSpec(updated);
              onSpecChange(updated);
            }}
          >
            <option value="steel">Carbon Steel</option>
            <option value="stainless">Stainless Steel</option>
            <option value="copper">Copper</option>
            <option value="PVC">PVC</option>
            <option value="aluminum">Aluminum</option>
          </select>
        </div>

        <h3 className="spec-section-title">Fluid Properties</h3>

        <div className="spec-row">
          <label>Fluid Type:</label>
          <select
            value={pipeSpec.fluidType}
            onChange={(e) => {
              const fluidType = e.target.value as PipeSpec['fluidType'];
              const fluidProps = FLUID_PROPERTIES[fluidType];
              const updated = {
                ...pipeSpec,
                fluidType,
                viscosity: fluidProps.viscosity,
              };
              setPipeSpec(updated);
              onSpecChange(updated);
            }}
          >
            <option value="water">Water</option>
            <option value="oil">Oil</option>
            <option value="gas">Natural Gas</option>
            <option value="steam">Steam</option>
            <option value="compressed-air">Compressed Air</option>
            <option value="chemical">Chemical</option>
          </select>
        </div>

        <div className="spec-row">
          <label>Flow Rate:</label>
          <input
            type="number"
            value={pipeSpec.flowRate}
            onChange={(e) => {
              const updated = { ...pipeSpec, flowRate: parseFloat(e.target.value) };
              setPipeSpec(updated);
              onSpecChange(updated);
            }}
          />
          <span className="spec-unit">L/min</span>
        </div>

        <div className="spec-row">
          <label>Temperature:</label>
          <input
            type="number"
            value={pipeSpec.temperature}
            onChange={(e) => {
              const updated = { ...pipeSpec, temperature: parseFloat(e.target.value) };
              setPipeSpec(updated);
              onSpecChange(updated);
            }}
          />
          <span className="spec-unit">°C</span>
        </div>

        <div className="spec-row">
          <label>Pressure Rating:</label>
          <input
            type="number"
            value={pipeSpec.pressureRating}
            onChange={(e) => {
              const updated = { ...pipeSpec, pressureRating: parseFloat(e.target.value) };
              setPipeSpec(updated);
              onSpecChange(updated);
            }}
          />
          <span className="spec-unit">PSI</span>
        </div>

        <div className={`spec-validation ${validation.valid ? 'valid' : 'invalid'}`}>
          <strong>Flow Velocity:</strong> {validation.velocity.toFixed(2)} m/s
          {validation.recommendation && (
            <div className="validation-warning">{validation.recommendation}</div>
          )}
        </div>
      </div>
    );
  };

  // Render cable tray specification form
  const renderCableTraySpec = () => (
    <div className="spec-form">
      <h3 className="spec-section-title">Cable Tray Configuration</h3>

      <div className="spec-row">
        <label>Width:</label>
        <select
          value={traySpec.width}
          onChange={(e) => {
            const updated = { ...traySpec, width: parseFloat(e.target.value) };
            setTraySpec(updated);
            onSpecChange(updated);
          }}
        >
          <option value={0.1}>100 mm</option>
          <option value={0.15}>150 mm</option>
          <option value={0.2}>200 mm</option>
          <option value={0.3}>300 mm</option>
          <option value={0.4}>400 mm</option>
          <option value={0.6}>600 mm</option>
        </select>
      </div>

      <div className="spec-row">
        <label>Height:</label>
        <select
          value={traySpec.height}
          onChange={(e) => {
            const updated = { ...traySpec, height: parseFloat(e.target.value) };
            setTraySpec(updated);
            onSpecChange(updated);
          }}
        >
          <option value={0.05}>50 mm</option>
          <option value={0.075}>75 mm</option>
          <option value={0.1}>100 mm</option>
        </select>
      </div>

      <div className="spec-row">
        <label>Tray Type:</label>
        <select
          value={traySpec.trayType}
          onChange={(e) => {
            const updated = {
              ...traySpec,
              trayType: e.target.value as CableTraySpec['trayType'],
            };
            setTraySpec(updated);
            onSpecChange(updated);
          }}
        >
          <option value="ladder">Ladder Type</option>
          <option value="solid-bottom">Solid Bottom</option>
          <option value="ventilated">Ventilated</option>
          <option value="wire-mesh">Wire Mesh</option>
        </select>
      </div>

      <div className="spec-row">
        <label>Material:</label>
        <select
          value={traySpec.material}
          onChange={(e) => {
            const updated = {
              ...traySpec,
              material: e.target.value as CableTraySpec['material'],
            };
            setTraySpec(updated);
            onSpecChange(updated);
          }}
        >
          <option value="galvanized-steel">Galvanized Steel</option>
          <option value="aluminum">Aluminum</option>
          <option value="stainless">Stainless Steel</option>
          <option value="fiberglass">Fiberglass</option>
        </select>
      </div>

      <div className="spec-info">
        <strong>Load Rating:</strong> {traySpec.loadRating} kg/m<br />
        <strong>Max Cables:</strong> {traySpec.maxCables}
      </div>
    </div>
  );

  // Render conduit specification form
  const renderConduitSpec = () => {
    const recommended = getRecommendedConduitSize(4, '14 AWG');

    return (
      <div className="spec-form">
        <h3 className="spec-section-title">Conduit Configuration</h3>

        <div className="spec-row">
          <label>Nominal Size:</label>
          <select
            value={conduitSpec.nominalSize}
            onChange={(e) => {
              const updated = { ...conduitSpec, nominalSize: e.target.value };
              setConduitSpec(updated);
              onSpecChange(updated);
            }}
          >
            <option value="1/2&quot;">1/2&quot;</option>
            <option value="3/4&quot;">3/4&quot;</option>
            <option value="1&quot;">1&quot;</option>
            <option value="1-1/4&quot;">1-1/4&quot;</option>
            <option value="1-1/2&quot;">1-1/2&quot;</option>
            <option value="2&quot;">2&quot;</option>
          </select>
        </div>

        <div className="spec-row">
          <label>Conduit Type:</label>
          <select
            value={conduitSpec.conduitType}
            onChange={(e) => {
              const updated = {
                ...conduitSpec,
                conduitType: e.target.value as ConduitSpec['conduitType'],
              };
              setConduitSpec(updated);
              onSpecChange(updated);
            }}
          >
            <option value="EMT">EMT (Electrical Metallic Tubing)</option>
            <option value="IMC">IMC (Intermediate Metal Conduit)</option>
            <option value="rigid">Rigid Metal Conduit</option>
            <option value="PVC">PVC Conduit</option>
            <option value="flexible">Flexible Conduit</option>
            <option value="liquidtight">Liquidtight Flexible</option>
          </select>
        </div>

        <div className="spec-row">
          <label>Material:</label>
          <select
            value={conduitSpec.material}
            onChange={(e) => {
              const updated = {
                ...conduitSpec,
                material: e.target.value as ConduitSpec['material'],
              };
              setConduitSpec(updated);
              onSpecChange(updated);
            }}
          >
            <option value="steel">Steel</option>
            <option value="aluminum">Aluminum</option>
            <option value="PVC">PVC</option>
            <option value="fiberglass">Fiberglass</option>
          </select>
        </div>

        <div className="spec-info">
          <strong>Max Wires (40% fill):</strong> {conduitSpec.maxWires}<br />
          <strong>Recommended Size:</strong> {recommended}
        </div>
      </div>
    );
  };

  return (
    <div className="route-specification-panel">
      <h2>Route Specifications</h2>
      {routeType === 'electrical' && renderElectricalSpec()}
      {routeType === 'pipe' && renderPipeSpec()}
      {routeType === 'cable_tray' && renderCableTraySpec()}
      {routeType === 'conduit' && renderConduitSpec()}
    </div>
  );
};
