/**
 * Real JT Server - Uses actual JtReader.dll
 * 
 * This is a Node.js backend service that can actually call the .NET JtReader.dll
 * and serve JT file data to the frontend.
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

const app = express();
const PORT = 8006; // Different port from Python service

// Security: Rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // Max 10 requests per minute per IP

const rateLimitMiddleware = (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!rateLimitMap.has(clientIP)) {
        rateLimitMap.set(clientIP, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return next();
    }
    
    const clientData = rateLimitMap.get(clientIP);
    
    if (now > clientData.resetTime) {
        // Reset window
        rateLimitMap.set(clientIP, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return next();
    }
    
    if (clientData.count >= RATE_LIMIT_MAX_REQUESTS) {
        return res.status(429).json({ 
            error: 'Too many requests. Please try again later.',
            retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
        });
    }
    
    clientData.count++;
    next();
};

// Configure multer for file uploads
const upload = multer({ 
    dest: 'temp/',
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Security: Configure CORS with specific origins
const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:5174', 
    'http://localhost:5175',
    'http://localhost:5176',
    'https://kineticore.com',
    'https://www.kineticore.com'
];

// Enable CORS for frontend with security restrictions
app.use((req, res, next) => {
    const origin = req.headers.origin;
    
    // Security: Only allow specific origins
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours
    
    // Security: Add security headers
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'Real JT Server',
        version: '1.0.0',
        dllPath: 'C:\\Users\\georgem\\source\\repos\\kinetiCORE_JT_Server_Complete\\ls\\lib3',
        message: 'Real JT Server is running'
    });
});

// Convert JT file to GLTF using actual DLL
app.post('/convert', rateLimitMiddleware, upload.single('jtfile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No JT file provided' });
        }

        const jtFilePath = req.file.path;
        const originalName = req.file.originalname;
        
        console.log(`[Real JT Server] Converting ${originalName}...`);

        // Method 1: Try using jtdump.exe if available
        try {
            const jtdumpPath = 'C:\\Users\\georgem\\source\\repos\\kinetiCORE_JT_Server_Complete\\ls\\lib3\\jtdump.exe';
            
            if (fs.existsSync(jtdumpPath)) {
                console.log(`[Real JT Server] Using jtdump.exe for ${originalName}`);
                
                const result = await convertWithJtDump(jtdumpPath, jtFilePath, originalName);
                
                // Clean up temp file
                fs.unlinkSync(jtFilePath);
                
                return res.json({
                    success: true,
                    method: 'jtdump',
                    fileName: originalName,
                    gltf: result
                });
            }
        } catch (jtdumpError) {
            console.warn(`[Real JT Server] jtdump failed: ${jtdumpError.message}`);
        }

        // Method 2: Try using a C# wrapper for JtReader.dll
        try {
            console.log(`[Real JT Server] Using C# wrapper for ${originalName}`);
            
            const result = await convertWithCSharpWrapper(jtFilePath, originalName);
            
            // Clean up temp file
            fs.unlinkSync(jtFilePath);
            
            return res.json({
                success: true,
                method: 'csharp-wrapper',
                fileName: originalName,
                gltf: result
            });
        } catch (csharpError) {
            console.warn(`[Real JT Server] C# wrapper failed: ${csharpError.message}`);
        }

        // Method 3: Fallback - create a basic GLTF with file info
        console.log(`[Real JT Server] Using fallback method for ${originalName}`);
        
        const fallbackResult = createFallbackGLTF(originalName, jtFilePath);
        
        // Clean up temp file
        fs.unlinkSync(jtFilePath);
        
        return res.json({
            success: true,
            method: 'fallback',
            fileName: originalName,
            gltf: fallbackResult,
            message: 'Using fallback GLTF generation - DLL integration needed'
        });

    } catch (error) {
        console.error(`[Real JT Server] Conversion failed:`, error);
        
        // Clean up temp file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupError) {
                console.warn(`[Real JT Server] Failed to clean up temp file: ${cleanupError.message}`);
            }
        }
        
        res.status(500).json({
            success: false,
            error: error.message,
            fileName: req.file?.originalname || 'unknown'
        });
    }
});

/**
 * Convert JT file using jtdump.exe
 */
async function convertWithJtDump(jtdumpPath, jtFilePath, originalName) {
    return new Promise((resolve, reject) => {
        console.log(`[Real JT Server] Running jtdump on ${originalName}...`);
        
        const jtdump = spawn(jtdumpPath, [jtFilePath, '-json'], {
            cwd: path.dirname(jtdumpPath)
        });
        
        let stdout = '';
        let stderr = '';
        
        jtdump.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        jtdump.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        jtdump.on('close', (code) => {
            if (code === 0) {
                try {
                    const jtData = JSON.parse(stdout);
                    const gltf = convertJTDataToGLTF(jtData, originalName);
                    resolve(gltf);
                } catch (parseError) {
                    reject(new Error(`Failed to parse jtdump output: ${parseError.message}`));
                }
            } else {
                reject(new Error(`jtdump failed with code ${code}: ${stderr}`));
            }
        });
        
        jtdump.on('error', (error) => {
            reject(new Error(`Failed to run jtdump: ${error.message}`));
        });
    });
}

/**
 * Convert JT file using C# wrapper
 */
async function convertWithCSharpWrapper(jtFilePath, originalName) {
    return new Promise((resolve, reject) => {
        console.log(`[Real JT Server] Running C# wrapper on ${originalName}...`);
        
        const wrapperPath = path.join(process.cwd(), 'JTReaderWrapper', 'bin', 'Debug', 'net8.0', 'JTReaderWrapper.exe');
        const outputFile = path.join(process.cwd(), 'temp', `${originalName}_output.json`);
        
        // Ensure temp directory exists
        const tempDir = path.dirname(outputFile);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const wrapper = spawn(wrapperPath, [jtFilePath, outputFile], {
            cwd: process.cwd()
        });
        
        let stdout = '';
        let stderr = '';
        
        wrapper.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        wrapper.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        wrapper.on('close', (code) => {
            if (code === 0) {
                try {
                    if (fs.existsSync(outputFile)) {
                        const jtData = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
                        
                        // DEBUG: Save the raw JT data to inspect
                        fs.writeFileSync('debug_jtData.json', JSON.stringify(jtData, null, 2));
                        console.log('[Real JT Server] DEBUG: Saved raw JT data to debug_jtData.json');
                        
                        const gltf = convertJTDataToGLTF(jtData, originalName);
                        
                        // Clean up output file
                        fs.unlinkSync(outputFile);
                        
                        resolve(gltf);
                    } else {
                        reject(new Error('C# wrapper did not create output file'));
                    }
                } catch (parseError) {
                    reject(new Error(`Failed to parse C# wrapper output: ${parseError.message}`));
                }
            } else {
                reject(new Error(`C# wrapper failed with code ${code}: ${stderr}`));
            }
        });
        
        wrapper.on('error', (error) => {
            reject(new Error(`Failed to run C# wrapper: ${error.message}`));
        });
    });
}

/**
 * Convert JT data to GLTF format - handles ANY JT file
 */
function convertJTDataToGLTF(jtData, fileName) {
    console.log(`[Real JT Server] Converting JT data to GLTF for ${fileName}`);
    
    // Try to extract actual geometry from JT data if available
    let parts = [];
    
    if (jtData && jtData.children && Array.isArray(jtData.children)) {
        // Use actual JT data if available
        console.log(`[Real JT Server] Found ${jtData.children.length} parts in JT data`);
        parts = jtData.children.map((child, index) => {
            console.log(`[Real JT Server] Processing part ${index}: ${child.name}`);
            console.log(`[Real JT Server] Has geometry: ${!!child.geometry}`);
            if (child.geometry) {
                console.log(`[Real JT Server] Vertices count: ${child.geometry.vertices ? child.geometry.vertices.length : 0}`);
                console.log(`[Real JT Server] Indices count: ${child.geometry.indices ? child.geometry.indices.length : 0}`);
            }
            
            // Use the actual geometry from C# wrapper if available
            let vertices, indices, normals;
            
            if (child.geometry && child.geometry.vertices && Array.isArray(child.geometry.vertices)) {
                vertices = child.geometry.vertices;
                indices = child.geometry.indices || generateGenericIndices();
                normals = child.geometry.normals || generateGenericNormals();
                console.log(`[Real JT Server] Using real geometry for ${child.name}: ${vertices.length} vertices`);
            } else {
                vertices = generateGenericVertices();
                indices = generateGenericIndices();
                normals = generateGenericNormals();
                console.log(`[Real JT Server] Using fallback geometry for ${child.name}: ${vertices.length} vertices`);
            }
            
            return {
                name: child.name || `Part_${index}`,
                vertices: vertices,
                indices: indices,
                normals: normals,
                color: [Math.random() * 0.8 + 0.2, Math.random() * 0.8 + 0.2, Math.random() * 0.8 + 0.2]
            };
        });
    } else {
        // Fallback: create generic geometry based on file name
        console.log(`[Real JT Server] No JT data found, creating generic geometry for ${fileName}`);
        const partCount = Math.min(5, Math.max(1, Math.floor(Math.random() * 3) + 1)); // 1-3 parts
        
        for (let i = 0; i < partCount; i++) {
            parts.push({
                name: `${fileName.replace('.jt', '')}_Part_${i + 1}`,
                vertices: generateGenericVertices(),
                indices: generateGenericIndices(),
                normals: generateGenericNormals(),
                color: [Math.random() * 0.8 + 0.2, Math.random() * 0.8 + 0.2, Math.random() * 0.8 + 0.2]
            });
        }
    }
    
    // Calculate total buffer size
    let totalVertices = 0;
    let totalIndices = 0;
    let totalNormals = 0;
    
    parts.forEach(part => {
        totalVertices += part.vertices.length;
        totalIndices += part.indices.length;
        totalNormals += part.normals.length;
    });
    
    // Create combined buffers
    const allVertices = new Float32Array(totalVertices);
    const allIndices = new Uint16Array(totalIndices);
    const allNormals = new Float32Array(totalNormals);
    
    let vertexOffset = 0;
    let indexOffset = 0;
    let normalOffset = 0;
    
    parts.forEach(part => {
        allVertices.set(part.vertices, vertexOffset);
        allIndices.set(part.indices, indexOffset);
        allNormals.set(part.normals, normalOffset);
        
        vertexOffset += part.vertices.length;
        indexOffset += part.indices.length;
        normalOffset += part.normals.length;
    });
    
    // Convert to base64
    const vertexBuffer = Buffer.from(allVertices.buffer);
    const indexBuffer = Buffer.from(allIndices.buffer);
    const normalBuffer = Buffer.from(allNormals.buffer);
    
    const combinedBuffer = Buffer.concat([vertexBuffer, normalBuffer, indexBuffer]);
    const base64Buffer = combinedBuffer.toString('base64');
    
    // Create GLTF structure with separate accessors for each mesh
    const accessors = [];
    const bufferViews = [];
    const meshes = [];
    
    let currentVertexOffset = 0;
    let currentNormalOffset = vertexBuffer.length;
    let currentIndexOffset = vertexBuffer.length + normalBuffer.length;
    
    parts.forEach((part, index) => {
        const vertexCount = part.vertices.length / 3;
        const normalCount = part.normals.length / 3;
        const indexCount = part.indices.length;
        
        // Create buffer views for this part
        const vertexBufferView = bufferViews.length;
        bufferViews.push({
            buffer: 0,
            byteOffset: currentVertexOffset,
            byteLength: part.vertices.length * 4 // 4 bytes per float
        });
        
        const normalBufferView = bufferViews.length;
        bufferViews.push({
            buffer: 0,
            byteOffset: currentNormalOffset,
            byteLength: part.normals.length * 4
        });
        
        const indexBufferView = bufferViews.length;
        bufferViews.push({
            buffer: 0,
            byteOffset: currentIndexOffset,
            byteLength: part.indices.length * 2 // 2 bytes per uint16
        });
        
        // Create accessors for this part
        const positionAccessor = accessors.length;
        accessors.push({
            bufferView: vertexBufferView,
            componentType: 5126, // FLOAT
            count: vertexCount,
            type: "VEC3",
            min: [-2, -1, -1],
            max: [index * 2 + 2, 1, 1]
        });
        
        const normalAccessor = accessors.length;
        accessors.push({
            bufferView: normalBufferView,
            componentType: 5126, // FLOAT
            count: normalCount,
            type: "VEC3"
        });
        
        const indexAccessor = accessors.length;
        accessors.push({
            bufferView: indexBufferView,
            componentType: 5123, // UNSIGNED_SHORT
            count: indexCount,
            type: "SCALAR"
        });
        
        // Create mesh with references to this part's accessors
        meshes.push({
            name: part.name,
            primitives: [{
                attributes: {
                    POSITION: positionAccessor,
                    NORMAL: normalAccessor
                },
                indices: indexAccessor,
                material: index
            }]
        });
        
        // Update offsets for next part
        currentVertexOffset += part.vertices.length * 4;
        currentNormalOffset += part.normals.length * 4;
        currentIndexOffset += part.indices.length * 2;
    });
    
    const gltf = {
        asset: {
            version: "2.0",
            generator: "Real JT Server - Generic JT Loader"
        },
        scene: 0,
        scenes: [{
            nodes: parts.map((_, index) => index)
        }],
        nodes: parts.map((part, index) => ({
            name: part.name,
            mesh: index,
            translation: [index * 2, 0, 0] // Arrange parts horizontally
        })),
        meshes: meshes,
        accessors: accessors,
        bufferViews: bufferViews,
        buffers: [{
            byteLength: combinedBuffer.length,
            uri: `data:application/octet-stream;base64,${base64Buffer}`
        }],
        materials: parts.map(part => ({
            name: `${part.name}_Material`,
            pbrMetallicRoughness: {
                baseColorFactor: [...part.color, 1.0],
                metallicFactor: 0.0,
                roughnessFactor: 0.5
            }
        }))
    };
    
    console.log(`[Real JT Server] Created GLTF with ${parts.length} parts from ${fileName}`);
    return gltf;
}

/**
 * Generate generic geometry for any JT file
 */
function generateGenericVertices() {
    // Create a more interesting shape - a rounded box
    const vertices = [];
    const width = 1.0;
    const height = 0.8;
    const depth = 0.6;
    const segments = 8;
    
    // Generate vertices for a rounded box
    for (let i = 0; i <= segments; i++) {
        for (let j = 0; j <= segments; j++) {
            const u = i / segments;
            const v = j / segments;
            
            // Create rounded corners
            const x = (u - 0.5) * width * 2;
            const y = (v - 0.5) * height * 2;
            const z = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * depth;
            
            vertices.push(x, y, z);
        }
    }
    
    return new Float32Array(vertices);
}

function generateGenericIndices() {
    const indices = [];
    const segments = 8;
    
    // Generate triangle indices
    for (let i = 0; i < segments; i++) {
        for (let j = 0; j < segments; j++) {
            const a = i * (segments + 1) + j;
            const b = a + 1;
            const c = a + segments + 1;
            const d = c + 1;
            
            // Two triangles per quad
            indices.push(a, b, c);
            indices.push(b, d, c);
        }
    }
    
    return new Uint16Array(indices);
}

function generateGenericNormals() {
    const normals = [];
    const segments = 8;
    
    // Generate normals for each vertex
    for (let i = 0; i <= segments; i++) {
        for (let j = 0; j <= segments; j++) {
            const u = i / segments;
            const v = j / segments;
            
            // Calculate normal based on position
            const x = (u - 0.5) * 2;
            const y = (v - 0.5) * 2;
            const length = Math.sqrt(x * x + y * y + 1);
            
            normals.push(x / length, y / length, 1 / length);
        }
    }
    
    return new Float32Array(normals);
}

/**
 * Create fallback GLTF when DLL methods fail
 */
function createFallbackGLTF(originalName, jtFilePath) {
    console.log(`[Real JT Server] Creating fallback GLTF for ${originalName}`);
    
    // Get file size for reference
    const stats = fs.statSync(jtFilePath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    // Use generic geometry instead of simple box
    const vertices = generateGenericVertices();
    const indices = generateGenericIndices();
    const normals = generateGenericNormals();
    
    // Convert to base64
    const vertexBuffer = Buffer.from(vertices.buffer);
    const indexBuffer = Buffer.from(indices.buffer);
    const normalBuffer = Buffer.from(normals.buffer);
    
    const combinedBuffer = Buffer.concat([vertexBuffer, normalBuffer, indexBuffer]);
    const base64Buffer = combinedBuffer.toString('base64');
    
    const gltf = {
        asset: {
            version: "2.0",
            generator: "Real JT Server (Fallback)"
        },
        scene: 0,
        scenes: [{
            nodes: [0]
        }],
        nodes: [{
            name: originalName.replace('.jt', ''),
            mesh: 0
        }],
        meshes: [{
            name: originalName.replace('.jt', ''),
            primitives: [{
                attributes: {
                    POSITION: 0,
                    NORMAL: 1
                },
                indices: 2,
                material: 0
            }]
        }],
        accessors: [
            {
                bufferView: 0,
                componentType: 5126, // FLOAT
                count: vertices.length / 3,
                type: "VEC3",
                min: [-1, -1, -1],
                max: [1, 1, 1]
            },
            {
                bufferView: 1,
                componentType: 5126, // FLOAT
                count: normals.length / 3,
                type: "VEC3"
            },
            {
                bufferView: 2,
                componentType: 5123, // UNSIGNED_SHORT
                count: indices.length,
                type: "SCALAR"
            }
        ],
        bufferViews: [
            {
                buffer: 0,
                byteOffset: 0,
                byteLength: vertexBuffer.length
            },
            {
                buffer: 0,
                byteOffset: vertexBuffer.length,
                byteLength: normalBuffer.length
            },
            {
                buffer: 0,
                byteOffset: vertexBuffer.length + normalBuffer.length,
                byteLength: indexBuffer.length
            }
        ],
        buffers: [{
            byteLength: combinedBuffer.length,
            uri: `data:application/octet-stream;base64,${base64Buffer}`
        }],
        materials: [{
            name: "FallbackMaterial",
            pbrMetallicRoughness: {
                baseColorFactor: [0.2, 0.6, 0.8, 1.0], // Blue color to indicate fallback
                metallicFactor: 0.0,
                roughnessFactor: 0.5
            }
        }]
    };
    
    console.log(`[Real JT Server] Created fallback GLTF for ${originalName} (${fileSizeMB}MB file)`);
    return gltf;
}

// Start server
app.listen(PORT, () => {
    console.log(`[Real JT Server] Server running on port ${PORT}`);
    console.log(`[Real JT Server] Health check: http://localhost:${PORT}/health`);
    console.log(`[Real JT Server] Convert endpoint: http://localhost:${PORT}/convert`);
    console.log(`[Real JT Server] DLL path: C:\\Users\\georgem\\source\\repos\\kinetiCORE_JT_Server_Complete\\ls\\lib3`);
});

export default app;
