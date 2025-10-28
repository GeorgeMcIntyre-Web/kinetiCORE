// EditJointLimitsCommand - undoable change to joint limits
// Owner: Edwin

import { Command } from '../Command';
import { KinematicsManager, JointConfig } from '../../kinematics/KinematicsManager';

export class EditJointLimitsCommand extends Command {
  description = 'Edit joint limits';
  private readonly jointId: string;
  private readonly oldLimits: JointConfig['limits'];
  private readonly newLimits: JointConfig['limits'];

  constructor(jointId: string, oldLimits: JointConfig['limits'], newLimits: JointConfig['limits']) {
    super();
    this.jointId = jointId;
    this.oldLimits = { ...oldLimits };
    this.newLimits = { ...newLimits };
    this.description = `Edit limits ${jointId}`;
  }

  private setLimits(limits: JointConfig['limits']) {
    const km = KinematicsManager.getInstance();
    const j = km.getJoint(this.jointId);
    if (!j) return;
    j.limits = { ...limits };
  }

  execute(): void {
    this.setLimits(this.newLimits);
  }

  undo(): void {
    this.setLimits(this.oldLimits);
  }
}
