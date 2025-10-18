#!/usr/bin/env python3
"""
Test USD Conversion Pipeline
Tests the USD server's conversion functionality
"""

import requests
import os
import json

def test_usd_conversion():
    """Test USD file conversion to glTF"""
    
    # Test file path
    test_file = "test_assets/usd/test/simple_cube.usd"
    
    if not os.path.exists(test_file):
        print(f"ERROR: Test file not found: {test_file}")
        return False
    
    print(f"Testing USD conversion with: {test_file}")
    
    # Prepare the request
    url = "http://localhost:5001/api/convert-usd"
    
    try:
        with open(test_file, 'rb') as f:
            files = {'file': ('simple_cube.usd', f, 'application/octet-stream')}
            data = {
                'quality': 'medium',
                'enablePhysics': 'true',
                'enableMaterials': 'true',
                'enableAnimations': 'true'
            }
            
            print("Sending conversion request...")
            response = requests.post(url, files=files, data=data, timeout=30)
            
            print(f"Response status: {response.status_code}")
            
            if response.status_code == 200:
                # Check if we got a glTF file
                content_type = response.headers.get('content-type', '')
                print(f"Content-Type: {content_type}")
                
                if 'application/octet-stream' in content_type or 'model/gltf' in content_type:
                    print("SUCCESS: USD conversion successful!")
                    print(f"Response size: {len(response.content)} bytes")
                    
                    # Save the converted file for inspection
                    output_file = "test_output.gltf"
                    with open(output_file, 'wb') as out_f:
                        out_f.write(response.content)
                    print(f"Saved converted file: {output_file}")
                    
                    return True
                else:
                    print(f"ERROR: Unexpected content type: {content_type}")
                    return False
            else:
                print(f"ERROR: Conversion failed: {response.status_code}")
                print(f"Error response: {response.text}")
                return False
                
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Request failed: {e}")
        return False
    except Exception as e:
        print(f"ERROR: Unexpected error: {e}")
        return False

def test_health_endpoint():
    """Test the health endpoint"""
    print("Testing health endpoint...")
    
    try:
        response = requests.get("http://localhost:5001/api/health", timeout=5)
        
        if response.status_code == 200:
            health_data = response.json()
            print("SUCCESS: Health check passed!")
            print(f"Status: {health_data.get('status')}")
            print(f"Converter: {health_data.get('converter')}")
            print(f"Supported formats: {health_data.get('supported_formats')}")
            return True
        else:
            print(f"ERROR: Health check failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"ERROR: Health check error: {e}")
        return False

if __name__ == "__main__":
    print("Starting USD Pipeline Validation Tests")
    print("=" * 50)
    
    # Test 1: Health endpoint
    health_ok = test_health_endpoint()
    print()
    
    # Test 2: USD conversion
    conversion_ok = test_usd_conversion()
    print()
    
    # Summary
    print("Test Summary:")
    print(f"   Health Endpoint: {'PASS' if health_ok else 'FAIL'}")
    print(f"   USD Conversion: {'PASS' if conversion_ok else 'FAIL'}")
    
    if health_ok and conversion_ok:
        print("\nAll tests passed! USD pipeline is ready for Edwin's testing.")
    else:
        print("\nSome tests failed. Check the issues above.")
