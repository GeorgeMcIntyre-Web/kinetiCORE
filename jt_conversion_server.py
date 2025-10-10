#!/usr/bin/env python3
"""
JT Conversion Server using C++ Wrapper
Replaces PyOpenJt with a more reliable C++ implementation using lineSim JT libraries
"""

import os
import sys
import subprocess
import tempfile
import json
import asyncio
from pathlib import Path
from typing import Optional, Dict, Any
import logging

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="JT Conversion Server (C++ Wrapper)",
    description="Convert JT files to GLTF using lineSim JT libraries",
    version="2.0.0"
)

class JTConverterWrapper:
    def __init__(self):
        self.wrapper_path = self._find_wrapper_executable()
        self.temp_dir = Path(tempfile.gettempdir()) / "jt_converter"
        self.temp_dir.mkdir(exist_ok=True)
        
    def _find_wrapper_executable(self) -> Optional[Path]:
        """Find the C++ wrapper executable"""
        possible_paths = [
            Path("jt_converter_wrapper.exe"),
            Path("bin/jt_converter_wrapper.exe"),
            Path("build/bin/jt_converter_wrapper.exe"),
            Path("jt_converter_wrapper"),
            Path("bin/jt_converter_wrapper"),
            Path("build/bin/jt_converter_wrapper"),
        ]
        
        for path in possible_paths:
            if path.exists() and path.is_file():
                logger.info(f"Found JT converter wrapper at: {path.absolute()}")
                return path.absolute()
        
        logger.warning("JT converter wrapper executable not found")
        return None
    
    async def convert_jt_to_gltf(
        self, 
        jt_file_path: Path, 
        output_path: Path,
        load_geometry: bool = True
    ) -> bool:
        """Convert JT file to GLTF using C++ wrapper"""
        
        if not self.wrapper_path:
            raise RuntimeError("JT converter wrapper not found")
        
        if not jt_file_path.exists():
            raise FileNotFoundError(f"JT file not found: {jt_file_path}")
        
        # Prepare command
        cmd = [
            str(self.wrapper_path),
            str(jt_file_path),
            str(output_path)
        ]
        
        if not load_geometry:
            cmd.append("--no-geometry")
        
        logger.info(f"Running command: {' '.join(cmd)}")
        
        try:
            # Run the C++ wrapper
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            logger.info(f"Wrapper stdout: {result.stdout}")
            if result.stderr:
                logger.warning(f"Wrapper stderr: {result.stderr}")
            
            if result.returncode != 0:
                logger.error(f"Wrapper failed with return code: {result.returncode}")
                return False
            
            # Check if output file was created
            if not output_path.exists():
                logger.error("Output GLTF file was not created")
                return False
            
            logger.info(f"Conversion successful: {output_path}")
            return True
            
        except subprocess.TimeoutExpired:
            logger.error("Conversion timed out after 5 minutes")
            return False
        except Exception as e:
            logger.error(f"Conversion failed with exception: {e}")
            return False

# Global converter instance
converter = JTConverterWrapper()

@app.get("/")
async def root():
    """Root endpoint with server info"""
    return {
        "service": "JT Conversion Server (C++ Wrapper)",
        "version": "2.0.0",
        "status": "running",
        "wrapper_available": converter.wrapper_path is not None,
        "wrapper_path": str(converter.wrapper_path) if converter.wrapper_path else None
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    wrapper_available = converter.wrapper_path is not None
    
    if wrapper_available:
        status = "healthy"
        message = "JT converter wrapper is available and ready"
    else:
        status = "unhealthy"
        message = "JT converter wrapper executable not found"
    
    return {
        "status": status,
        "wrapper_available": wrapper_available,
        "wrapper_path": str(converter.wrapper_path) if converter.wrapper_path else None,
        "message": message,
        "supported_formats": [".jt"],
        "output_formats": [".gltf", ".glb"]
    }

@app.post("/convert/jt-to-gltf")
async def convert_jt_to_gltf(
    file: UploadFile = File(...),
    load_geometry: bool = True
):
    """Convert JT file to GLTF format"""
    
    if not converter.wrapper_path:
        raise HTTPException(
            status_code=503,
            detail="JT converter wrapper not available. Please ensure jt_converter_wrapper.exe is built and available."
        )
    
    # Validate file type
    if not file.filename.lower().endswith('.jt'):
        raise HTTPException(
            status_code=400,
            detail="File must be a .jt file"
        )
    
    # Create temporary files
    temp_jt = converter.temp_dir / f"input_{file.filename}"
    temp_gltf = converter.temp_dir / f"output_{file.filename.replace('.jt', '.gltf')}"
    
    try:
        # Save uploaded file
        with open(temp_jt, "wb") as f:
            content = await file.read()
            f.write(content)
        
        logger.info(f"Saved uploaded file: {temp_jt} ({len(content)} bytes)")
        
        # Convert using C++ wrapper
        success = await converter.convert_jt_to_gltf(
            temp_jt, 
            temp_gltf, 
            load_geometry
        )
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="JT to GLTF conversion failed. Check server logs for details."
            )
        
        # Return the converted file
        return FileResponse(
            temp_gltf,
            media_type='model/gltf+json',
            filename=f"{Path(file.filename).stem}.gltf",
            background=lambda: cleanup_files(temp_jt, temp_gltf)
        )
        
    except Exception as e:
        # Clean up files on error
        cleanup_files(temp_jt, temp_gltf)
        logger.error(f"Conversion error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Conversion failed: {str(e)}"
        )

@app.post("/convert/jt-to-glb")
async def convert_jt_to_glb(
    file: UploadFile = File(...),
    load_geometry: bool = True
):
    """Convert JT file to GLB format (binary GLTF)"""
    
    if not converter.wrapper_path:
        raise HTTPException(
            status_code=503,
            detail="JT converter wrapper not available"
        )
    
    # Validate file type
    if not file.filename.lower().endswith('.jt'):
        raise HTTPException(
            status_code=400,
            detail="File must be a .jt file"
        )
    
    # Create temporary files
    temp_jt = converter.temp_dir / f"input_{file.filename}"
    temp_gltf = converter.temp_dir / f"output_{file.filename.replace('.jt', '.gltf')}"
    temp_glb = converter.temp_dir / f"output_{file.filename.replace('.jt', '.glb')}"
    
    try:
        # Save uploaded file
        with open(temp_jt, "wb") as f:
            content = await file.read()
            f.write(content)
        
        logger.info(f"Saved uploaded file: {temp_jt} ({len(content)} bytes)")
        
        # Convert JT to GLTF first
        success = await converter.convert_jt_to_gltf(
            temp_jt, 
            temp_gltf, 
            load_geometry
        )
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="JT to GLTF conversion failed"
            )
        
        # Convert GLTF to GLB using gltf-pipeline or similar
        # For now, we'll return the GLTF file as GLB
        # In production, you'd use a proper GLTF to GLB converter
        
        # Copy GLTF to GLB (placeholder - should use proper converter)
        import shutil
        shutil.copy2(temp_gltf, temp_glb)
        
        # Return the GLB file
        return FileResponse(
            temp_glb,
            media_type='model/gltf-binary',
            filename=f"{Path(file.filename).stem}.glb",
            background=lambda: cleanup_files(temp_jt, temp_gltf, temp_glb)
        )
        
    except Exception as e:
        # Clean up files on error
        cleanup_files(temp_jt, temp_gltf, temp_glb)
        logger.error(f"Conversion error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Conversion failed: {str(e)}"
        )

def cleanup_files(*paths):
    """Clean up temporary files"""
    for path in paths:
        try:
            if path and Path(path).exists():
                Path(path).unlink()
                logger.debug(f"Cleaned up: {path}")
        except Exception as e:
            logger.warning(f"Failed to clean up {path}: {e}")

@app.get("/info")
async def get_info():
    """Get detailed server information"""
    return {
        "server": "JT Conversion Server (C++ Wrapper)",
        "version": "2.0.0",
        "wrapper_available": converter.wrapper_path is not None,
        "wrapper_path": str(converter.wrapper_path) if converter.wrapper_path else None,
        "temp_directory": str(converter.temp_dir),
        "supported_input_formats": [".jt"],
        "supported_output_formats": [".gltf", ".glb"],
        "features": [
            "JT file loading",
            "Geometry extraction",
            "Material support",
            "Hierarchy preservation",
            "GLTF/GLB output"
        ],
        "libraries_used": [
            "JT Open Toolkit",
            "lineSim JtReader",
            "TinyGLTF"
        ]
    }

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 JT Conversion Server (C++ Wrapper)")
    print("=" * 60)
    print(f"📍 Server:     http://localhost:8000")
    print(f"📖 Docs:       http://localhost:8000/docs")
    print(f"🔧 Wrapper:    {converter.wrapper_path}")
    print(f"📁 Temp Dir:   {converter.temp_dir}")
    print("=" * 60)
    
    if not converter.wrapper_path:
        print("⚠️  WARNING: JT converter wrapper not found!")
        print("   Please build jt_converter_wrapper.exe first")
        print("   Run: cmake --build . --config Release")
        print("=" * 60)
    
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
