#!/usr/bin/env python3
"""Debug GLB file structure"""

import requests
import time
import json

def debug_glb_file():
    """Debug the GLB file structure"""
    
    # Start conversion
    conversion_request = {
        "input_path": "C:/Users/George/source/repos/kinetiCORE_DATA/Jt/kr270r2700ultra.jt",
        "output_format": "glb",
        "load_geometry": True
    }
    
    print("Starting conversion...")
    response = requests.post("http://localhost:8000/convert", json=conversion_request)
    
    if response.status_code != 200:
        print(f"Conversion failed: {response.status_code}")
        return
    
    job_id = response.json()["job_id"]
    print(f"Job started: {job_id}")
    
    # Wait for completion
    max_wait = 60
    start_time = time.time()
    
    while time.time() - start_time < max_wait:
        status_response = requests.get(f"http://localhost:8000/status/{job_id}")
        if status_response.status_code == 200:
            status = status_response.json()
            if status['status'] == 'completed':
                break
            elif status['status'] == 'failed':
                print(f"Conversion failed: {status['message']}")
                return
        time.sleep(1)
    else:
        print("Conversion timed out")
        return
    
    # Download GLB
    download_response = requests.get(f"http://localhost:8000/download/{job_id}")
    if download_response.status_code != 200:
        print(f"Download failed: {download_response.status_code}")
        return
    
    glb_data = download_response.content
    print(f"GLB file size: {len(glb_data)} bytes")
    
    # Parse GLB structure
    if len(glb_data) < 12:
        print("GLB file too small")
        return
    
    # Read header
    magic = glb_data[:4]
    version = int.from_bytes(glb_data[4:8], 'little')
    length = int.from_bytes(glb_data[8:12], 'little')
    
    print(f"Magic: {magic}")
    print(f"Version: {version}")
    print(f"Length: {length}")
    
    if magic != b'glTF':
        print("Invalid GLB magic number")
        return
    
    # Read JSON chunk
    offset = 12
    json_chunk_length = int.from_bytes(glb_data[offset:offset+4], 'little')
    json_chunk_type = int.from_bytes(glb_data[offset+4:offset+8], 'little')
    
    print(f"JSON chunk length: {json_chunk_length}")
    print(f"JSON chunk type: {json_chunk_type}")
    
    if json_chunk_type != 0x4E4F534A:  # "JSON"
        print("Invalid JSON chunk type")
        return
    
    # Extract JSON
    json_data = glb_data[offset+8:offset+8+json_chunk_length]
    json_text = json_data.decode('utf-8')
    
    print(f"JSON size: {len(json_text)} characters")
    
    # Parse and analyze JSON
    try:
        gltf_json = json.loads(json_text)
        print("JSON parsed successfully")
        
        # Check accessors
        if 'accessors' in gltf_json:
            accessors = gltf_json['accessors']
            print(f"Number of accessors: {len(accessors)}")
            
            for i, accessor in enumerate(accessors):
                print(f"Accessor {i}:")
                print(f"  Type: {accessor.get('type', 'MISSING')}")
                print(f"  ComponentType: {accessor.get('componentType', 'MISSING')}")
                print(f"  Count: {accessor.get('count', 'MISSING')}")
                print(f"  BufferView: {accessor.get('bufferView', 'MISSING')}")
                
                # Check for invalid VEC3
                if accessor.get('type') == 'VEC3':
                    print(f"  *** VEC3 ACCESSOR FOUND ***")
                    if accessor.get('componentType') != 5126:  # FLOAT
                        print(f"  *** INVALID COMPONENT TYPE: {accessor.get('componentType')} ***")
        
        # Check meshes
        if 'meshes' in gltf_json:
            meshes = gltf_json['meshes']
            print(f"Number of meshes: {len(meshes)}")
            
            for i, mesh in enumerate(meshes):
                print(f"Mesh {i}: {mesh.get('name', 'unnamed')}")
                if 'primitives' in mesh:
                    for j, primitive in enumerate(mesh['primitives']):
                        print(f"  Primitive {j}:")
                        if 'attributes' in primitive:
                            for attr_name, attr_accessor in primitive['attributes'].items():
                                print(f"    {attr_name}: accessor {attr_accessor}")
        
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        print(f"First 200 chars: {json_text[:200]}")

if __name__ == "__main__":
    debug_glb_file()
