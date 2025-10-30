import { KinematicModelExport, ActuatorProgramOutput } from './Schemas';

export class MJCFExporter {
  static export(model: KinematicModelExport): string {
    const lines: string[] = [];
    lines.push('<mujoco model="kinetiCORE">');
    lines.push('  <worldbody>');
    // We emit joints as comments and provide minimal structure; full body tree requires link frames which we can extend later.
    for (const j of model.joints) {
      if (j.type === 'hinge') {
        lines.push(
          `    <!-- hinge ${j.id} parent=${j.parentId} child=${j.childId} axis=(${j.axisWorld.x.toFixed(4)} ${j.axisWorld.y.toFixed(4)} ${j.axisWorld.z.toFixed(4)}) anchor=(${j.anchorWorld.x.toFixed(4)} ${j.anchorWorld.y.toFixed(4)} ${j.anchorWorld.z.toFixed(4)}) limits=[${j.limits.lower.toFixed(4)}, ${j.limits.upper.toFixed(4)}] -->`
        );
      } else {
        lines.push(
          `    <!-- slide ${j.id} parent=${j.parentId} child=${j.childId} axis=(${j.axisWorld.x.toFixed(4)} ${j.axisWorld.y.toFixed(4)} ${j.axisWorld.z.toFixed(4)}) anchor=(${j.anchorWorld.x.toFixed(4)} ${j.anchorWorld.y.toFixed(4)} ${j.anchorWorld.z.toFixed(4)}) limits=[${j.limits.lower.toFixed(4)}, ${j.limits.upper.toFixed(4)}] -->`
        );
      }
    }
    lines.push('  </worldbody>');
    // Actuators
    lines.push('  <actuator>');
    for (const ch of model.actuatorProgram.channels) {
      lines.push(`    <!-- channel ${ch.id} unit=${ch.unitId} -->`);
    }
    lines.push('  </actuator>');
    lines.push('</mujoco>');
    return lines.join('\n');
  }

  static exportProgram(program: ActuatorProgramOutput): string {
    return JSON.stringify(program, null, 2);
  }
}


