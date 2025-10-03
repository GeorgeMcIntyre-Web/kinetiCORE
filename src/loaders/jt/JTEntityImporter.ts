/**
 * JT Entity Importer - Integrates with kinetiCORE architecture
 * Handles physics integration and entity creation
 */

import * as BABYLON from '@babylonjs/core';
import { JTImportOptions, PhysicsShapeType, JTConstraint } from './types';
import { JTLoader } from './JTLoader';
import type { SceneEntity } from '../../entities/SceneEntity';
import type { EntityRegistry } from '../../entities/EntityRegistry';
import type { IPhysicsEngine } from '../../physics/IPhysicsEngine';

export class JTEntityImporter {
    private jtLoader: JTLoader;

    constructor(
        private entityRegistry: EntityRegistry,
        private physicsEngine: IPhysicsEngine
    ) {
        this.jtLoader = new JTLoader();
    }

    /**
     * Import JT file as scene entities with optional physics
     */
    async importAsEntities(
        file: File,
        options: JTImportOptions = {}
    ): Promise<SceneEntity[]> {

        // Load meshes using JT loader
        const meshes = await this.jtLoader.load(file, options.progressCallback);
        const entities: SceneEntity[] = [];

        for (const mesh of meshes) {
            // Create scene entity with physics (George's architecture)
            const entity = this.entityRegistry.create({
                mesh: mesh,
                physics: options.createPhysics ? {
                    type: options.physicsType || 'static',
                    shape: this.selectPhysicsShape(mesh),
                    mass: options.physicsType === 'dynamic' ? 1.0 : 0
                } : undefined
            });

            // Store JT-specific metadata
            entity.metadata = {
                ...entity.metadata,
                jtPartId: mesh.metadata.jtPartId,
                lodLevels: mesh.metadata.lodLevels,
                pmi: mesh.metadata.pmi,
                sourceFormat: 'jt'
            };

            entities.push(entity);
        }

        // Extract assembly constraints if available
        if (options.loadKinematics) {
            await this.extractKinematicConstraints(entities, file);
        }

        return entities;
    }

    /**
     * Select appropriate physics shape based on mesh geometry
     */
    private selectPhysicsShape(mesh: BABYLON.Mesh): PhysicsShapeType {
        const bounds = mesh.getBoundingInfo();
        const extents = bounds.boundingBox.extendSize;

        // Simple heuristic: box-like objects get box collider
        const aspectRatio = Math.max(extents.x, extents.y, extents.z) /
                           Math.min(extents.x, extents.y, extents.z);

        if (aspectRatio < 2.0) {
            return 'box'; // Roughly cubic
        }

        // Complex geometry uses trimesh (expensive but accurate)
        // For static objects this is acceptable
        return 'trimesh';
    }

    /**
     * Extract kinematic constraints from JT assembly
     */
    private async extractKinematicConstraints(
        entities: SceneEntity[],
        jtFile: File
    ): Promise<void> {
        // JT files can store assembly constraints (joints, mates)
        // This would require parsing the JT file's assembly structure
        // Placeholder for future implementation

        console.warn('Kinematic constraint extraction not yet implemented');

        // Example of what this would do:
        // const constraints = await this.parseConstraints(jtFile);
        // for (const constraint of constraints) {
        //     const part1 = entities.find(e => e.metadata.jtPartId === constraint.part1Id);
        //     const part2 = entities.find(e => e.metadata.jtPartId === constraint.part2Id);
        //
        //     if (!part1 || !part2) continue;
        //
        //     this.createJoint(part1, part2, constraint);
        // }
    }

    /**
     * Create physics joint from JT constraint
     */
    private createJoint(
        part1: SceneEntity,
        part2: SceneEntity,
        constraint: JTConstraint
    ): void {
        if (!part1.physicsBody || !part2.physicsBody) {
            console.warn('Cannot create joint: parts missing physics bodies');
            return;
        }

        // Create physics joint based on constraint type
        switch (constraint.type) {
            case 'revolute':
                // this.physicsEngine.createRevoluteJoint(
                //     part1.physicsBody,
                //     part2.physicsBody,
                //     constraint.axis,
                //     constraint.limits
                // );
                console.warn('Revolute joint creation not yet implemented');
                break;
            case 'prismatic':
                // this.physicsEngine.createPrismaticJoint(
                //     part1.physicsBody,
                //     part2.physicsBody,
                //     constraint.axis,
                //     constraint.limits
                // );
                console.warn('Prismatic joint creation not yet implemented');
                break;
            case 'fixed':
                console.warn('Fixed joint creation not yet implemented');
                break;
            case 'spherical':
                console.warn('Spherical joint creation not yet implemented');
                break;
        }
    }
}
