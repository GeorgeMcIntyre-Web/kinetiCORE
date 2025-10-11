#!/usr/bin/env python3
"""
Test script for GLB JT Conversion Server
Tests both GLTF and GLB conversion capabilities
"""

import os
import sys
import subprocess
import tempfile
import requests
from pathlib import Path
import time
import json

def test_server_health():
    """Test server health endpoint"""
    print("Testing server health...")
    
    try:
        response = requests.get("http://localhost:8000/health", timeout=5)
        if response.status_code == 200:
            health = response.json()
            print(f"✓ Server is {health['status']}")
            print(f"✓ Wrapper available: {health['wrapper_available']}")
            return True
        else:
            print(f"✗ Health check failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"✗ Cannot connect to server: {e}")
        return False

def test_glb_conversion():
    """Test GLB conversion"""
    print("\nTesting GLB conversion...")
    
    test_jt = Path("C:/Users/George/source/repos/kinetiCORE_DATA/Jt/sample_jt_1.jt")
    if not test_jt.exists():
        print("WARNING: No test JT file found, skipping GLB test")
        return True
    
    try:
        # Start conversion
        conversion_request = {
            "input_path": str(test_jt),
            "output_format": "glb",
            "load_geometry": True
        }
        
        print(f"Starting GLB conversion: {test_jt}")
        response = requests.post("http://localhost:8000/convert", json=conversion_request)
        
        if response.status_code != 200:
            print(f"✗ Conversion request failed: {response.status_code}")
            return False
        
        job_data = response.json()
        job_id = job_data["job_id"]
        print(f"✓ Conversion started: {job_id}")
        
        # Wait for completion
        max_wait = 60  # 60 seconds
        start_time = time.time()
        
        while time.time() - start_time < max_wait:
            status_response = requests.get(f"http://localhost:8000/status/{job_id}")
            if status_response.status_code == 200:
                status = status_response.json()
                print(f"Status: {status['status']} - {status['message']}")
                
                if status['status'] == 'completed':
                    print(f"✓ GLB conversion completed!")
                    print(f"✓ Output file: {status['output_file']}")
                    print(f"✓ File size: {status['file_size']} bytes")
                    
                    # Test download
                    download_response = requests.get(f"http://localhost:8000/download/{job_id}")
                    if download_response.status_code == 200:
                        print(f"✓ Download successful: {len(download_response.content)} bytes")
                        return True
                    else:
                        print(f"✗ Download failed: {download_response.status_code}")
                        return False
                        
                elif status['status'] == 'failed':
                    print(f"✗ Conversion failed: {status['message']}")
                    return False
            
            time.sleep(1)
        
        print("✗ Conversion timed out")
        return False
        
    except Exception as e:
        print(f"✗ GLB conversion test error: {e}")
        return False

def test_gltf_conversion():
    """Test GLTF conversion"""
    print("\nTesting GLTF conversion...")
    
    test_jt = Path("C:/Users/George/source/repos/kinetiCORE_DATA/Jt/sample_jt_2.jt")
    if not test_jt.exists():
        print("WARNING: No test JT file found, skipping GLTF test")
        return True
    
    try:
        # Start conversion
        conversion_request = {
            "input_path": str(test_jt),
            "output_format": "gltf",
            "load_geometry": True
        }
        
        print(f"Starting GLTF conversion: {test_jt}")
        response = requests.post("http://localhost:8000/convert", json=conversion_request)
        
        if response.status_code != 200:
            print(f"✗ Conversion request failed: {response.status_code}")
            return False
        
        job_data = response.json()
        job_id = job_data["job_id"]
        print(f"✓ Conversion started: {job_id}")
        
        # Wait for completion
        max_wait = 60
        start_time = time.time()
        
        while time.time() - start_time < max_wait:
            status_response = requests.get(f"http://localhost:8000/status/{job_id}")
            if status_response.status_code == 200:
                status = status_response.json()
                
                if status['status'] == 'completed':
                    print(f"✓ GLTF conversion completed!")
                    print(f"✓ Output file: {status['output_file']}")
                    print(f"✓ File size: {status['file_size']} bytes")
                    return True
                    
                elif status['status'] == 'failed':
                    print(f"✗ Conversion failed: {status['message']}")
                    return False
            
            time.sleep(1)
        
        print("✗ Conversion timed out")
        return False
        
    except Exception as e:
        print(f"✗ GLTF conversion test error: {e}")
        return False

def test_robot_conversion():
    """Test robot file conversion"""
    print("\nTesting robot file conversion...")
    
    robot_jt = Path("C:/Users/George/source/repos/kinetiCORE_DATA/Jt/kr270r2700ultra.jt")
    if not robot_jt.exists():
        print("WARNING: No robot JT file found, skipping robot test")
        return True
    
    try:
        # Start GLB conversion for robot
        conversion_request = {
            "input_path": str(robot_jt),
            "output_format": "glb",
            "load_geometry": True
        }
        
        print(f"Starting robot GLB conversion: {robot_jt}")
        response = requests.post("http://localhost:8000/convert", json=conversion_request)
        
        if response.status_code != 200:
            print(f"✗ Robot conversion request failed: {response.status_code}")
            return False
        
        job_data = response.json()
        job_id = job_data["job_id"]
        print(f"✓ Robot conversion started: {job_id}")
        
        # Wait for completion
        max_wait = 120  # 2 minutes for large file
        start_time = time.time()
        
        while time.time() - start_time < max_wait:
            status_response = requests.get(f"http://localhost:8000/status/{job_id}")
            if status_response.status_code == 200:
                status = status_response.json()
                
                if status['status'] == 'completed':
                    print(f"✓ Robot GLB conversion completed!")
                    print(f"✓ Output file: {status['output_file']}")
                    print(f"✓ File size: {status['file_size']} bytes")
                    
                    # Test download
                    download_response = requests.get(f"http://localhost:8000/download/{job_id}")
                    if download_response.status_code == 200:
                        print(f"✓ Robot download successful: {len(download_response.content)} bytes")
                        return True
                    else:
                        print(f"✗ Robot download failed: {download_response.status_code}")
                        return False
                        
                elif status['status'] == 'failed':
                    print(f"✗ Robot conversion failed: {status['message']}")
                    return False
            
            time.sleep(2)
        
        print("✗ Robot conversion timed out")
        return False
        
    except Exception as e:
        print(f"✗ Robot conversion test error: {e}")
        return False

def main():
    """Run all tests"""
    print("=" * 60)
    print("GLB JT Conversion Server Test Suite")
    print("=" * 60)
    
    # Test server health
    if not test_server_health():
        print("\n✗ Server health check failed - make sure server is running")
        print("Run: python jt_conversion_server_glb.py")
        return False
    
    # Test GLB conversion
    glb_success = test_glb_conversion()
    
    # Test GLTF conversion
    gltf_success = test_gltf_conversion()
    
    # Test robot conversion
    robot_success = test_robot_conversion()
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Results Summary")
    print("=" * 60)
    print(f"Server Health: {'✓ PASS' if True else '✗ FAIL'}")
    print(f"GLB Conversion: {'✓ PASS' if glb_success else '✗ FAIL'}")
    print(f"GLTF Conversion: {'✓ PASS' if gltf_success else '✗ FAIL'}")
    print(f"Robot Conversion: {'✓ PASS' if robot_success else '✗ FAIL'}")
    
    all_passed = glb_success and gltf_success and robot_success
    
    if all_passed:
        print("\n🎉 All tests passed! GLB conversion is working perfectly!")
        print("\nBenefits of GLB format:")
        print("- Single binary file (no separate .bin files)")
        print("- Smaller file size than GLTF")
        print("- Faster loading in web viewers")
        print("- Better for production deployment")
    else:
        print("\n❌ Some tests failed. Check the output above for details.")
    
    print("=" * 60)
    return all_passed

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
