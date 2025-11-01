// Measurement Tools - Distance, Angle, Volume measurements
// Owner: George (Architecture)

import React, { useState, useEffect, useRef } from 'react';
import { Ruler, Triangle, Box as BoxIcon, X } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { SceneManager } from '../../scene/SceneManager';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import * as BABYLON from '@babylonjs/core';
import './MeasurementTools.css';

export type MeasurementType = 'distance' | 'angle' | 'volume' | null;

export interface MeasurementToolsProps {
  measurementType: MeasurementType;
  onClose: () => void;
}

interface MeasurementState {
  type: MeasurementType;
  points: BABYLON.Vector3[];
  nodes: string[];
  result: string | null;
  helperMeshes: BABYLON.Mesh[];
}

export const MeasurementTools: React.FC<MeasurementToolsProps> = ({
  measurementType,
  onClose,
}) => {
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);
  const sceneManager = SceneManager.getInstance();
  const scene = sceneManager.getScene();
  const tree = SceneTreeManager.getInstance();

  const [state, setState] = useState<MeasurementState>({
    type: measurementType,
    points: [],
    nodes: [],
    result: null,
    helperMeshes: [],
  });

  const pickObserverRef = useRef<BABYLON.Observer<BABYLON.PointerInfo> | null>(null);

  // Cleanup helper meshes
  useEffect(() => {
    return () => {
      state.helperMeshes.forEach((mesh) => {
        mesh.dispose();
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Setup pick observer
  useEffect(() => {
    if (!scene || !measurementType) return;

    const onPointerPick = (evt: BABYLON.PointerInfo) => {
      if (evt.pickInfo?.hit && evt.pickInfo.pickedPoint) {
        handlePick(evt.pickInfo.pickedPoint, evt.pickInfo.pickedMesh);
      }
    };

    scene.onPointerObservable.add(onPointerPick, BABYLON.PointerEventTypes.POINTERPICK);
    pickObserverRef.current = scene.onPointerObservable.add(onPointerPick);

    return () => {
      if (pickObserverRef.current) {
        scene.onPointerObservable.remove(pickObserverRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, measurementType, state]);

  const handlePick = (point: BABYLON.Vector3, mesh: BABYLON.AbstractMesh | null) => {
    setState((prev) => {
      const newPoints = [...prev.points, point.clone()];
      const newNodes = mesh ? [...prev.nodes, mesh.name] : prev.nodes;
      
      let result: string | null = null;
      const newHelperMeshes: BABYLON.Mesh[] = [...prev.helperMeshes];

      if (measurementType === 'distance') {
        if (newPoints.length === 2) {
          const distance = BABYLON.Vector3.Distance(newPoints[0], newPoints[1]);
          const distanceMm = distance * 1000; // Convert to mm
          result = `Distance: ${distanceMm.toFixed(2)} mm`;
          
          // Create thicker glowing line using tube in accent color
          const tube = BABYLON.MeshBuilder.CreateTube('distance-line-tube', {
            path: [newPoints[0], newPoints[1]],
            radius: 0.01,
            updatable: false,
          }, scene!);
          const lineMat = new BABYLON.StandardMaterial('kc-measure-line-mat', scene!);
          lineMat.emissiveColor = BABYLON.Color3.FromHexString('#00D9FF');
          lineMat.diffuseColor = BABYLON.Color3.FromHexString('#00D9FF');
          lineMat.alpha = 0.7;
          tube.material = lineMat;
          newHelperMeshes.push(tube);

          // Create sphere markers with cyan glow
          newPoints.forEach((p, i) => {
            const sphere = BABYLON.MeshBuilder.CreateSphere(`marker-${i}`, {
              diameter: 0.04,
            }, scene!);
            sphere.position = p;

            // Create emissive cyan material
            const mat = new BABYLON.StandardMaterial(`marker-mat-${i}`, scene!);
            mat.emissiveColor = BABYLON.Color3.FromHexString('#00D9FF');
            mat.diffuseColor = BABYLON.Color3.FromHexString('#00D9FF');
            mat.alpha = 0.9;
            sphere.material = mat;

            // Add glow layer
            if (!scene!.getGlowLayerByName('measurement-glow')) {
              const gl = new BABYLON.GlowLayer('measurement-glow', scene!);
              gl.intensity = 0.8;
            }
            const glowLayer = scene!.getGlowLayerByName('measurement-glow') as BABYLON.GlowLayer;
            glowLayer.addIncludedOnlyMesh(sphere);

            newHelperMeshes.push(sphere);
          });
        }
      } else if (measurementType === 'angle') {
        if (newPoints.length === 3) {
          // Calculate angle at middle point
          const v1 = newPoints[0].subtract(newPoints[1]).normalize();
          const v2 = newPoints[2].subtract(newPoints[1]).normalize();
          const dot = BABYLON.Vector3.Dot(v1, v2);
          const angleRad = Math.acos(Math.max(-1, Math.min(1, dot)));
          const angleDeg = angleRad * (180 / Math.PI);
          result = `Angle: ${angleDeg.toFixed(2)}°`;

          // Create thicker glowing lines for angle
          const tube1 = BABYLON.MeshBuilder.CreateTube('angle-line1', {
            path: [newPoints[0], newPoints[1]],
            radius: 0.01,
          }, scene!);
          const tube2 = BABYLON.MeshBuilder.CreateTube('angle-line2', {
            path: [newPoints[1], newPoints[2]],
            radius: 0.01,
          }, scene!);
          const angleMat = new BABYLON.StandardMaterial('kc-angle-line-mat', scene!);
          angleMat.emissiveColor = BABYLON.Color3.FromHexString('#00D9FF');
          angleMat.diffuseColor = BABYLON.Color3.FromHexString('#00D9FF');
          angleMat.alpha = 0.7;
          tube1.material = angleMat;
          tube2.material = angleMat;
          newHelperMeshes.push(tube1, tube2);

          // Create markers with cyan glow
          newPoints.forEach((p, i) => {
            const sphere = BABYLON.MeshBuilder.CreateSphere(`angle-marker-${i}`, {
              diameter: 0.04,
            }, scene!);
            sphere.position = p;

            const mat = new BABYLON.StandardMaterial(`angle-marker-mat-${i}`, scene!);
            mat.emissiveColor = BABYLON.Color3.FromHexString('#00D9FF');
            mat.diffuseColor = BABYLON.Color3.FromHexString('#00D9FF');
            mat.alpha = 0.9;
            sphere.material = mat;

            const glowLayer = scene!.getGlowLayerByName('measurement-glow') as BABYLON.GlowLayer;
            if (glowLayer) glowLayer.addIncludedOnlyMesh(sphere);

            newHelperMeshes.push(sphere);
          });
        }
      } else if (measurementType === 'volume') {
        // For volume, use selected nodes
        if (selectedNodeIds.length > 0) {
          let totalVolume = 0;
          let count = 0;

          selectedNodeIds.forEach((nodeId) => {
            const node = tree.getNode(nodeId);
            if (!node) return;

            let babylonNode: BABYLON.AbstractMesh | null = null;
            if (node.babylonMeshId) {
              babylonNode = scene!.getMeshByUniqueId(parseInt(node.babylonMeshId));
            }

            if (babylonNode) {
              babylonNode.computeWorldMatrix(true);
              const bbox = babylonNode.getBoundingInfo().boundingBox;
              const size = bbox.maximum.subtract(bbox.minimum);
              const volume = Math.abs(size.x * size.y * size.z);
              totalVolume += volume;
              count++;
            }
          });

          if (count > 0) {
            const volumeMm3 = totalVolume * 1e9; // Convert m³ to mm³
            const volumeCm3 = volumeMm3 / 1000; // Convert to cm³
            result = `Volume: ${volumeCm3.toFixed(2)} cm³ (${volumeMm3.toFixed(0)} mm³)`;
          }
        }
      }

      return {
        ...prev,
        points: newPoints,
        nodes: newNodes,
        result,
        helperMeshes: newHelperMeshes,
      };
    });

    // Auto-close for volume (uses selection, not picks)
    if (measurementType === 'volume') {
      setTimeout(() => {
        onClose();
      }, 2000);
    }
  };

  const handleReset = () => {
    state.helperMeshes.forEach((mesh) => {
      mesh.dispose();
    });
    setState({
      type: measurementType,
      points: [],
      nodes: [],
      result: null,
      helperMeshes: [],
    });
  };

  const getInstructions = () => {
    switch (measurementType) {
      case 'distance':
        return state.points.length < 2
          ? 'Click on two points in the scene to measure distance'
          : 'Measurement complete. Click Reset to measure again.';
      case 'angle':
        return state.points.length < 3
          ? 'Click on three points to measure angle (angle at middle point)'
          : 'Measurement complete. Click Reset to measure again.';
      case 'volume':
        return selectedNodeIds.length > 0
          ? `Measuring volume of ${selectedNodeIds.length} selected object(s)...`
          : 'Select one or more objects to measure volume';
      default:
        return '';
    }
  };

  if (!measurementType) return null;

  return (
    <div className="measurement-tools-panel">
      <div className="measurement-tools-header">
        <div className="measurement-tools-title">
          {measurementType === 'distance' && <Ruler size={18} />}
          {measurementType === 'angle' && <Triangle size={18} />}
          {measurementType === 'volume' && <BoxIcon size={18} />}
          <span>
            {measurementType.charAt(0).toUpperCase() + measurementType.slice(1)} Measurement
          </span>
        </div>
        <button className="measurement-tools-close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="measurement-tools-content">
        <div className="measurement-instructions">{getInstructions()}</div>

        {state.result && (
          <div className="measurement-result">
            <div className="measurement-result-label">Result:</div>
            <div className="measurement-result-value">{state.result}</div>
          </div>
        )}

        {(measurementType === 'distance' || measurementType === 'angle') && (
          <div className="measurement-info">
            <div className="measurement-points-count">
              Points selected: {state.points.length}
              {measurementType === 'distance' && ' / 2'}
              {measurementType === 'angle' && ' / 3'}
            </div>
          </div>
        )}

        {measurementType === 'volume' && (
          <div className="measurement-info">
            <div className="measurement-selection-count">
              Objects selected: {selectedNodeIds.length}
            </div>
          </div>
        )}

        <div className="measurement-tools-actions">
          <button className="measurement-btn reset" onClick={handleReset}>
            Reset
          </button>
          <button className="measurement-btn close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

