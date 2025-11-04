// Route Warnings Panel - Top notification bar for validation issues
// Owner: Routing System Team (Agent 3)

import React from 'react';
import { useRoutingStore } from '../../ui/store/routingStore';
import { EnhancedValidationResult } from '../validation/RouteValidator';
import './RouteWarningsPanel.css';

/**
 * RouteWarningsPanel displays validation warnings/errors at the top of the screen
 * Shows summary and allows expanding to see all issues
 */
export const RouteWarningsPanel: React.FC = () => {
  const validationResults = useRoutingStore((state) => state.validationResults);
  const activeRoutes = useRoutingStore((state) => state.activeRoutes);
  const [expanded, setExpanded] = React.useState(false);

  // Collect all validation issues
  const allViolations: Array<{
    routeId: string;
    routeType: string;
    violation: { message: string; severity: 'error' | 'warning' | 'info'; location: any };
  }> = [];

  validationResults.forEach((result: EnhancedValidationResult, routeId: string) => {
    const route = activeRoutes.find((r) => r.getId() === routeId);
    result.violations.forEach((violation) => {
      allViolations.push({
        routeId,
        routeType: route?.type || 'unknown',
        violation,
      });
    });
  });

  // Deduplicate violations by creating unique key: routeId + message
  // This prevents showing "Clearance 0.00" 4 times for the same route
  const seenKeys = new Set<string>();
  const uniqueViolations = allViolations.filter((item) => {
    const key = `${item.routeId}:${item.violation.message}`;
    if (seenKeys.has(key)) {
      return false; // Skip duplicate
    }
    seenKeys.add(key);
    return true;
  });

  const errorCount = uniqueViolations.filter((v) => v.violation.severity === 'error').length;
  const warningCount = uniqueViolations.filter((v) => v.violation.severity === 'warning').length;

  // Don't show panel if there are no issues
  if (uniqueViolations.length === 0) {
    return null;
  }

  return (
    <div className="route-warnings-panel">
      <div
        className={`warnings-header ${errorCount > 0 ? 'error' : 'warning'}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="warnings-summary">
          {errorCount > 0 && (
            <span className="error-count">
              ✗ {errorCount} {errorCount === 1 ? 'Error' : 'Errors'}
            </span>
          )}
          {warningCount > 0 && (
            <span className="warning-count">
              ⚠ {warningCount} {warningCount === 1 ? 'Warning' : 'Warnings'}
            </span>
          )}
          <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {expanded && (
        <div className="warnings-content">
          <div className="warnings-list">
            {uniqueViolations.map((item, index) => (
              <div
                key={`${item.routeId}-${index}`}
                className={`violation-item ${item.violation.severity}`}
              >
                <div className="violation-header">
                  <span className="violation-icon">
                    {item.violation.severity === 'error' ? '✗' : '⚠'}
                  </span>
                  <span className="route-type">{item.routeType.toUpperCase()}</span>
                  <span className="route-id">{item.routeId.substring(0, 8)}</span>
                </div>
                <div className="violation-message">{item.violation.message}</div>
              </div>
            ))}
          </div>
          {errorCount > 0 && (
            <div className="warnings-actions">
              <button
                className="fix-route-btn"
                onClick={() => {
                  // Could implement auto-fix suggestions
                  console.log('Fix route suggestions:', uniqueViolations);
                }}
              >
                Show Fix Suggestions
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

