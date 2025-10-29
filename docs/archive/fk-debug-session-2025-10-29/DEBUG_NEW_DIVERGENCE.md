# New Divergence Issue - 54.81mm

**Status:** Need to investigate why divergence changed from 0.00mm to 54.81mm

## Check Joint Angles

Run this to see what joint angles we're comparing:

```javascript
console.clear();
const chains = kinematicsManager.getAllChains();
const chainName = chains[0].name;
const chainId = chains[0].id;

// Get current joint angles
const joints = kinematicsManager.getActuatedJoints(chainId);
console.log('=== CURRENT JOINT ANGLES ===');
joints.forEach((j, i) => {
  console.log(`J${i}: ${(j.position * 180 / Math.PI).toFixed(2)}°`);
});

// Get FK result
const fkPose = fkSolver.solve(chainName, joints.map(j => j.position));
console.log('\n=== FK RESULT ===');
console.log(`Position: X=${fkPose.position.x.toFixed(4)}, Y=${fkPose.position.y.toFixed(4)}, Z=${fkPose.position.z.toFixed(4)}`);

// Get mesh position
const meshPose = fkSolver.getNullTCPPose(chainName);
console.log('\n=== MESH POSITION ===');
console.log(`Position: X=${meshPose.position.x.toFixed(4)}, Y=${meshPose.position.y.toFixed(4)}, Z=${meshPose.position.z.toFixed(4)}`);

// Calculate divergence
const diff = BABYLON.Vector3.Distance(meshPose.position, fkPose.position);
console.log(`\n=== DIVERGENCE ===`);
console.log(`${(diff * 1000).toFixed(2)}mm`);
```
