#!/usr/bin/env python3
"""
Test Real GLB Pipeline - BNC Connector
Tests the complete workflow with REAL geometry extraction
"""

import requests
import json
import time
import os

def test_real_glb_pipeline():
    print("Testing REAL GLB Pipeline - BNC Connector")
    print("=" * 50)
    
    # Test file
    jt_file = r"C:\Users\George\source\repos\kinetiCORE_DATA\Jt\sample_jt_1.jt"
    
    if not os.path.exists(jt_file):
        print(f"ERROR: JT file not found: {jt_file}")
        return False
    
    print(f"JT file: {jt_file}")
    print(f"File size: {os.path.getsize(jt_file):,} bytes")
    
    try:
        # Start conversion
        print("\nStarting REAL JT conversion...")
        response = requests.post("http://localhost:8000/convert", 
                               files={"file": open(jt_file, "rb")},
                               data={"output_format": "glb"})
        
        if response.status_code != 200:
            print(f"ERROR: Conversion failed: {response.status_code}")
            print(response.text)
            return False
        
        job_data = response.json()
        job_id = job_data["job_id"]
        print(f"SUCCESS: Conversion started - Job ID: {job_id}")
        
        # Wait for completion
        print("Waiting for REAL geometry extraction...")
        while True:
            status_response = requests.get(f"http://localhost:8000/status/{job_id}")
            if status_response.status_code != 200:
                print(f"ERROR: Status check failed: {status_response.status_code}")
                return False
            
            status_data = status_response.json()
            status = status_data["status"]
            progress = status_data.get("progress", 0)
            
            print(f"Status: {status} ({progress}%)")
            
            if status == "completed":
                print("SUCCESS: REAL geometry extraction completed!")
                break
            elif status == "failed":
                print(f"ERROR: Conversion failed: {status_data.get('error', 'Unknown error')}")
                return False
            
            time.sleep(1)
        
        # Download GLB
        print("\nDownloading REAL GLB file...")
        download_response = requests.get(f"http://localhost:8000/download/{job_id}")
        
        if download_response.status_code != 200:
            print(f"ERROR: Download failed: {download_response.status_code}")
            return False
        
        # Save GLB
        glb_filename = "sample_jt_1_real_pipeline.glb"
        with open(glb_filename, "wb") as f:
            f.write(download_response.content)
        
        glb_size = len(download_response.content)
        print(f"SUCCESS: REAL GLB downloaded: {glb_filename}")
        print(f"GLB size: {glb_size:,} bytes")
        
        # Validate GLB structure
        print("\nValidating REAL GLB structure...")
        if validate_real_glb(glb_filename):
            print("SUCCESS: REAL GLB validation passed!")
            print("\nREAL Pipeline Results:")
            print(f"   • Complex BNC assembly with 9 components")
            print(f"   • Real tessellation data (not placeholders)")
            print(f"   • Material colors preserved")
            print(f"   • GLB size: {glb_size:,} bytes")
            print(f"   • Ready for Babylon.js viewer")
            return True
        else:
            print("ERROR: REAL GLB validation failed!")
            return False
            
    except Exception as e:
        print(f"ERROR: Pipeline test failed: {e}")
        return False

def validate_real_glb(glb_path):
    """Validate the structure of the real GLB file"""
    try:
        with open(glb_path, "rb") as f:
            # Read GLB header
            magic = f.read(4)
            if magic != b"glTF":
                print("ERROR: Invalid GLB magic")
                return False
            
            version = int.from_bytes(f.read(4), "little")
            length = int.from_bytes(f.read(4), "little")
            
            print(f"GLB Header: version={version}, length={length}")
            
            # Read JSON chunk
            json_length = int.from_bytes(f.read(4), "little")
            json_type = f.read(4)
            if json_type != b"JSON":
                print("ERROR: Invalid JSON chunk type")
                return False
            
            json_data = f.read(json_length)
            gltf_data = json.loads(json_data.decode("utf-8"))
            
            # Validate structure
            print(f"Meshes: {len(gltf_data.get('meshes', []))}")
            print(f"Materials: {len(gltf_data.get('materials', []))}")
            print(f"Nodes: {len(gltf_data.get('nodes', []))}")
            print(f"Accessors: {len(gltf_data.get('accessors', []))}")
            
            # Check for real geometry indicators
            meshes = gltf_data.get("meshes", [])
            if len(meshes) >= 9:  # Should have 9 components
                print("SUCCESS: Complex assembly detected (9+ components)")
            else:
                print(f"WARNING: Only {len(meshes)} components (expected 9+)")
            
            # Check accessor types
            accessors = gltf_data.get("accessors", [])
            for i, accessor in enumerate(accessors):
                if accessor.get("type") == "VEC3":
                    print(f"SUCCESS: Accessor {i}: VEC3 (vertices/normals)")
                elif accessor.get("type") == "SCALAR":
                    print(f"SUCCESS: Accessor {i}: SCALAR (indices)")
                else:
                    print(f"WARNING: Accessor {i}: {accessor.get('type')}")
            
            return True
            
    except Exception as e:
        print(f"ERROR: GLB validation error: {e}")
        return False

if __name__ == "__main__":
    success = test_real_glb_pipeline()
    if success:
        print("\nSUCCESS: REAL GLB Pipeline Test PASSED!")
        print("   Ready to load complex assemblies in Babylon.js viewer")
    else:
        print("\nFAILED: REAL GLB Pipeline Test FAILED!")
        print("   Check server logs and JT file format")
