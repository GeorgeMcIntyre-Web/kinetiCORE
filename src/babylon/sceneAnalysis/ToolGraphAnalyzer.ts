import * as BABYLON from '@babylonjs/core';
import { WorldSpace, getWorldTransform } from '../utils/WorldSpace';

export type ToolUnitType = 'fixture' | 'gripper' | 'clamp' | 'pin' | 'dump' | 'slide' | 'unknown';

export interface ToolUnit {
  id: string;
  name: string;
  root: string; // node id
  type: ToolUnitType;
  isFixed: boolean;
  nodes: string[]; // descendant node ids
}

export interface ToolGraph {
  units: ToolUnit[];
  // world-space anchors for each unit root for later steps
  anchors: Record<string, { position: BABYLON.Vector3; rotation: BABYLON.Quaternion }>; // key: unit.id
}

export interface AnalyzeOptions {
  // Tags or name hints for classification
  fixedTags?: string[]; // e.g., ['fixed', 'fixture']
  movingTags?: string[]; // e.g., ['moving', 'gripper', 'slide']
  toolRootTags?: string[]; // e.g., ['tool', 'unit']
  nameHints?: Partial<Record<ToolUnitType, string[]>>;
}

const DEFAULT_OPTIONS: AnalyzeOptions = {
  fixedTags: ['fixed', 'fixture', 'infrastructure'],
  movingTags: ['moving', 'gripper', 'slide', 'clamp', 'pin', 'dump'],
  toolRootTags: ['tool', 'unit'],
  nameHints: {
    fixture: ['fixture', 'base', 'frame', 'station'],
    gripper: ['gripper', 'eot', 'end_effector'],
    clamp: ['clamp'],
    pin: ['pin', 'locating'],
    dump: ['dump'],
    slide: ['slide', 'linear'],
    unknown: [],
  },
};

function uuid(): string {
  return 'tool_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36);
}

function nodeId(node: BABYLON.Node): string {
  // Prefer uniqueId if available; fallback to name
  return `${node.id || node.uniqueId || node.name}`;
}

function classifyTypeByName(name: string, hints: AnalyzeOptions['nameHints']): ToolUnitType {
  const lname = (name || '').toLowerCase();
  if (!hints) return 'unknown';
  for (const key of Object.keys(hints) as ToolUnitType[]) {
    const patterns = hints[key] || [];
    if (patterns.some(p => lname.includes(p))) return key;
  }
  return 'unknown';
}

function hasAnyTag(node: BABYLON.Node, tags: string[]): boolean {
  return !!tags?.some(t => WorldSpace.nodeHasTag(node, t));
}

function collectDescendantIds(root: BABYLON.Node): string[] {
  const ids: string[] = [];
  const stack: BABYLON.Node[] = [root];
  while (stack.length) {
    const n = stack.pop()!;
    ids.push(nodeId(n));
    const children = (n as any).getChildren ? (n as any).getChildren() as BABYLON.Node[] : [];
    for (const c of children) stack.push(c);
  }
  return Array.from(new Set(ids));
}

export class ToolGraphAnalyzer {
  analyze(scene: BABYLON.Scene, options: AnalyzeOptions = {}): ToolGraph {
    const opts: AnalyzeOptions = { ...DEFAULT_OPTIONS, ...options };

    // Step 1: candidate tool roots
    const allRoots: BABYLON.Node[] = [];
    for (const rn of scene.rootNodes) {
      allRoots.push(rn);
    }

    const candidateNodes: BABYLON.Node[] = [];
    const visit = (n: BABYLON.Node) => {
      candidateNodes.push(n);
      const children = (n as any).getChildren ? (n as any).getChildren() as BABYLON.Node[] : [];
      for (const c of children) visit(c);
    };
    for (const r of allRoots) visit(r);

    const toolRoots = candidateNodes.filter(n => {
      const tagMatch = hasAnyTag(n, opts.toolRootTags || []);
      // Heuristic: treat named units as tool roots as well
      const name = (n.name || '').toLowerCase();
      const nameMatch = ['tool', 'unit', 'gripper', 'fixture', 'clamp', 'slide'].some(s => name.includes(s));
      return tagMatch || nameMatch;
    });

    // Fallback: if none tagged, consider immediate children of scene roots as potential units
    const fallbackRoots: BABYLON.Node[] = [];
    if (toolRoots.length === 0) {
      for (const r of allRoots) {
        const children = (r as any).getChildren ? (r as any).getChildren() as BABYLON.Node[] : [];
        fallbackRoots.push(...children);
      }
    }
    const unitRoots = toolRoots.length > 0 ? toolRoots : fallbackRoots;

    const units: ToolUnit[] = [];
    const anchors: ToolGraph['anchors'] = {};

    for (const root of unitRoots) {
      const id = uuid();
      const isFixedTagged = hasAnyTag(root, opts.fixedTags || []);
      const isMovingTagged = hasAnyTag(root, opts.movingTags || []);
      const type = classifyTypeByName(root.name, opts.nameHints);

      // Infer fixed vs moving: priority tags > fixture name > parent linkage
      let isFixed = isFixedTagged;
      if (!isFixed && !isMovingTagged) {
        if (type === 'fixture') isFixed = true;
        else {
          // If parent is null or tagged as infrastructure, more likely fixed
          const parent = root.parent as BABYLON.Node | null;
          if (!parent || hasAnyTag(parent, opts.fixedTags || [])) isFixed = true;
        }
      }

      const nodeIds = collectDescendantIds(root);
      const wt = getWorldTransform(root);

      units.push({
        id,
        name: root.name || id,
        root: nodeId(root),
        type,
        isFixed,
        nodes: nodeIds,
      });

      anchors[id] = { position: wt.position, rotation: wt.rotation };
    }

    // Post-process: ensure at least one fixed and one moving if possible (fixture vs gripper)
    if (units.length >= 2) {
      const anyFixed = units.some(u => u.isFixed);
      const anyMoving = units.some(u => !u.isFixed);
      if (!anyFixed) {
        // Choose the largest (by child count) as fixed
        let maxIdx = 0;
        for (let i = 1; i < units.length; i++) if (units[i].nodes.length > units[maxIdx].nodes.length) maxIdx = i;
        units[maxIdx].isFixed = true;
      }
      if (!anyMoving) {
        // Choose a non-fixed candidate as moving (smallest by child count)
        let minIdx = 0;
        for (let i = 1; i < units.length; i++) if (units[i].nodes.length < units[minIdx].nodes.length) minIdx = i;
        units[minIdx].isFixed = false;
      }
    }

    return { units, anchors };
  }
}


