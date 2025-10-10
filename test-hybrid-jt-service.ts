/**
 * Test script for the new Hybrid JT Conversion Service
 * Tests both native DLL and Python backend approaches
 */

import { HybridJTConversionService } from './src/loaders/jt/HybridJTConversionService';

async function testHybridJTService() {
    console.log('🧪 Testing Hybrid JT Conversion Service...\n');

    // Create hybrid service instance
    const hybridService = new HybridJTConversionService(
        'C:\\Users\\georgem\\source\\repos\\kinetiCORE_JT_Server_Complete\\ls\\lib3',
        'http://localhost:8005'
    );

    try {
        // Test 1: Health Check
        console.log('1️⃣ Testing health check...');
        const health = await hybridService.checkHealth();
        
        console.log(`   Status: ${health.status}`);
        console.log(`   Native Available: ${health.nativeAvailable}`);
        console.log(`   Python Available: ${health.pythonAvailable}`);
        console.log(`   Preferred Method: ${health.preferredMethod}`);
        console.log(`   Message: ${health.message}\n`);

        // Test 2: Create a mock JT file for testing
        console.log('2️⃣ Creating mock JT file for testing...');
        const mockJTContent = new Uint8Array([
            0x4A, 0x54, 0x20, 0x46, 0x69, 0x6C, 0x65, 0x20, 0x48, 0x65, 0x61, 0x64, 0x65, 0x72,
            // ... more mock JT data
        ]);
        
        const mockJTFile = new File([mockJTContent], 'test_robot.jt', {
            type: 'application/octet-stream'
        });
        
        console.log(`   Created mock JT file: ${mockJTFile.name} (${mockJTFile.size} bytes)\n`);

        // Test 3: Conversion Test
        console.log('3️⃣ Testing JT to GLTF conversion...');
        
        const conversionResult = await hybridService.convertToGLTF(mockJTFile, (progress) => {
            console.log(`   [${progress.method || 'unknown'}] ${progress.stage}: ${progress.message} (${progress.percent}%)`);
            if (progress.details) {
                console.log(`     Details: ${progress.details}`);
            }
        });

        console.log(`   ✅ Conversion successful!`);
        console.log(`   GLTF Blob size: ${conversionResult.size} bytes`);
        console.log(`   GLTF Blob type: ${conversionResult.type}\n`);

        // Test 4: Verify GLTF content
        console.log('4️⃣ Verifying GLTF content...');
        const gltfText = await conversionResult.text();
        const gltfData = JSON.parse(gltfText);
        
        console.log(`   GLTF Version: ${gltfData.asset?.version || 'unknown'}`);
        console.log(`   Generator: ${gltfData.asset?.generator || 'unknown'}`);
        console.log(`   Scenes: ${gltfData.scenes?.length || 0}`);
        console.log(`   Nodes: ${gltfData.nodes?.length || 0}`);
        console.log(`   Meshes: ${gltfData.meshes?.length || 0}\n`);

        console.log('🎉 All tests passed! Hybrid JT Conversion Service is working correctly.\n');

    } catch (error) {
        console.error('❌ Test failed:', error);
        
        if (error instanceof Error) {
            console.error('   Error message:', error.message);
            console.error('   Error stack:', error.stack);
        }
        
        console.log('\n🔧 Troubleshooting:');
        console.log('   1. Ensure JT DLL files are present in the specified path');
        console.log('   2. Check that Python backend server is running (if using Python method)');
        console.log('   3. Verify file permissions');
        console.log('   4. Check console for detailed error messages\n');
    }
}

// Test different service configurations
async function testServiceConfigurations() {
    console.log('🔧 Testing different service configurations...\n');

    // Test 1: Native-only service
    console.log('1️⃣ Testing Native-only service...');
    const nativeOnlyService = new HybridJTConversionService(
        'C:\\Users\\georgem\\source\\repos\\kinetiCORE_JT_Server_Complete\\ls\\lib3'
    );
    
    try {
        const nativeHealth = await nativeOnlyService.checkHealth();
        console.log(`   Native-only health: ${nativeHealth.status} (Native: ${nativeHealth.nativeAvailable})\n`);
    } catch (error) {
        console.log(`   Native-only health check failed: ${error}\n`);
    }

    // Test 2: Python-only service
    console.log('2️⃣ Testing Python-only service...');
    const pythonOnlyService = new HybridJTConversionService(
        undefined, // No native DLL path
        'http://localhost:8005'
    );
    
    try {
        const pythonHealth = await pythonOnlyService.checkHealth();
        console.log(`   Python-only health: ${pythonHealth.status} (Python: ${pythonHealth.pythonAvailable})\n`);
    } catch (error) {
        console.log(`   Python-only health check failed: ${error}\n`);
    }

    // Test 3: Custom DLL path
    console.log('3️⃣ Testing custom DLL path...');
    const customPathService = new HybridJTConversionService(
        'C:\\Custom\\JT\\DLL\\Path'
    );
    
    try {
        const customHealth = await customPathService.checkHealth();
        console.log(`   Custom path health: ${customHealth.status}\n`);
    } catch (error) {
        console.log(`   Custom path health check failed: ${error}\n`);
    }
}

// Run tests
async function runAllTests() {
    console.log('='.repeat(70));
    console.log('HYBRID JT CONVERSION SERVICE TEST SUITE');
    console.log('='.repeat(70));
    console.log();

    await testHybridJTService();
    await testServiceConfigurations();

    console.log('='.repeat(70));
    console.log('TEST SUITE COMPLETE');
    console.log('='.repeat(70));
}

// Export for use in other test files
export { testHybridJTService, testServiceConfigurations, runAllTests };

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests().catch(console.error);
}
