#!/usr/bin/env python3
"""
Enhanced JT Conversion Server with GLB Support
Supports both GLTF and GLB output formats for optimal web integration
"""

import os
import sys
import subprocess
import tempfile
import requests
from pathlib import Path
import time
from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uvicorn
import json

app = FastAPI(title="JT Conversion Server", version="2.0")

# Add CORS middleware to allow requests from kinetiCORE frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5175", "http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConversionRequest(BaseModel):
    input_path: str
    output_format: str = "glb"  # "gltf" or "glb"
    load_geometry: bool = True

class ConversionProgress(BaseModel):
    status: str  # "queued", "processing", "completed", "failed"
    progress: float  # 0.0 to 1.0
    message: str
    output_file: Optional[str] = None
    file_size: Optional[int] = None

# Global conversion status tracking
conversion_status: Dict[str, ConversionProgress] = {}

def save_uploaded_file(file: UploadFile) -> str:
    """Save uploaded file to temporary location and return path"""
    try:
        # Create temporary file with .jt extension
        with tempfile.NamedTemporaryFile(suffix=".jt", delete=False) as tmp:
            # Read uploaded file content
            content = file.file.read()
            tmp.write(content)
            tmp.flush()
            return tmp.name
    except Exception as e:
        raise Exception(f"Failed to save uploaded file: {str(e)}")

@app.get("/")
async def root():
    """Root endpoint with server information"""
    return {
        "message": "JT Conversion Server v2.0",
        "description": "Converts JT files to GLTF/GLB format",
        "endpoints": {
            "/health": "Check server health",
            "/convert": "Convert JT file to GLTF/GLB",
            "/status/{job_id}": "Check conversion status",
            "/download/{job_id}": "Download converted file"
        },
        "supported_formats": ["gltf", "glb"],
        "features": [
            "Complete tree structure extraction",
            "All mesh geometry data",
            "Node names and metadata",
            "Material properties",
            "Transform matrices",
            "GLB binary format for web optimization"
        ]
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check if C++ wrapper exists
        wrapper_paths = [
            Path("jt_converter_wrapper.exe"),
            Path("build_glb/bin/Release/jt_converter_wrapper.exe"),
            Path("build_real/bin/Release/jt_converter_wrapper.exe")
        ]
        
        wrapper_found = any(path.exists() for path in wrapper_paths)
        
        return {
            "status": "healthy" if wrapper_found else "degraded",
            "wrapper_available": wrapper_found,
            "timestamp": time.time(),
            "version": "2.0"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": time.time()
        }

@app.post("/convert")
async def convert_jt_file(
    background_tasks: BackgroundTasks,
    file: Optional[UploadFile] = File(None),
    input_path: Optional[str] = Form(None),
    output_format: str = Form("glb"),
    load_geometry: bool = Form(True)
):
    """Convert JT file to GLTF or GLB format - accepts file upload or file path"""
    try:
        # Determine input source
        if file:
            # Handle file upload
            if not file.filename or not file.filename.lower().endswith('.jt'):
                raise HTTPException(status_code=400, detail="Uploaded file must be a .jt file")
            
            # Save uploaded file to temp location
            temp_input = save_uploaded_file(file)
            input_file_path = temp_input
            
        elif input_path:
            # Handle file path
            input_file_path = Path(input_path)
            if not input_file_path.exists():
                raise HTTPException(status_code=404, detail=f"Input file not found: {input_path}")
            
            if not input_file_path.suffix.lower() == '.jt':
                raise HTTPException(status_code=400, detail="Input file must be a .jt file")
            
            input_file_path = str(input_file_path)
            
        else:
            raise HTTPException(status_code=400, detail="Must provide either file upload or input_path")
        
        # Validate output format
        if output_format not in ['gltf', 'glb']:
            raise HTTPException(status_code=400, detail="Output format must be 'gltf' or 'glb'")
        
        # Generate job ID
        job_id = f"job_{int(time.time() * 1000)}"
        
        # Initialize conversion status
        conversion_status[job_id] = ConversionProgress(
            status="queued",
            progress=0.0,
            message="Conversion queued"
        )
        
        # Start background conversion
        background_tasks.add_task(
            perform_conversion,
            job_id,
            input_file_path,
            output_format,
            load_geometry
        )
        
        return {
            "job_id": job_id,
            "status": "queued",
            "message": "Conversion started",
            "input_file": input_file_path,
            "output_format": output_format
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")

@app.get("/status/{job_id}")
async def get_conversion_status(job_id: str):
    """Get conversion status for a job"""
    if job_id not in conversion_status:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return conversion_status[job_id]

@app.get("/download/{job_id}")
async def download_converted_file(job_id: str):
    """Download the converted file"""
    if job_id not in conversion_status:
        raise HTTPException(status_code=404, detail="Job not found")
    
    status = conversion_status[job_id]
    
    if status.status != "completed":
        raise HTTPException(status_code=400, detail="Conversion not completed")
    
    if not status.output_file or not Path(status.output_file).exists():
        raise HTTPException(status_code=404, detail="Output file not found")
    
    return FileResponse(
        status.output_file,
        filename=Path(status.output_file).name,
        media_type="application/octet-stream"
    )

async def perform_conversion(job_id: str, input_path: str, output_format: str, load_geometry: bool):
    """Perform the actual conversion in background"""
    try:
        # Update status
        conversion_status[job_id].status = "processing"
        conversion_status[job_id].progress = 0.1
        conversion_status[job_id].message = "Starting conversion..."
        
        # Find wrapper executable
        wrapper_paths = [
            Path("jt_converter_wrapper.exe"),
            Path("build_glb/bin/Release/jt_converter_wrapper.exe"),
            Path("build_real/bin/Release/jt_converter_wrapper.exe")
        ]
        
        wrapper_path = None
        for path in wrapper_paths:
            if path.exists():
                wrapper_path = path
                break
        
        if not wrapper_path:
            raise Exception("JT converter wrapper not found")
        
        # Create temporary output file
        output_ext = "glb" if output_format == "glb" else "gltf"
        with tempfile.NamedTemporaryFile(suffix=f".{output_ext}", delete=False) as tmp:
            output_path = tmp.name
        
        conversion_status[job_id].progress = 0.3
        conversion_status[job_id].message = "Running JT converter..."
        
        # Run conversion
        cmd = [str(wrapper_path), input_path, output_path]
        print(f"Running conversion: {' '.join(cmd)}")
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        conversion_status[job_id].progress = 0.8
        conversion_status[job_id].message = "Processing output..."
        
        if result.returncode != 0:
            raise Exception(f"Conversion failed: {result.stderr}")
        
        # Check if output file was created
        if not Path(output_path).exists():
            raise Exception("Output file was not created")
        
        # Get file size
        file_size = Path(output_path).stat().st_size
        
        # Update status
        conversion_status[job_id].status = "completed"
        conversion_status[job_id].progress = 1.0
        conversion_status[job_id].message = "Conversion completed successfully"
        conversion_status[job_id].output_file = output_path
        conversion_status[job_id].file_size = file_size
        
        print(f"Conversion completed: {output_path} ({file_size} bytes)")
        
    except subprocess.TimeoutExpired:
        conversion_status[job_id].status = "failed"
        conversion_status[job_id].message = "Conversion timed out"
    except Exception as e:
        conversion_status[job_id].status = "failed"
        conversion_status[job_id].message = f"Conversion failed: {str(e)}"
        print(f"Conversion error: {e}")

@app.get("/help")
async def get_help():
    """Get help information"""
    return {
        "title": "JT Conversion Server Help",
        "description": "Convert JT files to GLTF/GLB format for web viewing",
        "usage": {
            "convert": {
                "method": "POST",
                "url": "/convert",
                "body": {
                    "input_path": "path/to/file.jt",
                    "output_format": "glb",  # or "gltf"
                    "load_geometry": True
                }
            },
            "check_status": {
                "method": "GET",
                "url": "/status/{job_id}"
            },
            "download": {
                "method": "GET",
                "url": "/download/{job_id}"
            }
        },
        "examples": {
            "convert_to_glb": {
                "curl": "curl -X POST http://localhost:8000/convert -H 'Content-Type: application/json' -d '{\"input_path\": \"/path/to/file.jt\", \"output_format\": \"glb\"}'"
            },
            "check_status": {
                "curl": "curl http://localhost:8000/status/job_1234567890"
            },
            "download": {
                "curl": "curl -O http://localhost:8000/download/job_1234567890"
            }
        },
        "formats": {
            "glb": {
                "description": "Binary GLTF format - single file with embedded data",
                "advantages": ["Smaller file size", "Faster loading", "Better for web"],
                "use_case": "Recommended for web viewers"
            },
            "gltf": {
                "description": "JSON GLTF format with separate binary files",
                "advantages": ["Human readable", "Easier debugging"],
                "use_case": "Development and debugging"
            }
        }
    }

if __name__ == "__main__":
    print("JT Conversion Server v2.0")
    print("=========================")
    print("Features:")
    print("- GLB binary format support")
    print("- Complete JT data extraction")
    print("- Background processing")
    print("- File size optimization")
    print("")
    print("Starting server on http://localhost:8000")
    print("API documentation: http://localhost:8000/docs")
    print("")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
