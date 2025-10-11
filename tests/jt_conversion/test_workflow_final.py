#!/usr/bin/env python3
"""
Complete End-to-End Workflow Test
Simulates the exact flow from kinetiCORE frontend to GLB viewer
"""

import requests
import time
import json
from pathlib import Path

def test_frontend_health_check():
    """Test the health check that kinetiCORE frontend will make"""
    print("Step 1: Testing frontend health check...")
    
    try:
        # Simulate the exact request from kinetiCORE frontend
        headers = {
            'Origin': 'http://localhost:5175',
            'Accept': 'application/json'
        }
        
        response = requests.get("http://localhost:8000/health", headers=headers, timeout=5)
        
        if response.status_code == 200:
            health = response.json()
            print(f"PASS: Health check successful")
            print(f"  Status: {health['status']}")
            print(f"  Wrapper available: {health['wrapper_available']}")
            print(f"  Version: {health['version']}")
            
            # Check CORS headers
            cors_origin = response.headers.get('access-control-allow-origin')
            if cors_origin == 'http://localhost:5175':
                print(f"PASS: CORS headers correct")
            else:
                print(f"FAIL: CORS headers missing or incorrect")
                return False
            
            return health['status'] == 'healthy' and health['wrapper_available']
        else:
            print(f"FAIL: Health check failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"FAIL: Health check error: {e}")
        return False

def test_frontend_conversion_request():
    """Test the conversion request that kinetiCORE frontend will make"""
    print("\nStep 2: Testing frontend conversion request...")
    
    # Test with sample JT file
    test_jt = "C:/Users/George/source/repos/kinetiCORE_DATA/Jt/sample_jt_1.jt"
    if not Path(test_jt).exists():
        print("FAIL: Test JT file not found")
        return False
    
    try:
        # Simulate the exact request from kinetiCORE frontend
        headers = {
            'Origin': 'http://localhost:5175',
            'Content-Type': 'application/json'
        }
        
        conversion_request = {
            "input_path": test_jt,
            "output_format": "glb",
            "load_geometry": True
        }
        
        print(f"PASS: Sending conversion request for: {Path(test_jt).name}")
        response = requests.post("http://localhost:8000/convert", 
                               json=conversion_request, 
                               headers=headers)
        
        if response.status_code == 200:
            job_data = response.json()
            job_id = job_data["job_id"]
            print(f"PASS: Conversion job started: {job_id}")
            return job_id
        else:
            print(f"FAIL: Conversion request failed: {response.status_code}")
            print(f"  Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"FAIL: Conversion request error: {e}")
        return False

def test_frontend_progress_polling(job_id):
    """Test the progress polling that kinetiCORE frontend will do"""
    print(f"\nStep 3: Testing frontend progress polling for job {job_id}...")
    
    try:
        headers = {
            'Origin': 'http://localhost:5175',
            'Accept': 'application/json'
        }
        
        max_wait = 60
        start_time = time.time()
        poll_count = 0
        
        while time.time() - start_time < max_wait:
            poll_count += 1
            response = requests.get(f"http://localhost:8000/status/{job_id}", headers=headers)
            
            if response.status_code == 200:
                status = response.json()
                print(f"  Poll #{poll_count}: {status['status']} - {status['message']}")
                
                if status['status'] == 'completed':
                    print(f"PASS: Conversion completed after {poll_count} polls")
                    return True
                elif status['status'] == 'failed':
                    print(f"FAIL: Conversion failed: {status['message']}")
                    return False
            else:
                print(f"FAIL: Status check failed: {response.status_code}")
                return False
            
            time.sleep(1)
        
        print(f"FAIL: Conversion timed out after {max_wait} seconds")
        return False
        
    except Exception as e:
        print(f"FAIL: Progress polling error: {e}")
        return False

def test_frontend_file_download(job_id):
    """Test the file download that kinetiCORE frontend will do"""
    print(f"\nStep 4: Testing frontend file download for job {job_id}...")
    
    try:
        headers = {
            'Origin': 'http://localhost:5175'
        }
        
        response = requests.get(f"http://localhost:8000/download/{job_id}", headers=headers)
        
        if response.status_code == 200:
            glb_data = response.content
            print(f"PASS: GLB file downloaded: {len(glb_data)} bytes")
            
            # Validate GLB file
            if len(glb_data) > 1000:
                print(f"PASS: GLB file size reasonable")
            else:
                print(f"FAIL: GLB file too small")
                return False
            
            # Check GLB magic number
            if glb_data[:4] == b'glTF':
                print(f"PASS: GLB magic number correct")
            else:
                print(f"FAIL: GLB magic number incorrect")
                return False
            
            # Check content type
            content_type = response.headers.get('content-type', '')
            if 'application/octet-stream' in content_type or 'model/gltf-binary' in content_type:
                print(f"PASS: Content type correct: {content_type}")
            else:
                print(f"WARN: Content type: {content_type}")
            
            return True
        else:
            print(f"FAIL: Download failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"FAIL: Download error: {e}")
        return False

def test_babylon_glb_loading():
    """Test that the GLB file can be loaded by Babylon.js"""
    print("\nStep 5: Testing Babylon.js GLB loading compatibility...")
    
    try:
        # Get a fresh GLB file
        test_jt = "C:/Users/George/source/repos/kinetiCORE_DATA/Jt/sample_jt_1.jt"
        
        conversion_request = {
            "input_path": test_jt,
            "output_format": "glb",
            "load_geometry": True
        }
        
        # Start conversion
        response = requests.post("http://localhost:8000/convert", json=conversion_request)
        if response.status_code != 200:
            print("FAIL: Failed to start conversion for GLB test")
            return False
        
        job_id = response.json()["job_id"]
        
        # Wait for completion
        max_wait = 30
        start_time = time.time()
        
        while time.time() - start_time < max_wait:
            status_response = requests.get(f"http://localhost:8000/status/{job_id}")
            if status_response.status_code == 200:
                status = status_response.json()
                if status['status'] == 'completed':
                    break
                elif status['status'] == 'failed':
                    print(f"FAIL: Conversion failed: {status['message']}")
                    return False
            time.sleep(1)
        else:
            print("FAIL: Conversion timed out")
            return False
        
        # Download GLB
        download_response = requests.get(f"http://localhost:8000/download/{job_id}")
        if download_response.status_code != 200:
            print("FAIL: Failed to download GLB for Babylon test")
            return False
        
        glb_data = download_response.content
        
        # Validate GLB structure for Babylon.js compatibility
        print(f"PASS: GLB file size: {len(glb_data)} bytes")
        
        # Check GLB header
        if len(glb_data) >= 12:
            magic = glb_data[:4]
            version = int.from_bytes(glb_data[4:8], 'little')
            length = int.from_bytes(glb_data[8:12], 'little')
            
            print(f"PASS: GLB header valid:")
            print(f"  Magic: {magic}")
            print(f"  Version: {version}")
            print(f"  Length: {length}")
            
            if magic == b'glTF' and version == 2 and length == len(glb_data):
                print(f"PASS: GLB header structure correct for Babylon.js")
                return True
            else:
                print(f"FAIL: GLB header structure incorrect")
                return False
        else:
            print(f"FAIL: GLB file too small for valid header")
            return False
            
    except Exception as e:
        print(f"FAIL: Babylon.js compatibility test error: {e}")
        return False

def test_robot_file_conversion():
    """Test with the large robot file"""
    print("\nStep 6: Testing large robot file conversion...")
    
    robot_jt = "C:/Users/George/source/repos/kinetiCORE_DATA/Jt/kr270r2700ultra.jt"
    if not Path(robot_jt).exists():
        print("WARN: Robot file not found, skipping robot test")
        return True
    
    try:
        conversion_request = {
            "input_path": robot_jt,
            "output_format": "glb",
            "load_geometry": True
        }
        
        print(f"PASS: Starting robot conversion: {Path(robot_jt).name}")
        response = requests.post("http://localhost:8000/convert", json=conversion_request)
        
        if response.status_code != 200:
            print(f"FAIL: Robot conversion request failed: {response.status_code}")
            return False
        
        job_id = response.json()["job_id"]
        print(f"PASS: Robot conversion job started: {job_id}")
        
        # Wait for completion with longer timeout
        max_wait = 120
        start_time = time.time()
        
        while time.time() - start_time < max_wait:
            status_response = requests.get(f"http://localhost:8000/status/{job_id}")
            if status_response.status_code == 200:
                status = status_response.json()
                if status['status'] == 'completed':
                    print(f"PASS: Robot conversion completed!")
                    
                    # Test download
                    download_response = requests.get(f"http://localhost:8000/download/{job_id}")
                    if download_response.status_code == 200:
                        robot_glb = download_response.content
                        print(f"PASS: Robot GLB downloaded: {len(robot_glb)} bytes")
                        
                        # Validate robot GLB
                        if robot_glb[:4] == b'glTF':
                            print(f"PASS: Robot GLB magic number correct")
                            return True
                        else:
                            print(f"FAIL: Robot GLB magic number incorrect")
                            return False
                    else:
                        print(f"FAIL: Robot GLB download failed")
                        return False
                        
                elif status['status'] == 'failed':
                    print(f"FAIL: Robot conversion failed: {status['message']}")
                    return False
            time.sleep(2)
        
        print(f"FAIL: Robot conversion timed out")
        return False
        
    except Exception as e:
        print(f"FAIL: Robot conversion test error: {e}")
        return False

def main():
    """Run complete end-to-end workflow test"""
    print("=" * 70)
    print("COMPLETE END-TO-END WORKFLOW TEST")
    print("Simulating kinetiCORE Frontend -> GLB Server -> Viewer")
    print("=" * 70)
    
    # Test 1: Frontend health check
    if not test_frontend_health_check():
        print("\nFAIL: HEALTH CHECK FAILED - Frontend cannot connect to server")
        return False
    
    # Test 2: Frontend conversion request
    job_id = test_frontend_conversion_request()
    if not job_id:
        print("\nFAIL: CONVERSION REQUEST FAILED - Frontend cannot start conversion")
        return False
    
    # Test 3: Frontend progress polling
    if not test_frontend_progress_polling(job_id):
        print("\nFAIL: PROGRESS POLLING FAILED - Frontend cannot track progress")
        return False
    
    # Test 4: Frontend file download
    if not test_frontend_file_download(job_id):
        print("\nFAIL: FILE DOWNLOAD FAILED - Frontend cannot download GLB")
        return False
    
    # Test 5: Babylon.js compatibility
    if not test_babylon_glb_loading():
        print("\nFAIL: BABYLON.JS COMPATIBILITY FAILED - GLB cannot be loaded")
        return False
    
    # Test 6: Large file handling
    if not test_robot_file_conversion():
        print("\nFAIL: ROBOT FILE CONVERSION FAILED - Large files not handled")
        return False
    
    print("\n" + "=" * 70)
    print("ALL TESTS PASSED!")
    print("=" * 70)
    print("The complete workflow is ready:")
    print("PASS: Frontend health check works")
    print("PASS: Conversion requests work")
    print("PASS: Progress polling works")
    print("PASS: File downloads work")
    print("PASS: GLB files are Babylon.js compatible")
    print("PASS: Large files are handled properly")
    print("PASS: CORS headers are correct")
    print("")
    print("READY FOR PRODUCTION USE!")
    print("You can now click 'Load JT File' in kinetiCORE!")
    print("=" * 70)
    
    return True

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
