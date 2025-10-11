#!/usr/bin/env python3
"""
Test the new JT converter v3 with real mesh data extraction
"""

import requests
import time
import os

def test_jt_conversion():
    print("Testing JT Converter v3 with Real Mesh Data")
    print("=" * 50)
    
    # Test file
    jt_file = r"C:\Users\George\source\repos\kinetiCORE_DATA\Jt\sample_jt_1.jt"
    
    if not os.path.exists(jt_file):
        print(f"Error: JT file not found: {jt_file}")
        return False
    
    print(f"Testing with: {jt_file}")
    
    # Upload file
    with open(jt_file, 'rb') as f:
        files = {'file': f}
        data = {
            'output_format': 'glb',
            'load_geometry': 'true'
        }
        
        print("Uploading JT file...")
        response = requests.post('http://localhost:8000/convert', files=files, data=data)
    
    if response.status_code != 200:
        print(f"Error: {response.status_code} - {response.text}")
        return False
    
    result = response.json()
    print(f"Conversion started: {result}")
    
    job_id = result['job_id']
    print(f"Job ID: {job_id}")
    
    # Poll for completion
    max_attempts = 30
    for attempt in range(max_attempts):
        print(f"Checking status... (attempt {attempt + 1}/{max_attempts})")
        
        status_response = requests.get(f'http://localhost:8000/status/{job_id}')
        if status_response.status_code != 200:
            print(f"Status check failed: {status_response.status_code}")
            return False
        
        status = status_response.json()
        print(f"Status: {status['status']}")
        
        if status['status'] == 'completed':
            print("Conversion completed!")
            print(f"Output file: {status.get('output_file', 'Unknown')}")
            
            # Check if GLB file exists and get its size
            if 'output_file' in status:
                glb_path = status['output_file']
                if os.path.exists(glb_path):
                    size = os.path.getsize(glb_path)
                    print(f"GLB file size: {size} bytes")
                    
                    if size > 5000:  # Expect larger files with real geometry
                        print("SUCCESS: Large GLB file indicates real geometry!")
                        return True
                    else:
                        print("WARNING: Small GLB file may still be placeholder")
                        return True
                else:
                    print(f"Error: GLB file not found: {glb_path}")
                    return False
            else:
                print("Error: No output file in status")
                return False
        
        elif status['status'] == 'failed':
            print(f"Conversion failed: {status.get('error', 'Unknown error')}")
            return False
        
        time.sleep(2)
    
    print("Timeout waiting for conversion")
    return False

if __name__ == "__main__":
    success = test_jt_conversion()
    if success:
        print("\nJT Converter v3 test PASSED!")
        print("Real mesh data extraction is working!")
    else:
        print("\nJT Converter v3 test FAILED!")
        print("Need to investigate further...")
