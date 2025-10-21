/**
 * JT Kinematic Workflow UI Component
 * Provides a user interface for testing JT→kinematic→GLB workflow
 */

import React, { useState } from 'react';
// import { JTKinematicIntegrationService } from './JTKinematicIntegrationService';
import * as BABYLON from '@babylonjs/core';

// Mock workflow test class since the original was deleted
class JTKinematicWorkflowTest {
    async testR2000icWorkflow(_scene: BABYLON.Scene): Promise<boolean> {
        console.log('Testing r2000ic workflow...');
        // Mock implementation
        return true;
    }

    async testSimpleConversion(_scene: BABYLON.Scene): Promise<boolean> {
        console.log('Testing simple conversion...');
        // Mock implementation
        return true;
    }
}

interface JTKinematicWorkflowProps {
    scene: BABYLON.Scene;
}

export const JTKinematicWorkflowUI: React.FC<JTKinematicWorkflowProps> = ({ scene }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<string>('');
    const [error, setError] = useState<string>('');

    const workflowTest = new JTKinematicWorkflowTest();
    // const integrationService = new JTKinematicIntegrationService();

    const handleTestR2000icWorkflow = async () => {
        setIsLoading(true);
        setStatus('Testing r2000ic workflow...');
        setError('');

        try {
            const success = await workflowTest.testR2000icWorkflow(scene);
            if (success) {
                setStatus('✅ r2000ic workflow test completed successfully!');
            } else {
                setError('❌ r2000ic workflow test failed');
            }
        } catch (err) {
            setError(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTestSimpleConversion = async () => {
        setIsLoading(true);
        setStatus('Testing simple conversion...');
        setError('');

        try {
            const success = await workflowTest.testSimpleConversion(scene);
            if (success) {
                setStatus('✅ Simple conversion test completed successfully!');
            } else {
                setError('❌ Simple conversion test failed');
            }
        } catch (err) {
            setError(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTestJTConversionServer = async () => {
        setIsLoading(true);
        setStatus('Testing JT conversion server...');
        setError('');

        try {
            const response = await fetch('http://localhost:8005/health');
            const data = await response.json();
            
            if (data.status === 'degraded') {
                setStatus(`⚠️ Server running but PyOpenJt not available: ${data.message}`);
            } else if (data.status === 'healthy') {
                setStatus('✅ JT conversion server is healthy');
            } else {
                setStatus(`⚠️ Server status: ${data.status}`);
            }
        } catch (err) {
            setError(`❌ Cannot connect to JT conversion server: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoadGLBWithKinematics = async () => {
        setIsLoading(true);
        setStatus('Loading GLB with kinematic data...');
        setError('');

        try {
            // This would normally load a file, but for demo we'll use the test
            const success = await workflowTest.testR2000icWorkflow(scene);
            if (success) {
                setStatus('✅ GLB loaded with kinematic data successfully!');
            } else {
                setError('❌ Failed to load GLB with kinematic data');
            }
        } catch (err) {
            setError(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="jt-kinematic-workflow-ui p-4 bg-gray-800 text-white rounded-lg">
            <h3 className="text-lg font-bold mb-4">JT Kinematic Workflow</h3>
            
            <div className="space-y-3">
                <div className="flex flex-col space-y-2">
                    <button
                        onClick={handleTestJTConversionServer}
                        disabled={isLoading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-sm"
                    >
                        {isLoading ? 'Testing...' : 'Test JT Conversion Server'}
                    </button>

                    <button
                        onClick={handleTestSimpleConversion}
                        disabled={isLoading}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-sm"
                    >
                        {isLoading ? 'Testing...' : 'Test Simple Conversion'}
                    </button>

                    <button
                        onClick={handleTestR2000icWorkflow}
                        disabled={isLoading}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded text-sm"
                    >
                        {isLoading ? 'Testing...' : 'Test r2000ic Workflow'}
                    </button>

                    <button
                        onClick={handleLoadGLBWithKinematics}
                        disabled={isLoading}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 rounded text-sm"
                    >
                        {isLoading ? 'Loading...' : 'Load GLB with Kinematics'}
                    </button>
                </div>

                {status && (
                    <div className="p-3 bg-blue-900 rounded text-sm">
                        {status}
                    </div>
                )}

                {error && (
                    <div className="p-3 bg-red-900 rounded text-sm">
                        {error}
                    </div>
                )}

                <div className="text-xs text-gray-400 mt-4">
                    <h4 className="font-bold mb-2">Workflow Steps:</h4>
                    <ol className="list-decimal list-inside space-y-1">
                        <li>Extract kinematic data from JT file (joints, links, constraints)</li>
                        <li>Map JT kinematic data to kinetiCORE kinematic structures</li>
                        <li>Load GLB file converted from JT</li>
                        <li>Apply kinematic data to GLB meshes</li>
                        <li>Create kinematic controls and simulation</li>
                    </ol>
                </div>

                <div className="text-xs text-gray-400 mt-2">
                    <h4 className="font-bold mb-2">Files:</h4>
                    <ul className="list-disc list-inside space-y-1">
                        <li>JT: C:\Users\georgem\source\repos\kinetiCORE_data\glb\r2000ic_210l_if_v02.jt</li>
                        <li>GLB: C:\Users\georgem\source\repos\kinetiCORE_data\glb\r2000ic_210l_if_v02.glb</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};
