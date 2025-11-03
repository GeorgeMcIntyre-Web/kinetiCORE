import type { Route as RouteModel, RouteType } from '../routing/core/types';

const METERS_TO_FEET = 3.28084;

interface BomLine {
  routeType: RouteType;
  size: string;
  material: string;
  lengthFeet: number;
  elbows: number;
  tees: number;
  reducers: number;
  supports: number;
  estimatedCost: number;
}

const COST_FACTORS: Record<RouteType, { perFoot: number; elbow: number; tee: number; reducer: number; support: number }> = {
  pipe: { perFoot: 18, elbow: 22, tee: 48, reducer: 35, support: 14 },
  electrical: { perFoot: 9, elbow: 12, tee: 16, reducer: 0, support: 8 },
  cable_tray: { perFoot: 21, elbow: 26, tee: 30, reducer: 0, support: 18 },
  conduit: { perFoot: 7, elbow: 10, tee: 12, reducer: 0, support: 6 },
};

function formatNumber(value: number): string {
  return value.toFixed(2);
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

function sumLengths(route: RouteModel): number {
  return route.segments.reduce((total, segment) => total + (segment.length ?? 0), 0);
}

function resolveSize(route: RouteModel): string {
  return (
    route.source.specifications.size ||
    route.destination.specifications.size ||
    route.source.specifications.material ||
    route.destination.specifications.material ||
    'N/A'
  );
}

function resolveMaterial(route: RouteModel): string {
  return route.material?.name ?? route.source.specifications.material ?? route.destination.specifications.material ?? 'Unknown';
}

function buildBomLine(route: RouteModel): BomLine {
  const lengthMeters = sumLengths(route);
  const lengthFeet = lengthMeters * METERS_TO_FEET;
  const elbows = route.segments.filter((segment) => segment.segmentType === 'bend').length;
  const tees = route.segments.filter((segment) => segment.segmentType === 'fitting').length;
  const reducers = 0;
  const supports = route.supports.length;

  const costFactors = COST_FACTORS[route.type];
  const estimatedCost =
    lengthFeet * costFactors.perFoot +
    elbows * costFactors.elbow +
    tees * costFactors.tee +
    reducers * costFactors.reducer +
    supports * costFactors.support;

  return {
    routeType: route.type,
    size: resolveSize(route),
    material: resolveMaterial(route),
    lengthFeet,
    elbows,
    tees,
    reducers,
    supports,
    estimatedCost,
  };
}

function serializeLine(line: BomLine): string {
  return [
    line.routeType.replace('_', ' '),
    line.size,
    line.material,
    formatNumber(line.lengthFeet),
    line.elbows,
    line.tees,
    line.reducers,
    line.supports,
    formatCurrency(line.estimatedCost),
  ].join(',');
}

export class BOMExporter {
  exportCSV(routes: RouteModel[]): string {
    const header = 'Route Type,Size,Material,Length (ft),Elbows,Tees,Reducers,Supports,Estimated Cost';
    if (routes.length === 0) {
      return `${header}\nTOTALS,,,0.00,0,0,0,0,$0.00`;
    }

    const lines = routes.map((route) => buildBomLine(route));

    const totals = lines.reduce(
      (acc, line) => {
        acc.lengthFeet += line.lengthFeet;
        acc.elbows += line.elbows;
        acc.tees += line.tees;
        acc.reducers += line.reducers;
        acc.supports += line.supports;
        acc.estimatedCost += line.estimatedCost;
        return acc;
      },
      { lengthFeet: 0, elbows: 0, tees: 0, reducers: 0, supports: 0, estimatedCost: 0 }
    );

    const body = lines.map(serializeLine).join('\n');
    const totalsRow = [
      'TOTALS',
      '',
      '',
      formatNumber(totals.lengthFeet),
      totals.elbows,
      totals.tees,
      totals.reducers,
      totals.supports,
      formatCurrency(totals.estimatedCost),
    ].join(',');

    return [header, body, totalsRow].join('\n');
  }
}

export default BOMExporter;
