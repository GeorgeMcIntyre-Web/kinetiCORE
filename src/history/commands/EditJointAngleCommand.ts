// EditJointAngleCommand - undoable change to a revolute joint angle
// Owner: Edwin

import { Command } from '../Command';
import { ForwardKinematicsSolver } from '../../kinematics/ForwardKinematicsSolver';

export class EditJointAngleCommand extends Command {
  description = 'Edit joint angle';
  private readonly jointId: string;
  private readonly oldRadians: number;
  private readonly newRadians: number;

  constructor(jointId: string, oldRadians: number, newRadians: number) {
    super();
    this.jointId = jointId;
    this.oldRadians = oldRadians;
    this.newRadians = newRadians;
    this.description = `Edit angle ${jointId}`;
  }

  execute(): void {
    const fk = ForwardKinematicsSolver.getInstance();
    fk.updateJointPosition(this.jointId, this.newRadians);
  }

  undo(): void {
    const fk = ForwardKinematicsSolver.getInstance();
    fk.updateJointPosition(this.jointId, this.oldRadians);
  }
}
