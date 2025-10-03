// CollisionAnalyzer - Analyzes collision data for insights
// Owner: George

import { CollisionContact, CollisionManifold } from '../physics/IPhysicsEngine';
import { EntityRegistry } from '../entities/EntityRegistry';

export interface CollisionAnalysis {
  totalContacts: number;
  totalPenetration: number;
  maxPenetration: number;
  averagePenetration: number;
  collisionPairs: number;
  mostPenetratingPair: { bodyA: string; bodyB: string; penetration: number } | null;
  collisionsByBody: Map<string, number>;
}

export class CollisionAnalyzer {
  static analyze(contacts: CollisionContact[], manifolds: CollisionManifold[]): CollisionAnalysis {
    const analysis: CollisionAnalysis = {
      totalContacts: contacts.length,
      totalPenetration: 0,
      maxPenetration: 0,
      averagePenetration: 0,
      collisionPairs: manifolds.length,
      mostPenetratingPair: null,
      collisionsByBody: new Map(),
    };

    contacts.forEach((c) => {
      analysis.totalPenetration += c.depth;
      analysis.maxPenetration = Math.max(analysis.maxPenetration, c.depth);
      analysis.collisionsByBody.set(c.bodyA, (analysis.collisionsByBody.get(c.bodyA) || 0) + 1);
      analysis.collisionsByBody.set(c.bodyB, (analysis.collisionsByBody.get(c.bodyB) || 0) + 1);
    });
    if (contacts.length > 0) {
      analysis.averagePenetration = analysis.totalPenetration / contacts.length;
    }

    if (manifolds.length > 0) {
      let maxM = manifolds[0];
      manifolds.forEach((m) => {
        if (m.totalPenetration > maxM.totalPenetration) maxM = m;
      });
      analysis.mostPenetratingPair = {
        bodyA: maxM.bodyA,
        bodyB: maxM.bodyB,
        penetration: maxM.totalPenetration,
      };
    }

    return analysis;
  }

  static generateReport(analysis: CollisionAnalysis): string {
    const registry = EntityRegistry.getInstance();
    let report = '📊 COLLISION ANALYSIS REPORT\n';
    report += '══════════════════════════════════════════════════\n\n';
    report += `Total Contacts: ${analysis.totalContacts}\n`;
    report += `Collision Pairs: ${analysis.collisionPairs}\n`;
    report += `Total Penetration: ${(analysis.totalPenetration * 1000).toFixed(2)}mm\n`;
    report += `Max Penetration: ${(analysis.maxPenetration * 1000).toFixed(2)}mm\n`;
    report += `Avg Penetration: ${(analysis.averagePenetration * 1000).toFixed(2)}mm\n\n`;

    if (analysis.mostPenetratingPair) {
      const entityA = registry.get(analysis.mostPenetratingPair.bodyA);
      const entityB = registry.get(analysis.mostPenetratingPair.bodyB);
      report += '🔴 MOST SEVERE COLLISION:\n';
      report += `  ${(entityA as any)?.getMetadata?.().name || 'Unknown'} ↔ ${(entityB as any)?.getMetadata?.().name || 'Unknown'}\n`;
      report += `  Penetration: ${(analysis.mostPenetratingPair.penetration * 1000).toFixed(2)}mm\n\n`;
    }

    if (analysis.collisionsByBody.size > 0) {
      report += '📋 COLLISIONS PER OBJECT:\n';
      const sorted = Array.from(analysis.collisionsByBody.entries()).sort((a, b) => b[1] - a[1]);
      sorted.slice(0, 5).forEach(([bodyId, count]) => {
        const entity = registry.get(bodyId as string);
        const name = (entity as any)?.getMetadata?.().name || 'Unknown';
        report += `  ${name}: ${count} contacts\n`;
      });
    }

    return report;
  }
}

