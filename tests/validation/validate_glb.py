#!/usr/bin/env python3
"""GLB Validator"""

import requests
import time
import json

def validate_glb():
    """Validate GLB file structure"""
    
    # Get a GLB file
    conversion_request = {
        "input_path": "C:/Users/George/source/repos/kinetiCORE_DATA/Jt/kr270r2700ultra.jt",
        "output_format": "glb",
        "load_geometry": True
    }
    
    response = requests.post("http://localhost:8000/convert", json=conversion_request)
    job_id = response.json()["job_id"]
    
    # Wait for completion
    while True:
        status_response = requests.get(f"http://localhost:8000/status/{job_id}")
        status = status_response.json()
        if status['status'] == 'completed':
            break
        time.sleep(1)
    
    # Download GLB
    download_response = requests.get(f"http://localhost:8000/download/{job_id}")
    glb_data = download_response.content
    
    # Save to file for external validation
    with open("robot_test.glb", "wb") as f:
        f.write(glb_data)
    
    print(f"GLB file saved as robot_test.glb ({len(glb_data)} bytes)")
    
    # Parse GLB structure
    offset = 12
    json_chunk_length = int.from_bytes(glb_data[offset:offset+4], 'little')
    json_chunk_type = int.from_bytes(glb_data[offset+4:offset+8], 'little')
    
    # Extract JSON
    json_data = glb_data[offset+8:offset+8+json_chunk_length]
    json_text = json_data.decode('utf-8')
    gltf_json = json.loads(json_text)
    
    # Validate accessors
    print("Validating accessors...")
    accessors = gltf_json.get('accessors', [])
    buffer_views = gltf_json.get('bufferViews', [])
    
    for i, accessor in enumerate(accessors):
        accessor_type = accessor.get('type')
        component_type = accessor.get('componentType')
        count = accessor.get('count')
        buffer_view_idx = accessor.get('bufferView')
        
        # Validate VEC3 accessors
        if accessor_type == 'VEC3':
            if component_type != 5126:  # FLOAT
                print(f"ERROR: Accessor {i} - VEC3 with invalid component type {component_type}")
                return False
            
            if buffer_view_idx is not None and buffer_view_idx < len(buffer_views):
                buffer_view = buffer_views[buffer_view_idx]
                byte_length = buffer_view.get('byteLength', 0)
                expected_length = count * 3 * 4  # 3 components * 4 bytes per float
                
                if byte_length != expected_length:
                    print(f"ERROR: Accessor {i} - Buffer view length mismatch")
                    print(f"  Expected: {expected_length}, Actual: {byte_length}")
                    return False
    
    print("All accessors validated successfully")
    
    # Check buffer views
    print("Validating buffer views...")
    for i, buffer_view in enumerate(buffer_views):
        byte_length = buffer_view.get('byteLength', 0)
        byte_offset = buffer_view.get('byteOffset', 0)
        target = buffer_view.get('target')
        
        if byte_length == 0:
            print(f"WARNING: Buffer view {i} has zero length")
        
        if target not in [34962, 34963]:  # ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER
            print(f"WARNING: Buffer view {i} has invalid target {target}")
    
    print("Buffer views validated")
    
    # Check meshes
    print("Validating meshes...")
    meshes = gltf_json.get('meshes', [])
    for i, mesh in enumerate(meshes):
        primitives = mesh.get('primitives', [])
        for j, primitive in enumerate(primitives):
            attributes = primitive.get('attributes', {})
            indices = primitive.get('indices')
            
            # Check required attributes
            if 'POSITION' not in attributes:
                print(f"ERROR: Mesh {i} primitive {j} missing POSITION attribute")
                return False
            
            if 'NORMAL' not in attributes:
                print(f"WARNING: Mesh {i} primitive {j} missing NORMAL attribute")
    
    print("Meshes validated")
    print("GLB file structure is valid!")
    return True

if __name__ == "__main__":
    validate_glb()
