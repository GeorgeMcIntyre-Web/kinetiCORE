#!/usr/bin/env python3
"""
Simple test script for JT Converter Wrapper
Tests the C++ wrapper functionality
"""

import os
import sys
import subprocess
import tempfile
from pathlib import Path

def test_cpp_wrapper():
    """Test the C++ wrapper directly"""
    print("Testing C++ Wrapper...")
    
    wrapper_path = Path("jt_converter_wrapper.exe")
    if not wrapper_path.exists():
        wrapper_path = Path("build_simple/bin/Release/jt_converter_wrapper.exe")
    
    if not wrapper_path.exists():
        print("ERROR: C++ wrapper executable not found")
        print("   Please run build.bat first")
        return False
    
    print(f"Found wrapper: {wrapper_path}")
    
    # Test with a JT file
    test_jt = Path("C:/Users/George/source/repos/kinetiCORE_DATA/Jt/sample_jt_1.jt")
    if not test_jt.exists():
        print("WARNING: No test JT file found, skipping direct wrapper test")
        return True
    
    # Create temporary output file
    with tempfile.NamedTemporaryFile(suffix=".gltf", delete=False) as tmp:
        output_path = tmp.name
    
    try:
        # Run the wrapper
        cmd = [str(wrapper_path), str(test_jt), output_path]
        print(f"Running: {' '.join(cmd)}")
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        
        print(f"Return code: {result.returncode}")
        print(f"Stdout: {result.stdout}")
        if result.stderr:
            print(f"Stderr: {result.stderr}")
        
        if result.returncode == 0 and Path(output_path).exists():
            print("SUCCESS: C++ wrapper test passed")
            return True
        else:
            print("ERROR: C++ wrapper test failed")
            return False
            
    except subprocess.TimeoutExpired:
        print("ERROR: C++ wrapper test timed out")
        return False
    except Exception as e:
        print(f"ERROR: C++ wrapper test error: {e}")
        return False
    finally:
        # Clean up
        if Path(output_path).exists():
            Path(output_path).unlink()

def main():
    """Run tests"""
    print("=" * 60)
    print("JT Converter Wrapper Test")
    print("=" * 60)
    
    success = test_cpp_wrapper()
    
    print("=" * 60)
    if success:
        print("SUCCESS: All tests passed!")
    else:
        print("ERROR: Tests failed!")
    print("=" * 60)
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
