# Debug: What Joint Angles is FK Getting?

Paste this in console to see what's happening:

```javascript
console.clear();
const chains = kinematicsManager.getAllChains();
const chainName = chains[0].name;
const chainId = chains[0].id;

// Get joints
const joints = kinematicsManager.getActuatedJoints(chainId);

console.log('=== JOINT ANGLES DEBUG ===');
console.log('Chain:', chainName);
console.log('Chain ID:', chainId);
console.log('Number of joints:', joints.length);
console.log('\nJoint positions (radians):');
joints.forEach((j, i) => {
  console.log(`  J${i}: ${j.position.toFixed(4)} rad = ${(j.position * 180 / Math.PI).toFixed(2)}°`);
});

const jointAngles = joints.map(j => j.position);
console.log('\nJoint angles array:', jointAngles);

// Test FK with these angles
const fkPose = fkSolver.solve(chainName, jointAngles);
console.log('\nFK Result:');
console.log(`  Position: X=${fkPose.position.x.toFixed(4)}, Y=${fkPose.position.y.toFixed(4)}, Z=${fkPose.position.z.toFixed(4)}`);

// Compare to mesh
const meshPose = fkSolver.getNullTCPPose(chainName);
console.log('\nMesh Position:');
console.log(`  Position: X=${meshPose.position.x.toFixed(4)}, Y=${meshPose.position.y.toFixed(4)}, Z=${meshPose.position.z.toFixed(4)}`);

const diff = BABYLON.Vector3.Distance(meshPose.position, fkPose.position);
console.log(`\nDivergence: ${(diff * 1000).toFixed(2)}mm`);
```
