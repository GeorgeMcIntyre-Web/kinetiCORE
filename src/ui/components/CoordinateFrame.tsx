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

    const frameSize = 90; // Size for each frame
    const canvasWidth = 200; // Width for two frames side by side
    const canvasHeight = 110; // Height to accommodate frames and labels
    const axisLength = 25; // Axis length - shorter to fit labels
    const frameSpacing = 10; // Space between frames

    const drawFrame = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

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

      // Define CAD frame axes (Z-up CAD convention)
      // User space: X=right, Y=forward, Z=up
      // Babylon space: X=right, Y=up, Z=forward
      const cadAxes = [
        { dir: new BABYLON.Vector3(1, 0, 0), color: '#FF4444', label: 'X' }, // X = right (same in both)
        { dir: new BABYLON.Vector3(0, 0, 1), color: '#44FF44', label: 'Y' }, // Y = forward (Babylon +Z)
        { dir: new BABYLON.Vector3(0, 1, 0), color: '#4444FF', label: 'Z' }, // Z = up (Babylon +Y)
      ];

      // Define Babylon frame axes (Y-up native Babylon convention)
      // Babylon space: X=right, Y=up, Z=forward
      const babylonAxes = [
        { dir: new BABYLON.Vector3(1, 0, 0), color: '#FF4444', label: 'X' }, // X = right
        { dir: new BABYLON.Vector3(0, 1, 0), color: '#44FF44', label: 'Y' }, // Y = up
        { dir: new BABYLON.Vector3(0, 0, 1), color: '#4444FF', label: 'Z' }, // Z = forward
      ];

      // Draw CAD frame (left side)
      const cadCenterX = frameSize / 2;
      const cadCenterY = frameSize / 2;
      drawCoordinateFrame(ctx, cadAxes, cadCenterX, cadCenterY, right, trueUp, forward, axisLength);

      // Draw Babylon frame (right side)
      const babylonCenterX = frameSize + frameSpacing + frameSize / 2;
      const babylonCenterY = frameSize / 2;
      drawCoordinateFrame(ctx, babylonAxes, babylonCenterX, babylonCenterY, right, trueUp, forward, axisLength);

      // Draw labels below frames with better visibility
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      
      // Draw text with stroke for better visibility
      const labelY = frameSize + 8;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      
      // Draw CAD label
      ctx.strokeText('CAD(Zup)', cadCenterX, labelY);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('CAD(Zup)', cadCenterX, labelY);
      
      // Draw Babylon label
      ctx.strokeText('Babylon(Yup)', babylonCenterX, labelY);
      ctx.fillText('Babylon(Yup)', babylonCenterX, labelY);
    };

    const drawCoordinateFrame = (
      ctx: CanvasRenderingContext2D,
      axes: Array<{ dir: BABYLON.Vector3; color: string; label: string }>,
      centerX: number,
      centerY: number,
      right: BABYLON.Vector3,
      trueUp: BABYLON.Vector3,
      forward: BABYLON.Vector3,
      axisLength: number
    ) => {
      // Project each axis to camera space
      const projectedAxes = axes.map(axis => {
        // Project world axis onto camera basis vectors
        const camX = BABYLON.Vector3.Dot(axis.dir, right);
        const camY = BABYLON.Vector3.Dot(axis.dir, trueUp);
        const camZ = BABYLON.Vector3.Dot(axis.dir, forward);

        // Convert to screen coordinates
        const screenX = centerX + camX * axisLength;
        const screenY = centerY - camY * axisLength; // Flip Y for screen coordinates

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
        drawAxis(ctx, centerX, centerY, axis.x, axis.y, axis.color, axis.label);
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
      // Draw line with defined stroke
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Draw arrowhead
      const angle = Math.atan2(endY - startY, endX - startX);
      const arrowSize = 8;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
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
      ctx.stroke();

      // Draw label at end of arrow
      ctx.fillStyle = color;
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Calculate label position with proper offset from arrow tip
      const dx = endX - startX;
      const dy = endY - startY;
      const length = Math.sqrt(dx * dx + dy * dy);
      const labelOffset = 10;

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
      <canvas ref={canvasRef} width={200} height={110} />
    </div>
  );
};
