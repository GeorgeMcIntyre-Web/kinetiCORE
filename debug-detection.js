// Debug script to test up-axis detection logic
// This can be run in the browser console

// Test the detection logic with mock data
function testDetectionLogic() {
    console.log('🧪 Testing Up-Axis Detection Logic');
    console.log('===================================');
    
    // Test case 1: Clear Y-up case
    console.log('\n--- Test Case 1: Clear Y-up ---');
    const yUpCase = {
        pca: { detected: 'Y', confidence: 0.9 },
        aabb: { detected: 'Y', confidence: 0.85 },
        normals: { detected: 'Y', confidence: 0.7 },
        extents: { y: 10, z: 2 }
    };
    
    console.log('PCA:', yUpCase.pca);
    console.log('AABB:', yUpCase.aabb);
    console.log('Normals:', yUpCase.normals);
    console.log('Extents:', yUpCase.extents);
    
    // Test case 2: Clear Z-up case
    console.log('\n--- Test Case 2: Clear Z-up ---');
    const zUpCase = {
        pca: { detected: 'Z', confidence: 0.9 },
        aabb: { detected: 'Z', confidence: 0.85 },
        normals: { detected: 'Z', confidence: 0.7 },
        extents: { y: 2, z: 10 }
    };
    
    console.log('PCA:', zUpCase.pca);
    console.log('AABB:', zUpCase.aabb);
    console.log('Normals:', zUpCase.normals);
    console.log('Extents:', zUpCase.extents);
    
    // Test case 3: Ambiguous case
    console.log('\n--- Test Case 3: Ambiguous ---');
    const ambiguousCase = {
        pca: { detected: 'Y', confidence: 0.6 },
        aabb: { detected: 'Z', confidence: 0.6 },
        normals: { detected: 'Y', confidence: 0.5 },
        extents: { y: 5, z: 5.5 }
    };
    
    console.log('PCA:', ambiguousCase.pca);
    console.log('AABB:', ambiguousCase.aabb);
    console.log('Normals:', ambiguousCase.normals);
    console.log('Extents:', ambiguousCase.extents);
    
    // Test case 4: Strong PCA/AABB agreement
    console.log('\n--- Test Case 4: Strong PCA/AABB Agreement ---');
    const strongAgreementCase = {
        pca: { detected: 'Z', confidence: 0.9 },
        aabb: { detected: 'Z', confidence: 0.9 },
        normals: { detected: 'Y', confidence: 0.4 },
        extents: { y: 3, z: 8 }
    };
    
    console.log('PCA:', strongAgreementCase.pca);
    console.log('AABB:', strongAgreementCase.aabb);
    console.log('Normals:', strongAgreementCase.normals);
    console.log('Extents:', strongAgreementCase.extents);
    
    console.log('\n✅ Test cases defined. Use these to verify the detection logic.');
}

// Test confidence thresholds
function testConfidenceThresholds() {
    console.log('🎯 Testing Confidence Thresholds');
    console.log('=================================');
    
    const thresholds = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    
    thresholds.forEach(threshold => {
        console.log(`\nThreshold: ${threshold * 100}%`);
        
        // Test with different confidence levels
        const testCases = [
            { confidence: 0.2, expected: 'Y (default)' },
            { confidence: 0.4, expected: threshold <= 0.4 ? 'detected' : 'Y (default)' },
            { confidence: 0.6, expected: threshold <= 0.6 ? 'detected' : 'Y (default)' },
            { confidence: 0.8, expected: 'detected' }
        ];
        
        testCases.forEach(testCase => {
            const result = testCase.confidence >= threshold ? 'detected' : 'Y (default)';
            const correct = result === testCase.expected;
            console.log(`  Confidence ${testCase.confidence * 100}%: ${result} ${correct ? '✅' : '❌'}`);
        });
    });
}

// Test decision rules
function testDecisionRules() {
    console.log('📋 Testing Decision Rules');
    console.log('=========================');
    
    const rules = [
        {
            name: 'Strong PCA/AABB Agreement',
            condition: 'pca.detected === aabb.detected && pca.confidence > 0.8 && aabb.confidence > 0.8',
            test: { pca: { detected: 'Z', confidence: 0.9 }, aabb: { detected: 'Z', confidence: 0.85 } },
            expected: 'Z-up'
        },
        {
            name: 'High-confidence normals',
            condition: 'nv.confidence > 0.6',
            test: { normals: { detected: 'Y', confidence: 0.7 } },
            expected: 'Y-up'
        },
        {
            name: 'Ambiguous geometry + normals',
            condition: 'isAmbiguous && nv.confidence >= 0.45',
            test: { normals: { detected: 'Z', confidence: 0.5 }, extents: { y: 5, z: 5.2 } },
            expected: 'Z-up'
        },
        {
            name: 'Majority vote (2 out of 3)',
            condition: 'yVotes.length >= 2 || zVotes.length >= 2',
            test: { pca: { detected: 'Y', confidence: 0.6 }, aabb: { detected: 'Y', confidence: 0.5 }, normals: { detected: 'Z', confidence: 0.4 } },
            expected: 'Y-up'
        }
    ];
    
    rules.forEach(rule => {
        console.log(`\n${rule.name}:`);
        console.log(`  Condition: ${rule.condition}`);
        console.log(`  Test data:`, rule.test);
        console.log(`  Expected: ${rule.expected}`);
    });
}

// Make functions available globally
window.testDetectionLogic = testDetectionLogic;
window.testConfidenceThresholds = testConfidenceThresholds;
window.testDecisionRules = testDecisionRules;

console.log('🔧 Debug functions available:');
console.log('  - testDetectionLogic() - Test detection logic with mock data');
console.log('  - testConfidenceThresholds() - Test confidence thresholds');
console.log('  - testDecisionRules() - Test decision rules');
console.log('\nRun these functions to debug the detection logic.');
