# URDF File Import for Web-Based CAD with Physics

Let me search for current information on URDF parsing, conversion tools, and integration approaches for web applications.Let me search for more specific information about URDF integration with Rapier physics and Babylon.js.Let me search for more information about converting URDF joints to Rapier physics constraints.# URDF File Import: Comprehensive Integration Strategy

**URDF (Unified Robot Description Format) represents the robotics industry standard** for describing robot kinematics, making it essential for any CAD platform targeting robotics, automation, or mechanical simulation. URDF uses XML to define links (rigid bodies), joints (connections with motion constraints), and associated properties like mass, inertia, visual geometry, and collision shapes.

## URDF Format Structure and Joint Types

URDF supports six joint types: fixed (rigid connection), revolute (hinge with limits), continuous (unlimited rotation), prismatic (linear sliding), planar (2D translation), and floating (6 DOF unconstrained motion). For CAD and physics applications, the first four types handle 95% of use cases.

A typical URDF structure:

```xml
<?xml version="1.0"?>
<robot name="robot_arm">
  <!-- Base link (static) -->
  <link name="base_link">
    <visual>
      <geometry>
        <box size="0.1 0.1 0.05"/>
      </geometry>
      <material name="gray">
        <color rgba="0.5 0.5 0.5 1.0"/>
      </material>
    </visual>
    <collision>
      <geometry>
        <box size="0.1 0.1 0.05"/>
      </geometry>
    </collision>
    <inertial>
      <mass value="1.0"/>
      <inertia ixx="0.001" ixy="0" ixz="0" 
               iyy="0.001" iyz="0" izz="0.001"/>
    </inertial>
  </link>

  <!-- First arm segment -->
  <link name="arm_link_1">
    <visual>
      <geometry>
        <cylinder radius="0.02" length="0.3"/>
      </geometry>
      <origin xyz="0 0 0.15" rpy="0 0 0"/>
    </visual>
    <collision>
      <geometry>
        <cylinder radius="0.02" length="0.3"/>
      </geometry>
      <origin xyz="0 0 0.15" rpy="0 0 0"/>
    </collision>
    <inertial>
      <mass value="0.5"/>
      <origin xyz="0 0 0.15" rpy="0 0 0"/>
      <inertia ixx="0.004" ixy="0" ixz="0" 
               iyy="0.004" iyz="0" izz="0.0001"/>
    </inertial>
  </link>

  <!-- Revolute joint connecting base to arm -->
  <joint name="base_to_arm_joint" type="revolute">
    <parent link="base_link"/>
    <child link="arm_link_1"/>
    <origin xyz="0 0 0.05" rpy="0 0 0"/>
    <axis xyz="0 0 1"/>
    <limit lower="-3.14" upper="3.14" effort="10" velocity="1.0"/>
    <dynamics damping="0.1" friction="0.05"/>
  </joint>

  <!-- Prismatic joint example -->
  <joint name="gripper_slide" type="prismatic">
    <parent link="arm_link_2"/>
    <child link="gripper_left"/>
    <origin xyz="0.1 0 0" rpy="0 0 0"/>
    <axis xyz="0 1 0"/>
    <limit lower="0" upper="0.05" effort="100" velocity="0.1"/>
  </joint>
</robot>
```

Joint limits are specified in radians for revolute/continuous joints and meters for prismatic joints, and are omitted for fixed or continuous joints with no limits.

## JavaScript URDF Parsing Libraries

**The `urdf-loader` NPM package provides production-ready URDF parsing** for web applications, developed by NASA JPL and maintained by the community:

The urdf-loader library loads URDF files into THREE.js scenes, parsing XML structure, loading referenced mesh files, and constructing the kinematic hierarchy.

```bash
npm install urdf-loader three
```

Basic loading implementation:

```typescript
import { LoadingManager } from 'three';
import URDFLoader from 'urdf-loader';

class URDFImporter {
    private loader: URDFLoader;
    
    constructor() {
        const manager = new LoadingManager();
        this.loader = new URDFLoader(manager);
        
        // Configure package paths for mesh loading
        this.loader.packages = {
            'my_robot': './assets/robots/my_robot/',
            'common_meshes': './assets/common/'
        };
    }
    
    async loadRobot(urdfPath: string): Promise<URDFRobot> {
        return new Promise((resolve, reject) => {
            this.loader.load(
                urdfPath,
                (robot) => {
                    console.log('Robot loaded:', robot);
                    resolve(robot);
                },
                undefined,
                (error) => {
                    console.error('Failed to load URDF:', error);
                    reject(error);
                }
            );
        });
    }
}
```

The loader provides options for custom mesh loading callbacks, enabling collision geometry loading, and configuring fetch options for CORS handling.

## Converting URDF to Babylon.js Scene

The urdf-loader outputs THREE.js objects, requiring conversion to Babylon.js:

```typescript
class URDFToBabylonConverter {
    convertRobot(urdfRobot: URDFRobot, babylonScene: BABYLON.Scene): BabylonRobotModel {
        const robotRoot = new BABYLON.TransformNode(urdfRobot.name, babylonScene);
        const linkMeshes = new Map<string, BABYLON.Mesh>();
        const joints = new Map<string, JointInfo>();
        
        // Traverse URDF link hierarchy
        this.traverseLinks(urdfRobot, robotRoot, linkMeshes, joints, babylonScene);
        
        return {
            root: robotRoot,
            links: linkMeshes,
            joints: joints
        };
    }
    
    private traverseLinks(
        urdfLink: URDFLink,
        parentNode: BABYLON.TransformNode,
        linkMeshes: Map<string, BABYLON.Mesh>,
        joints: Map<string, JointInfo>,
        scene: BABYLON.Scene
    ) {
        // Create Babylon mesh for this link
        const linkNode = new BABYLON.TransformNode(urdfLink.name, scene);
        linkNode.parent = parentNode;
        
        // Convert visual geometry
        if (urdfLink.visual) {
            const visualMesh = this.convertGeometry(urdfLink.visual, scene);
            visualMesh.parent = linkNode;
            linkMeshes.set(urdfLink.name, visualMesh);
        }
        
        // Process child joints and links
        urdfLink.children.forEach(childJoint => {
            const jointInfo = this.extractJointInfo(childJoint);
            joints.set(childJoint.name, jointInfo);
            
            // Apply joint transform
            const childNode = new BABYLON.TransformNode(childJoint.name, scene);
            childNode.parent = linkNode;
            
            const position = childJoint.origin.position;
            const rotation = childJoint.origin.rotation;
            
            childNode.position = new BABYLON.Vector3(position.x, position.y, position.z);
            childNode.rotationQuaternion = this.eulerToQuaternion(rotation);
            
            // Recursively process child link
            this.traverseLinks(childJoint.child, childNode, linkMeshes, joints, scene);
        });
    }
    
    private convertGeometry(visualElement: any, scene: BABYLON.Scene): BABYLON.Mesh {
        const geometry = visualElement.geometry;
        
        // Handle different geometry types
        if (geometry.type === 'Box') {
            const size = geometry.size;
            return BABYLON.MeshBuilder.CreateBox(
                'link_visual',
                { width: size.x, height: size.y, depth: size.z },
                scene
            );
        } else if (geometry.type === 'Cylinder') {
            return BABYLON.MeshBuilder.CreateCylinder(
                'link_visual',
                { 
                    diameter: geometry.radius * 2,
                    height: geometry.length
                },
                scene
            );
        } else if (geometry.type === 'Sphere') {
            return BABYLON.MeshBuilder.CreateSphere(
                'link_visual',
                { diameter: geometry.radius * 2 },
                scene
            );
        } else if (geometry.type === 'Mesh') {
            // Load external mesh file (STL, OBJ, DAE, etc.)
            return this.loadExternalMesh(geometry.filename, scene);
        }
        
        // Fallback: create placeholder
        return BABYLON.MeshBuilder.CreateBox('placeholder', { size: 0.1 }, scene);
    }
}
```

## Mapping URDF Joints to Rapier Physics

**The critical integration step connects URDF joint definitions to Rapier constraints**:

```typescript
class URDFPhysicsIntegration {
    private world: RAPIER.World;
    private bodyMap = new Map<string, RAPIER.RigidBody>();
    private jointMap = new Map<string, RAPIER.ImpulseJoint>();
    
    constructor(world: RAPIER.World) {
        this.world = world;
    }
    
    createPhysicsBodies(
        robotModel: BabylonRobotModel,
        urdfRobot: URDFRobot
    ) {
        // Create rigid body for each link
        robotModel.links.forEach((mesh, linkName) => {
            const urdfLink = this.findURDFLink(urdfRobot, linkName);
            
            const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
                .setRotation(mesh.rotationQuaternion);
            
            const rigidBody = this.world.createRigidBody(rigidBodyDesc);
            
            // Create collision shape
            const colliderDesc = this.createColliderFromURDF(urdfLink, mesh);
            this.world.createCollider(colliderDesc, rigidBody);
            
            // Apply inertial properties from URDF
            if (urdfLink.inertial) {
                rigidBody.setAdditionalMass(urdfLink.inertial.mass);
                // Note: Rapier computes inertia from colliders,
                // for precision you'd need to set inertia tensor explicitly
            }
            
            this.bodyMap.set(linkName, rigidBody);
        });
        
        // Create joints connecting bodies
        robotModel.joints.forEach((jointInfo, jointName) => {
            this.createPhysicsJoint(jointInfo);
        });
    }
    
    private createPhysicsJoint(jointInfo: JointInfo) {
        const parentBody = this.bodyMap.get(jointInfo.parent);
        const childBody = this.bodyMap.get(jointInfo.child);
        
        if (!parentBody || !childBody) {
            console.warn(`Missing body for joint ${jointInfo.name}`);
            return;
        }
        
        let joint: RAPIER.ImpulseJoint;
        
        switch(jointInfo.type) {
            case 'revolute':
            case 'continuous':
                joint = this.createRevoluteJoint(
                    parentBody,
                    childBody,
                    jointInfo
                );
                break;
                
            case 'prismatic':
                joint = this.createPrismaticJoint(
                    parentBody,
                    childBody,
                    jointInfo
                );
                break;
                
            case 'fixed':
                joint = this.createFixedJoint(
                    parentBody,
                    childBody,
                    jointInfo
                );
                break;
                
            default:
                console.warn(`Unsupported joint type: ${jointInfo.type}`);
                return;
        }
        
        this.jointMap.set(jointInfo.name, joint);
    }
    
    private createRevoluteJoint(
        parentBody: RAPIER.RigidBody,
        childBody: RAPIER.RigidBody,
        jointInfo: JointInfo
    ): RAPIER.ImpulseJoint {
        const parentAnchor = this.transformToBodySpace(
            jointInfo.origin.position,
            parentBody
        );
        
        const childAnchor = new RAPIER.Vector3(0, 0, 0); // Joint origin is at child link's origin
        
        const axis = jointInfo.axis;
        
        const params = RAPIER.JointData.revolute(
            parentAnchor,
            childAnchor,
            axis
        );
        
        // Apply limits if specified (revolute, not continuous)
        if (jointInfo.type === 'revolute' && jointInfo.limit) {
            params.limitsEnabled = true;
            params.limits = [jointInfo.limit.lower, jointInfo.limit.upper];
        }
        
        const joint = this.world.createImpulseJoint(
            params,
            parentBody,
            childBody,
            true // wake up bodies
        );
        
        // Apply dynamics properties
        if (jointInfo.dynamics) {
            // Rapier uses motor for damping effect
            if (jointInfo.dynamics.damping > 0) {
                joint.configureMotorModel(RAPIER.MotorModel.ForceBased);
                joint.configureMotorVelocity(0, jointInfo.dynamics.damping);
            }
        }
        
        return joint;
    }
    
    private createPrismaticJoint(
        parentBody: RAPIER.RigidBody,
        childBody: RAPIER.RigidBody,
        jointInfo: JointInfo
    ): RAPIER.ImpulseJoint {
        const parentAnchor = this.transformToBodySpace(
            jointInfo.origin.position,
            parentBody
        );
        
        const childAnchor = new RAPIER.Vector3(0, 0, 0);
        const axis = jointInfo.axis;
        
        const params = RAPIER.JointData.prismatic(
            parentAnchor,
            childAnchor,
            axis
        );
        
        // Apply limits
        if (jointInfo.limit) {
            params.limitsEnabled = true;
            params.limits = [jointInfo.limit.lower, jointInfo.limit.upper];
        }
        
        const joint = this.world.createImpulseJoint(
            params,
            parentBody,
            childBody,
            true
        );
        
        return joint;
    }
    
    private createFixedJoint(
        parentBody: RAPIER.RigidBody,
        childBody: RAPIER.RigidBody,
        jointInfo: JointInfo
    ): RAPIER.ImpulseJoint {
        const parentAnchor = this.transformToBodySpace(
            jointInfo.origin.position,
            parentBody
        );
        
        const childAnchor = new RAPIER.Vector3(0, 0, 0);
        
        // Fixed joint locks all 6 DOF
        const params = RAPIER.JointData.fixed(
            parentAnchor,
            this.transformToBodySpace(jointInfo.origin.rotation, parentBody),
            childAnchor,
            new RAPIER.Rotation({ w: 1, x: 0, y: 0, z: 0 })
        );
        
        return this.world.createImpulseJoint(
            params,
            parentBody,
            childBody,
            true
        );
    }
}
```

## Joint Control and Animation

**Controlling joint positions requires motor application or kinematic mode**:

```typescript
class URDFJointController {
    private jointMap: Map<string, RAPIER.ImpulseJoint>;
    private bodyMap: Map<string, RAPIER.RigidBody>;
    
    setJointAngle(jointName: string, targetAngle: number) {
        const joint = this.jointMap.get(jointName);
        if (!joint) return;
        
        // Use position-based motor to drive to target angle
        joint.configureMotorPosition(
            targetAngle,
            100,  // stiffness
            10    // damping
        );
    }
    
    setJointVelocity(jointName: string, velocity: number) {
        const joint = this.jointMap.get(jointName);
        if (!joint) return;
        
        joint.configureMotorVelocity(velocity, 1000);
    }
    
    getJointAngle(jointName: string): number {
        const joint = this.jointMap.get(jointName);
        if (!joint) return 0;
        
        // Read current joint angle
        return joint.revolute_angle();
    }
    
    // For inverse kinematics - set link position directly
    setLinkPoseKinematic(linkName: string, position: BABYLON.Vector3, rotation: BABYLON.Quaternion) {
        const body = this.bodyMap.get(linkName);
        if (!body) return;
        
        // Switch to kinematic mode
        body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased);
        body.setNextKinematicTranslation(position);
        body.setNextKinematicRotation(rotation);
    }
}
```

## Handling URDF Package Paths and Mesh Loading

URDF files reference external mesh files using the `package://` URI scheme, requiring path resolution to actual file locations.

```typescript
class URDFMeshResolver {
    private packages: Record<string, string> = {};
    
    registerPackage(packageName: string, basePath: string) {
        this.packages[packageName] = basePath;
    }
    
    resolveMeshPath(urdfPath: string): string {
        // Handle package:// URIs
        if (urdfPath.startsWith('package://')) {
            const withoutPrefix = urdfPath.replace('package://', '');
            const parts = withoutPrefix.split('/');
            const packageName = parts[0];
            const relativePath = parts.slice(1).join('/');
            
            const basePath = this.packages[packageName];
            if (!basePath) {
                throw new Error(`Package not registered: ${packageName}`);
            }
            
            return `${basePath}/${relativePath}`;
        }
        
        // Handle file:// URIs
        if (urdfPath.startsWith('file://')) {
            return urdfPath.replace('file://', '');
        }
        
        // Assume relative path
        return urdfPath;
    }
    
    async loadMesh(meshPath: string, scene: BABYLON.Scene): Promise<BABYLON.Mesh> {
        const resolvedPath = this.resolveMeshPath(meshPath);
        const extension = resolvedPath.split('.').pop().toLowerCase();
        
        switch(extension) {
            case 'stl':
                return this.loadSTL(resolvedPath, scene);
            case 'obj':
                return this.loadOBJ(resolvedPath, scene);
            case 'dae':
                return this.loadCollada(resolvedPath, scene);
            case 'glb':
            case 'gltf':
                return this.loadGLTF(resolvedPath, scene);
            default:
                throw new Error(`Unsupported mesh format: ${extension}`);
        }
    }
}
```

## Complete Integration Example

Putting it all together:

```typescript
class URDFRobotLoader {
    private scene: BABYLON.Scene;
    private physicsWorld: RAPIER.World;
    
    async loadRobotFromURDF(urdfPath: string): Promise<RobotInstance> {
        // 1. Parse URDF using urdf-loader
        const urdfImporter = new URDFImporter();
        urdfImporter.loader.packages = {
            'my_robot': './assets/robots/my_robot/'
        };
        
        const urdfRobot = await urdfImporter.loadRobot(urdfPath);
        
        // 2. Convert to Babylon.js scene
        const converter = new URDFToBabylonConverter();
        const babylonModel = converter.convertRobot(urdfRobot, this.scene);
        
        // 3. Create physics bodies and joints
        const physicsIntegration = new URDFPhysicsIntegration(this.physicsWorld);
        physicsIntegration.createPhysicsBodies(babylonModel, urdfRobot);
        
        // 4. Create controller
        const controller = new URDFJointController();
        controller.initialize(
            physicsIntegration.getJointMap(),
            physicsIntegration.getBodyMap()
        );
        
        // 5. Setup synchronization
        const sync = new PhysicsSync(babylonModel.links, physicsIntegration.getBodyMap());
        
        return {
            model: babylonModel,
            controller: controller,
            sync: sync
        };
    }
    
    update(deltaTime: number) {
        // Step physics
        this.physicsWorld.step();
        
        // Sync visual meshes with physics bodies
        this.sync.updateMeshesFromPhysics();
    }
}
```

## Performance Considerations

**URDF robots with many joints require optimization**:

1. **Collision shape simplification** - Use convex hulls or primitive shapes instead of full mesh colliders
2. **Fixed joint merging** - Combine links connected by fixed joints into single rigid bodies
3. **Selective physics** - Only simulate active parts of the robot, keep rest kinematic
4. **LOD for visualization** - Use simplified meshes for distant parts

```typescript
function mergeFixedJoints(urdfRobot: URDFRobot): URDFRobot {
    const merged = cloneRobot(urdfRobot);
    
    // Find all fixed joints
    const fixedJoints = findJointsByType(merged, 'fixed');
    
    fixedJoints.forEach(joint => {
        // Combine parent and child links
        const parent = joint.parent;
        const child = joint.child;
        
        // Merge geometries
        parent.visual = combineGeometries(parent.visual, child.visual, joint.origin);
        parent.collision = combineGeometries(parent.collision, child.collision, joint.origin);
        
        // Combine inertias
        parent.inertial = combineInertias(parent.inertial, child.inertial, joint.origin);
        
        // Reparent child's children to parent
        child.children.forEach(grandchild => {
            grandchild.parent = parent;
            parent.children.push(grandchild);
        });
        
        // Remove child link and fixed joint
        removeLink(merged, child);
    });
    
    return merged;
}
```

This comprehensive approach enables full URDF robot import into your Babylon.js + Rapier physics CAD platform, maintaining kinematic accuracy while leveraging web-native technologies.