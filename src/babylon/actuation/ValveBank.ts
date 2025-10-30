import { JointDefinition, JointState, JointMath, MotionProfile } from '../kinematics/JointMath';
import * as BABYLON from '@babylonjs/core';

export type Command = 'extend' | 'retract' | 'hold';

export interface Channel {
  id: string;
  unitId: string;
  jointId: string;
  profile?: MotionProfile;
  // targets
  advanceValue: number; // radians or meters
  retractValue: number;
}

export interface TimelineEvent {
  tMs: number;
  cmd: Command;
  channelId: string;
}

export class ValveBank {
  private scene: BABYLON.Scene;
  private joints: Map<string, { def: JointDefinition; state: JointState }> = new Map();
  private channels: Map<string, Channel> = new Map();

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
  }

  registerJoint(def: JointDefinition): void {
    this.joints.set(def.id, { def, state: new JointState() });
  }

  addChannel(channel: Channel): void {
    this.channels.set(channel.id, channel);
  }

  async runTimeline(events: TimelineEvent[], options: { stepMs?: number } = {}): Promise<void> {
    const stepMs = options.stepMs ?? 16;
    const start = performance.now();
    let idx = 0;

    const sorted = events.slice().sort((a, b) => a.tMs - b.tMs);

    while (idx < sorted.length) {
      const now = performance.now();
      const tRel = now - start;
      while (idx < sorted.length && sorted[idx].tMs <= tRel) {
        const ev = sorted[idx++];
        this.applyCommand(ev.channelId, ev.cmd);
      }
      this.step();
      await new Promise(res => setTimeout(res, stepMs));
    }
    // Finish settling
    for (let k = 0; k < 20; k++) {
      this.step();
      await new Promise(res => setTimeout(res, stepMs));
    }
  }

  private applyCommand(channelId: string, cmd: Command): void {
    const ch = this.channels.get(channelId);
    if (!ch) return;
    const joint = this.joints.get(ch.jointId);
    if (!joint) return;
    const target = cmd === 'extend' ? ch.advanceValue : cmd === 'retract' ? ch.retractValue : joint.state.value;
    joint.state.value = JointMath.clampToLimits(target, joint.def.limits);
  }

  private step(): void {
    // Kinematic (no dynamics): directly apply transforms based on current state
    for (const { def, state } of this.joints.values()) {
      JointMath.applyJointTransform(this.scene, def, state);
    }
  }
}


