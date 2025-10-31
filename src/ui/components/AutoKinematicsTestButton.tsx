/**
 * Auto Kinematics Test Button
 *
 * One-click button to run complete auto kinematics pipeline test.
 *
 * Owner: George (Claude Code Agent 1)
 */

import React, { useState } from 'react';
import { Play, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { runAutoKinematicsFullTest } from '../../babylon/pipeline/AutoKinematicsFullPipelineTest';

export const AutoKinematicsTestButton: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null);
  const [message, setMessage] = useState<string>('');

  const handleRunTest = async () => {
    setIsRunning(true);
    setTestResult(null);
    setMessage('Running full pipeline test...');

    try {
      console.log('[AutoKinematicsTestButton] Starting full test...');
      const report = await runAutoKinematicsFullTest();

      if (report.overallSuccess) {
        setTestResult('pass');
        setMessage(`✅ ALL TESTS PASSED (${report.summary.stagesPassed}/${report.stages.length} stages)`);
      } else {
        setTestResult('fail');
        setMessage(`❌ TESTS FAILED (${report.summary.stagesFailed} failures, ${report.summary.totalErrors} errors)`);
      }

      console.log('[AutoKinematicsTestButton] Test complete:', report);
    } catch (error) {
      setTestResult('fail');
      setMessage(`❌ FATAL ERROR: ${error}`);
      console.error('[AutoKinematicsTestButton] Test error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-4 border border-gray-700 rounded-lg bg-gray-800">
      <h3 className="text-sm font-semibold text-cyan-400">Auto Kinematics Pipeline Test</h3>
      <p className="text-xs text-gray-400">
        One-click comprehensive test for 9X_110_GEO.glb workflow
      </p>

      <button
        onClick={handleRunTest}
        disabled={isRunning}
        className={`
          flex items-center justify-center gap-2 px-4 py-2 rounded
          ${isRunning
            ? 'bg-gray-600 cursor-not-allowed'
            : 'bg-cyan-600 hover:bg-cyan-500'
          }
          text-white text-sm font-medium transition-colors
        `}
      >
        {isRunning ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Running Test...
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            Run Full Test
          </>
        )}
      </button>

      {message && (
        <div className={`
          flex items-start gap-2 p-3 rounded text-sm
          ${testResult === 'pass' ? 'bg-green-900/30 text-green-300' : ''}
          ${testResult === 'fail' ? 'bg-red-900/30 text-red-300' : ''}
          ${!testResult ? 'bg-blue-900/30 text-blue-300' : ''}
        `}>
          {testResult === 'pass' && <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
          {testResult === 'fail' && <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
          {!testResult && <Loader2 className="w-4 h-4 flex-shrink-0 mt-0.5 animate-spin" />}
          <span className="whitespace-pre-line">{message}</span>
        </div>
      )}

      {testResult && (
        <div className="text-xs text-gray-400 mt-2">
          Check browser console for detailed test report and exported JSON file in downloads.
        </div>
      )}
    </div>
  );
};
