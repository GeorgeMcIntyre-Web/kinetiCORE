// Route Statistics Dashboard - Aggregate route statistics and reporting
// Owner: Routing System Team

import React, { useState, useEffect, useMemo } from 'react';
import { useRoutingStore } from '../../ui/store/routingStore';
import { Route } from '../core/Route';
import { RouteType, ValidationResult } from '../core/types';
import { ConstraintValidator } from '../pathfinding/ConstraintValidator';
import {
  BarChart3,
  PieChart,
  Download,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Route as RouteIcon,
  Package,
  Zap,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import './RouteStatsPanel.css';

const ROUTE_TYPE_ICONS: Record<RouteType, React.ReactNode> = {
  pipe: <Package size={18} />,
  electrical: <Zap size={18} />,
  cable_tray: <Layers size={18} />,
  conduit: <RouteIcon size={18} />,
};

const ROUTE_TYPE_COLORS: Record<RouteType, string> = {
  pipe: '#00D9FF', // Cyan
  electrical: '#FFD700', // Gold
  cable_tray: '#FF8C00', // Orange
  conduit: '#00FF00', // Green
};

const ROUTE_TYPE_NAMES: Record<RouteType, string> = {
  pipe: 'Pipe',
  electrical: 'Electrical',
  cable_tray: 'Cable Tray',
  conduit: 'Conduit',
};

interface RouteStatistics {
  totalRoutes: number;
  routesByType: Record<RouteType, number>;
  totalLengthByType: Record<RouteType, number>;
  totalCost: number;
  connectionPointsCount: number;
  validationSummary: {
    valid: number;
    warnings: number;
    errors: number;
  };
  longestRoutes: Array<{ route: Route; length: number }>;
  shortestRoutes: Array<{ route: Route; length: number }>;
  routesWithWarnings: Array<{ route: Route; validation: ValidationResult }>;
}

interface RouteStatsPanelProps {
  className?: string;
}

export const RouteStatsPanel: React.FC<RouteStatsPanelProps> = ({ className }) => {
  const activeRoutes = useRoutingStore((state) => state.activeRoutes);
  const connectionPoints = useRoutingStore((state) => state.connectionPoints);
  const [isExpanded, setIsExpanded] = useState(true);
  const [previousRouteCount, setPreviousRouteCount] = useState(0);
  const [highlightNewRoutes, setHighlightNewRoutes] = useState(false);

  const validator = useMemo(() => new ConstraintValidator(), []);

  // Calculate statistics
  const statistics = useMemo<RouteStatistics>(() => {
    const stats: RouteStatistics = {
      totalRoutes: activeRoutes.length,
      routesByType: {
        pipe: 0,
        electrical: 0,
        cable_tray: 0,
        conduit: 0,
      },
      totalLengthByType: {
        pipe: 0,
        electrical: 0,
        cable_tray: 0,
        conduit: 0,
      },
      totalCost: 0,
      connectionPointsCount: connectionPoints.length,
      validationSummary: {
        valid: 0,
        warnings: 0,
        errors: 0,
      },
      longestRoutes: [],
      shortestRoutes: [],
      routesWithWarnings: [],
    };

    // Process each route
    const routesWithLengths = activeRoutes.map((route) => {
      const length = route.getTotalLength();
      const type = route.type;

      // Update counts
      stats.routesByType[type]++;

      // Update lengths (convert mm to meters)
      stats.totalLengthByType[type] += length / 1000;

      // Validate route
      const validation = validator.validateRoute(route, []); // Pass obstacles if available

      // Update validation summary
      if (validation.isValid) {
        stats.validationSummary.valid++;
      } else {
        const hasErrors = validation.violations.some((v) => v.severity === 'error');
        const hasWarnings = validation.violations.some((v) => v.severity === 'warning');
        if (hasErrors) {
          stats.validationSummary.errors++;
        }
        if (hasWarnings) {
          stats.validationSummary.warnings++;
        }
        stats.routesWithWarnings.push({ route, validation });
      }

      // Estimate cost (if material specs include cost per meter)
      // For now, use a simple estimate based on type and length
      const costPerMeter: Record<RouteType, number> = {
        pipe: 25, // $25/m for pipes
        electrical: 15, // $15/m for electrical
        cable_tray: 40, // $40/m for cable tray
        conduit: 20, // $20/m for conduit
      };
      stats.totalCost += length * costPerMeter[type];

      return { route, length, validation };
    });

    // Find longest and shortest routes
    routesWithLengths.sort((a, b) => b.length - a.length);
    stats.longestRoutes = routesWithLengths.slice(0, 5).map((r) => ({
      route: r.route,
      length: r.length,
    }));
    stats.shortestRoutes = routesWithLengths.slice(-5).reverse().map((r) => ({
      route: r.route,
      length: r.length,
    }));

    return stats;
  }, [activeRoutes, connectionPoints.length, validator]);

  // Detect new routes for animation
  useEffect(() => {
    if (activeRoutes.length > previousRouteCount) {
      setHighlightNewRoutes(true);
      setTimeout(() => setHighlightNewRoutes(false), 2000);
    }
    setPreviousRouteCount(activeRoutes.length);
  }, [activeRoutes.length, previousRouteCount]);

  // Export to CSV
  const exportToCSV = () => {
    const rows: string[] = [];
    
    // Header
    rows.push('Route Statistics Report');
    rows.push(`Generated: ${new Date().toLocaleString()}`);
    rows.push('');

    // Summary
    rows.push('Summary');
    rows.push(`Total Routes,${statistics.totalRoutes}`);
    rows.push(`Total Connection Points,${statistics.connectionPointsCount}`);
    rows.push(`Total Cost Estimate,$${statistics.totalCost.toFixed(2)}`);
    rows.push('');

    // Routes by type
    rows.push('Routes by Type');
    rows.push('Type,Count,Total Length (m)');
    (Object.keys(statistics.routesByType) as RouteType[]).forEach((type) => {
      rows.push(
        `${ROUTE_TYPE_NAMES[type]},${statistics.routesByType[type]},${statistics.totalLengthByType[type].toFixed(2)}`
      );
    });
    rows.push('');

    // Validation summary
    rows.push('Validation Summary');
    rows.push(`Valid Routes,${statistics.validationSummary.valid}`);
    rows.push(`Routes with Warnings,${statistics.validationSummary.warnings}`);
    rows.push(`Routes with Errors,${statistics.validationSummary.errors}`);
    rows.push('');

    // Route details
    rows.push('Route Details');
    rows.push('ID,Type,Length (m),Status,Source,Destination');
    activeRoutes.forEach((route) => {
      const validation = validator.validateRoute(route, []);
      const status = validation.isValid
        ? 'Valid'
        : validation.violations.some((v) => v.severity === 'error')
          ? 'Error'
          : 'Warning';
      rows.push(
        `${route.getId()},${ROUTE_TYPE_NAMES[route.type]},${(route.getTotalLength() / 1000).toFixed(2)},${status},${route.source.getId()},${route.destination.getId()}`
      );
    });

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `route-statistics-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export to PDF (using jsPDF if available, otherwise fallback)
  const exportToPDF = async () => {
    try {
      // Dynamic import of jsPDF
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF();

      // Title
      pdf.setFontSize(18);
      pdf.text('Route Statistics Report', 14, 20);

      // Date
      pdf.setFontSize(10);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

      let yPos = 40;

      // Summary
      pdf.setFontSize(14);
      pdf.text('Summary', 14, yPos);
      yPos += 10;
      pdf.setFontSize(10);
      pdf.text(`Total Routes: ${statistics.totalRoutes}`, 20, yPos);
      yPos += 7;
      pdf.text(`Total Connection Points: ${statistics.connectionPointsCount}`, 20, yPos);
      yPos += 7;
      pdf.text(`Total Cost Estimate: $${statistics.totalCost.toFixed(2)}`, 20, yPos);
      yPos += 15;

      // Routes by type
      pdf.setFontSize(14);
      pdf.text('Routes by Type', 14, yPos);
      yPos += 10;
      pdf.setFontSize(10);
      (Object.keys(statistics.routesByType) as RouteType[]).forEach((type) => {
        pdf.text(
          `${ROUTE_TYPE_NAMES[type]}: ${statistics.routesByType[type]} (${statistics.totalLengthByType[type].toFixed(2)}m)`,
          20,
          yPos
        );
        yPos += 7;
      });
      yPos += 5;

      // Validation summary
      pdf.setFontSize(14);
      pdf.text('Validation Summary', 14, yPos);
      yPos += 10;
      pdf.setFontSize(10);
      pdf.text(`Valid: ${statistics.validationSummary.valid}`, 20, yPos);
      yPos += 7;
      pdf.text(`Warnings: ${statistics.validationSummary.warnings}`, 20, yPos);
      yPos += 7;
      pdf.text(`Errors: ${statistics.validationSummary.errors}`, 20, yPos);

      // Save
      pdf.save(`route-statistics-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Failed to export PDF:', error);
      alert('PDF export requires jsPDF library. Please install it or use CSV export.');
    }
  };

  // Chart data
  const barChartData = (Object.keys(statistics.totalLengthByType) as RouteType[]).map((type) => ({
    type,
    value: statistics.totalLengthByType[type],
  }));

  const pieChartData = (Object.keys(statistics.routesByType) as RouteType[]).map((type) => ({
    type,
    count: statistics.routesByType[type],
  }));

  const maxBarValue = Math.max(...barChartData.map((d) => d.value), 1);

  return (
    <div className={`route-stats-panel ${className || ''} ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="route-stats-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="route-stats-title">
          <BarChart3 size={18} />
          <span>Route Statistics</span>
        </div>
        <button className="route-stats-toggle">
          {isExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
      </div>

      {isExpanded && (
        <div className="route-stats-content">
          {/* Summary Cards */}
          <div className="route-stats-summary">
            {(Object.keys(statistics.routesByType) as RouteType[]).map((type) => (
              <div
                key={type}
                className={`route-stat-card ${highlightNewRoutes && statistics.routesByType[type] > 0 ? 'highlight' : ''}`}
                style={{ borderColor: ROUTE_TYPE_COLORS[type] }}
              >
                <div className="route-stat-icon" style={{ color: ROUTE_TYPE_COLORS[type] }}>
                  {ROUTE_TYPE_ICONS[type]}
                </div>
                <div className="route-stat-info">
                  <div className="route-stat-label">{ROUTE_TYPE_NAMES[type]}</div>
                  <div className="route-stat-value">{statistics.routesByType[type]}</div>
                  <div className="route-stat-subvalue">
                    {statistics.totalLengthByType[type].toFixed(2)}m
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Total Cost & Connection Points */}
          <div className="route-stats-meta">
            <div className="route-stat-meta-item">
              <TrendingUp size={16} />
              <span>Total Cost:</span>
              <strong>${statistics.totalCost.toFixed(2)}</strong>
            </div>
            <div className="route-stat-meta-item">
              <RouteIcon size={16} />
              <span>Connection Points:</span>
              <strong>{statistics.connectionPointsCount}</strong>
            </div>
          </div>

          {/* Validation Status */}
          <div className="route-stats-validation">
            <div className="route-validation-item valid">
              <CheckCircle2 size={16} />
              <span>{statistics.validationSummary.valid}</span>
            </div>
            <div className="route-validation-item warning">
              <AlertTriangle size={16} />
              <span>{statistics.validationSummary.warnings}</span>
            </div>
            <div className="route-validation-item error">
              <XCircle size={16} />
              <span>{statistics.validationSummary.errors}</span>
            </div>
          </div>

          {/* Charts Section */}
          <div className="route-stats-charts">
            {/* Bar Chart - Length by Type */}
            <div className="route-chart-container">
              <div className="route-chart-header">
                <BarChart3 size={16} />
                <span>Length by Type</span>
              </div>
              <div className="route-bar-chart">
                {barChartData.map((data) => (
                  <div key={data.type} className="route-bar-item">
                    <div className="route-bar-label">{ROUTE_TYPE_NAMES[data.type]}</div>
                    <div className="route-bar-track">
                      <div
                        className="route-bar-fill"
                        style={{
                          width: `${(data.value / maxBarValue) * 100}%`,
                          backgroundColor: ROUTE_TYPE_COLORS[data.type],
                        }}
                      >
                        <span className="route-bar-value">{(data.value / 1000).toFixed(2)}m</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pie Chart - Route Distribution */}
            <div className="route-chart-container">
              <div className="route-chart-header">
                <PieChart size={16} />
                <span>Route Distribution</span>
              </div>
              <div className="route-pie-chart">
                {statistics.totalRoutes > 0 ? (
                  <div className="route-pie-wrapper">
                    <svg className="route-pie-svg" viewBox="0 0 100 100">
                      {(() => {
                        let currentAngle = -90; // Start at top
                        const radius = 40;
                        const centerX = 50;
                        const centerY = 50;

                        return pieChartData.map((data) => {
                          if (data.count === 0) return null;

                          const total = statistics.totalRoutes;
                          const angle = (data.count / total) * 360;

                          const startAngleRad = (currentAngle * Math.PI) / 180;
                          const endAngleRad = ((currentAngle + angle) * Math.PI) / 180;

                          const x1 = centerX + radius * Math.cos(startAngleRad);
                          const y1 = centerY + radius * Math.sin(startAngleRad);
                          const x2 = centerX + radius * Math.cos(endAngleRad);
                          const y2 = centerY + radius * Math.sin(endAngleRad);

                          const largeArcFlag = angle > 180 ? 1 : 0;

                          const pathData = [
                            `M ${centerX} ${centerY}`,
                            `L ${x1} ${y1}`,
                            `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                            'Z',
                          ].join(' ');

                          const segment = (
                            <path
                              key={data.type}
                              d={pathData}
                              fill={ROUTE_TYPE_COLORS[data.type]}
                              stroke="rgba(0, 0, 0, 0.3)"
                              strokeWidth="0.5"
                            />
                          );

                          currentAngle += angle;
                          return segment;
                        });
                      })()}
                    </svg>
                    <div className="route-pie-labels">
                      {pieChartData
                        .filter((data) => data.count > 0)
                        .map((data) => {
                          const total = statistics.totalRoutes || 1;
                          const percentage = (data.count / total) * 100;
                          return (
                            <div key={data.type} className="route-pie-label-item">
                              <div
                                className="route-pie-legend-color"
                                style={{ backgroundColor: ROUTE_TYPE_COLORS[data.type] }}
                              />
                              <span className="route-pie-label-text">
                                {ROUTE_TYPE_ICONS[data.type]}
                                {ROUTE_TYPE_NAMES[data.type]}: {data.count} ({percentage.toFixed(0)}%)
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ) : (
                  <div className="route-pie-empty">No routes to display</div>
                )}
              </div>
            </div>
          </div>

          {/* Lists */}
          <div className="route-stats-lists">
            {/* Longest Routes */}
            {statistics.longestRoutes.length > 0 && (
              <div className="route-list-container">
                <div className="route-list-header">Longest Routes</div>
                <div className="route-list">
                  {statistics.longestRoutes.map((item) => (
                    <div key={item.route.getId()} className="route-list-item">
                      <span className="route-list-id">{item.route.getId().slice(0, 8)}...</span>
                      <span className="route-list-length">{(item.length / 1000).toFixed(2)}m</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Shortest Routes */}
            {statistics.shortestRoutes.length > 0 && (
              <div className="route-list-container">
                <div className="route-list-header">Shortest Routes</div>
                <div className="route-list">
                  {statistics.shortestRoutes.map((item) => (
                    <div key={item.route.getId()} className="route-list-item">
                      <span className="route-list-id">{item.route.getId().slice(0, 8)}...</span>
                      <span className="route-list-length">{(item.length / 1000).toFixed(2)}m</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Routes with Warnings */}
            {statistics.routesWithWarnings.length > 0 && (
              <div className="route-list-container">
                <div className="route-list-header">Routes with Warnings</div>
                <div className="route-list">
                  {statistics.routesWithWarnings.slice(0, 10).map((item) => (
                    <div key={item.route.getId()} className="route-list-item warning">
                      <span className="route-list-id">{item.route.getId().slice(0, 8)}...</span>
                      <span className="route-list-warnings">
                        {item.validation.violations.length} issue{item.validation.violations.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Export Buttons */}
          <div className="route-stats-export">
            <button className="route-export-btn" onClick={exportToCSV}>
              <Download size={16} />
              <span>Export CSV</span>
            </button>
            <button className="route-export-btn" onClick={exportToPDF}>
              <FileText size={16} />
              <span>Export PDF</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

