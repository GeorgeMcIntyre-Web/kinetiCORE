#!/usr/bin/env python3
"""
Debug Server Conversion Issue
"""

import requests
import os

def debug_server():
    print("Debugging server conversion...")
    
    # Test health first
    try:
        health_response = requests.get("http://localhost:8000/health")
        print(f"Health check: {health_response.status_code}")
        print(f"Health response: {health_response.json()}")
    except Exception as e:
        print(f"Health check failed: {e}")
        return
    
    # Test conversion with detailed error info
    jt_file = r"C:\Users\George\source\repos\kinetiCORE_DATA\Jt\sample_jt_1.jt"
    
    if not os.path.exists(jt_file):
        print(f"JT file not found: {jt_file}")
        return
    
    try:
        print(f"\nTesting conversion with file: {jt_file}")
        with open(jt_file, "rb") as f:
            response = requests.post("http://localhost:8000/convert", 
                                   files={"file": f},
                                   data={"output_format": "glb"})
        
        print(f"Response status: {response.status_code}")
        print(f"Response headers: {dict(response.headers)}")
        
        if response.status_code != 200:
            print(f"Error response: {response.text}")
        else:
            print(f"Success response: {response.json()}")
            
    except Exception as e:
        print(f"Conversion request failed: {e}")

if __name__ == "__main__":
    debug_server()
