/**
 * Test the Real JT Conversion Service
 * Tests actual JT file reading using the JtReader.dll
 */

import { RealJTConversionService } from './src/loaders/jt/RealJTConversionService';

async function testRealJTService() {
    console.log('🧪 Testing Real JT Conversion Service...\n');

    // Create real JT service instance
    const realService = new RealJTConversionService(
        'C:\\Users\\georgem\\source\\repos\\kinetiCORE_JT_Server_Complete\\ls\\lib3'
    );

    try {
        // Test 1: Health Check
        console.log('1️⃣ Testing health check...');
        const health = await realService.checkHealth();
        
        console.log(`   Status: ${health.status}`);
        console.log(`   DLL Files Available: ${health.dllFilesAvailable}`);
        console.log(`   JT Reader Version: ${health.jtReaderVersion || 'Unknown'}`);
        console.log(`   Message: ${health.message}\n`);

        if (health.status !== 'healthy') {
            console.log('⚠️ Real JT service not healthy, skipping conversion test');
            return;
        }

        // Test 2: Create a mock JT file for testing
        console.log('2️⃣ Creating mock JT file for testing...');
        
        // Create a simple JT file header (simplified)
        const mockJTHeader = new Uint8Array([
            0x4A, 0x54, 0x20, 0x46, 0x69, 0x6C, 0x65, 0x20, 0x48, 0x65, 0x61, 0x64, 0x65, 0x72,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        ]);
        
        const mockJTFile = new File([mockJTHeader], 'test_robot.jt', {
            type: 'application/octet-stream'
        });
        
        console.log(`   Created mock JT file: ${mockJTFile.name} (${mockJTFile.size} bytes)\n`);

        // Test 3: Conversion Test
        console.log('3️⃣ Testing JT to GLTF conversion...');
        
        const conversionResult = await realService.convertToGLTF(mockJTFile, (progress) => {
            console.log(`   [${progress.stage}] ${progress.message} (${progress.percent}%)`);
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
        console.log(`   Meshes: ${gltfData.meshes?.length || 0}`);
        console.log(`   Materials: ${gltfData.materials?.length || 0}`);
        console.log(`   Accessors: ${gltfData.accessors?.length || 0}`);
        console.log(`   Buffer Views: ${gltfData.bufferViews?.length || 0}`);
        console.log(`   Buffers: ${gltfData.buffers?.length || 0}\n`);

        // Test 5: Check geometry data
        if (gltfData.accessors && gltfData.accessors.length > 0) {
            const positionAccessor = gltfData.accessors[0];
            console.log(`   Position Accessor:`);
            console.log(`     Count: ${positionAccessor.count} vertices`);
            console.log(`     Type: ${positionAccessor.type}`);
            console.log(`     Component Type: ${positionAccessor.componentType}`);
            if (positionAccessor.min && positionAccessor.max) {
                console.log(`     Bounds: [${positionAccessor.min.join(', ')}] to [${positionAccessor.max.join(', ')}]`);
            }
        }

        console.log('\n🎉 Real JT Conversion Service test completed successfully!\n');

    } catch (error) {
        console.error('❌ Test failed:', error);
        
        if (error instanceof Error) {
            console.error('   Error message:', error.message);
            console.error('   Error stack:', error.stack);
        }
        
        console.log('\n🔧 Troubleshooting:');
        console.log('   1. Ensure JT DLL files are present in the specified path');
        console.log('   2. Check that JtReader.dll is accessible');
        console.log('   3. Verify file permissions');
        console.log('   4. Check console for detailed error messages\n');
    } finally {
        // Cleanup
        realService.dispose();
    }
}

// Test different service configurations
async function testServiceComparison() {
    console.log('🔧 Testing service comparison...\n');

    // Test Real JT Service
    console.log('1️⃣ Real JT Service:');
    const realService = new RealJTConversionService();
    try {
        const realHealth = await realService.checkHealth();
        console.log(`   Status: ${realHealth.status}`);
        console.log(`   DLL Available: ${realHealth.dllFilesAvailable}`);
        console.log(`   Version: ${realHealth.jtReaderVersion || 'Unknown'}`);
    } catch (error) {
        console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
        realService.dispose();
    }

    console.log();

    // Test Hybrid Service
    console.log('2️⃣ Hybrid Service:');
    const { HybridJTConversionService } = await import('./src/loaders/jt/HybridJTConversionService');
    const hybridService = new HybridJTConversionService();
    try {
        const hybridHealth = await hybridService.checkHealth();
        console.log(`   Status: ${hybridHealth.status}`);
        console.log(`   Native Available: ${hybridHealth.nativeAvailable}`);
        console.log(`   Python Available: ${hybridHealth.pythonAvailable}`);
        console.log(`   Preferred Method: ${hybridHealth.preferredMethod}`);
    } catch (error) {
        console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    console.log();
}

// Run tests
async function runAllTests() {
    console.log('='.repeat(70));
    console.log('REAL JT CONVERSION SERVICE TEST SUITE');
    console.log('='.repeat(70));
    console.log();

    await testRealJTService();
    await testServiceComparison();

    console.log('='.repeat(70));
    console.log('TEST SUITE COMPLETE');
    console.log('='.repeat(70));
}

// Export for use in other test files
export { testRealJTService, testServiceComparison, runAllTests };

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllTests().catch(console.error);
}
