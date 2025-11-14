import * as BABYLON from '@babylonjs/core';
import { Position3D } from '../../domain/factoryServices/piping/pipingTypes';

export const babylonToDomainPosition = (vector: BABYLON.Vector3): Position3D => {
  return {
    x: vector.x,
    y: vector.z,
    z: vector.y,
  };
};

export const domainToBabylonVector = (position: Position3D): BABYLON.Vector3 => {
  return new BABYLON.Vector3(position.x, position.z, position.y);
};

