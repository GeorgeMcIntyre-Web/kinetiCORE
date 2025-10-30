import { JointDefinition } from './JointMath';
import { toolingJsonToJoints, ToolingFileJson } from '../io/ToolingJsonAdapter';

export class KinematicRigBuilder {
  static fromToolingJson(
    data: ToolingFileJson,
    resolveParentId: (movingNodePath: string) => string
  ): JointDefinition[] {
    const joints = toolingJsonToJoints(data, resolveParentId).map(j => ({
      id: j.id,
      kind: j.type,
      parentNodeId: j.parentId,
      childNodeId: j.childId,
      axisWorld: j.axisWorld,
      anchorWorld: j.anchorWorld,
      limits: j.limits,
    }));
    return joints;
  }
}


