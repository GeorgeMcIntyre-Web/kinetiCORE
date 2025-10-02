// Coordinate Frame Widget - Corner overlay showing current orientation
// Owner: Edwin
// Displays XYZ orientation indicator like CAD software

import { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import './CoordinateFrame.css';

interface CoordinateFrameProps {
  camera: BABYLON.Camera | null;
}

export const CoordinateFrame: React.FC<CoordinateFrameProps> = ({ camera }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !camera) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 120; // Canvas size (increased for labels)
    const center = size / 2;
    const axisLength = 30; // Shorter to leave room for labels

    const drawFrame = () => {
      // Clear canvas
      ctx.clearRect(0, 0, size, size);

      if (!(camera instanceof BABYLON.ArcRotateCamera)) return;

      // Get camera forward and right vectors directly from camera
      // This avoids gimbal lock issues by using the camera's actual orientation
      const cameraPosition = camera.position;
      const targetPosition = camera.target || BABYLON.Vector3.Zero();

      // Calculate camera's forward direction (from camera to target)
      const forward = targetPosition.subtract(cameraPosition).normalize();

      // Camera's up vector
      const up = camera.upVector.clone().normalize();

      // Camera's right vector (cross product of forward and up)
      const right = BABYLON.Vector3.Cross(up, forward).normalize();

      // Recalculate up to ensure orthogonal (in case of drift)
      const trueUp = BABYLON.Vector3.Cross(forward, right).normalize();

      // Define world axes in Babylon's coordinate system (Y-up)
      // User space: X=right, Y=forward, Z=up
      // Babylon space: X=right, Y=up, Z=forward
      const worldAxes = [
        { dir: new BABYLON.Vector3(1, 0, 0), color: '#FF4444', label: 'X' }, // User X (Right)
        { dir: new BABYLON.Vector3(0, 0, 1), color: '#4444FF', label: 'Y' }, // User Y (Forward) = Babylon Z
        { dir: new BABYLON.Vector3(0, 1, 0), color: '#44FF44', label: 'Z' }, // User Z (Up) = Babylon Y
      ];

      // Project each axis to camera space
      const projectedAxes = worldAxes.map(axis => {
        // Project world axis onto camera basis vectors
        const camX = BABYLON.Vector3.Dot(axis.dir, right);
        const camY = BABYLON.Vector3.Dot(axis.dir, trueUp);
        const camZ = BABYLON.Vector3.Dot(axis.dir, forward);

        // Convert to screen coordinates
        const screenX = center + camX * axisLength;
        const screenY = center - camY * axisLength; // Flip Y for screen coordinates

        return {
          x: screenX,
          y: screenY,
          depth: camZ, // Positive = away from camera
          color: axis.color,
          label: axis.label,
        };
      });

      // Sort by depth (draw back-to-front)
      projectedAxes.sort((a, b) => a.depth - b.depth);

      // Draw each axis
      projectedAxes.forEach(axis => {
        drawAxis(ctx, center, center, axis.x, axis.y, axis.color, axis.label);
      });
    };

    const drawAxis = (
      ctx: CanvasRenderingContext2D,
      startX: number,
      startY: number,
      endX: number,
      endY: number,
      color: string,
      label: string
    ) => {
      // Draw line
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Draw arrowhead
      const angle = Math.atan2(endY - startY, endX - startX);
      const arrowSize = 8;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - arrowSize * Math.cos(angle - Math.PI / 6),
        endY - arrowSize * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        endX - arrowSize * Math.cos(angle + Math.PI / 6),
        endY - arrowSize * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();

      // Draw label at end of arrow
      ctx.fillStyle = color;
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Calculate label position with proper offset from arrow tip
      const dx = endX - startX;
      const dy = endY - startY;
      const length = Math.sqrt(dx * dx + dy * dy);
      const labelOffset = 15;

      const labelX = endX + (dx / length) * labelOffset;
      const labelY = endY + (dy / length) * labelOffset;

      ctx.fillText(label, labelX, labelY);
    };

    // Initial draw
    drawFrame();

    // Update when camera moves
    let animationId: number;
    const updateFrame = () => {
      drawFrame();
      animationId = requestAnimationFrame(updateFrame);
    };
    animationId = requestAnimationFrame(updateFrame);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [camera]);

  if (!camera) return null;

  return (
    <div className="coordinate-frame">
      <canvas ref={canvasRef} width={120} height={120} />
    </div>
  );
};
