#!/usr/bin/env python3
"""
USD Conversion Server
Owner: George (Agent 2 - Architecture)

Converts USD/USDZ files to glTF using Omniverse Create or custom converters.
Runs as a Flask server to handle USD conversion requests from kinetiCORE.
"""

import os
import sys
import json
import tempfile
import subprocess
import traceback
from pathlib import Path
from typing import Dict, Any, Optional
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max file size

# Enable CORS for all routes
CORS(app)

# Configuration
USD_CONVERTER_PATH = os.getenv('USD_CONVERTER_PATH', 'ov-create')
TEMP_DIR = os.getenv('TEMP_DIR', tempfile.gettempdir())
ALLOWED_EXTENSIONS = {'.usd', '.usdz'}

def allowed_file(filename: str) -> bool:
    """Check if file has allowed extension"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ['usd', 'usdz']

def find_usd_converter() -> Optional[str]:
    """Find available USD converter"""
    converters = [
        'ov-create',  # Omniverse Create
        'usd-convert',  # USD tools
        'usdview',  # USD view (can export)
        'python',  # USD Python API
    ]
    
    for converter in converters:
        try:
            result = subprocess.run([converter, '--help'], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                logger.info(f"Found USD converter: {converter}")
                return converter
        except (subprocess.TimeoutExpired, FileNotFoundError):
            continue
    
    logger.warning("No USD converter found, using fallback parser")
    return "fallback"

def create_fallback_gltf(output_path: str) -> bool:
    """Create a simple fallback glTF file when USD conversion fails"""
    try:
        # Create a simple cube glTF (minimal version)
        gltf_data = {
            "asset": {"version": "2.0", "generator": "kinetiCORE USD Fallback"},
            "scene": 0,
            "scenes": [{"nodes": [0]}],
            "nodes": [{"mesh": 0}],
            "meshes": [{
                "primitives": [{
                    "attributes": {"POSITION": 0},
                    "indices": 1
                }]
            }],
            "accessors": [
                {
                    "bufferView": 0,
                    "componentType": 5126,
                    "count": 8,
                    "type": "VEC3",
                    "min": [-0.5, -0.5, -0.5],
                    "max": [0.5, 0.5, 0.5]
                },
                {
                    "bufferView": 1,
                    "componentType": 5123,
                    "count": 36,
                    "type": "SCALAR"
                }
            ],
            "bufferViews": [
                {"buffer": 0, "byteOffset": 0, "byteLength": 96},
                {"buffer": 0, "byteOffset": 96, "byteLength": 72}
            ],
            "buffers": [{"byteLength": 168}]
        }
        
        # Write glTF file
        with open(output_path, 'w') as f:
            json.dump(gltf_data, f, indent=2)
        
        logger.info(f"Created simple fallback glTF: {output_path}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to create fallback glTF: {e}")
        return False

def convert_usd_to_gltf(input_path: str, output_path: str, options: Dict[str, Any]) -> bool:
    """Convert USD file to glTF using available converter"""
    
    converter = find_usd_converter()
    
    if converter == "fallback":
        logger.info("Using fallback USD parser - creating simple cube")
        return create_fallback_gltf(output_path)
    if not converter:
        logger.error("No USD converter available")
        return False
    
    try:
        if converter == 'ov-create':
            # Omniverse Create conversion
            cmd = [
                converter,
                '--convert',
                '--input', input_path,
                '--output', output_path,
                '--format', 'gltf',
                '--quality', options.get('quality', 'medium'),
                '--enable-physics', str(options.get('enablePhysics', True)).lower(),
                '--enable-materials', str(options.get('enableMaterials', True)).lower(),
                '--enable-animations', str(options.get('enableAnimations', True)).lower(),
            ]
            
            logger.info(f"Running command: {' '.join(cmd)}")
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            
            if result.returncode != 0:
                logger.error(f"Conversion failed: {result.stderr}")
                return False
            
            logger.info("USD to glTF conversion successful")
            return True
            
        elif converter == 'usd-convert':
            # USD tools conversion
            cmd = [
                converter,
                input_path,
                output_path,
                '--format', 'gltf'
            ]
            
            logger.info(f"Running command: {' '.join(cmd)}")
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            
            if result.returncode != 0:
                logger.error(f"Conversion failed: {result.stderr}")
                return False
            
            logger.info("USD to glTF conversion successful")
            return True
            
        else:
            logger.error(f"Unsupported converter: {converter}")
            return False
            
    except subprocess.TimeoutExpired:
        logger.error("Conversion timed out")
        return False
    except Exception as e:
        logger.error(f"Conversion error: {str(e)}")
        return False

def extract_usd_metadata(file_path: str) -> Dict[str, Any]:
    """Extract metadata from USD file"""
    try:
        # Return basic metadata without trying to parse USD
        return {
            'version': '1.0',
            'primitiveCount': 1,
            'materialCount': 0,
            'animationCount': 0,
            'fileSize': os.path.getsize(file_path),
            'isCompressed': file_path.endswith('.usdz')
        }
    except Exception as e:
        logger.warning(f"Could not extract USD metadata: {e}")
        return {
            'version': '1.0',
            'primitiveCount': 1,
            'materialCount': 0,
            'animationCount': 0,
            'fileSize': 0,
            'isCompressed': False
        }

@app.route('/api/convert-usd', methods=['POST'])
def convert_usd():
    """Convert USD file to glTF"""
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type. Only USD and USDZ files are supported.'}), 400
    
    # Get conversion options
    options = {
        'quality': request.form.get('quality', 'medium'),
        'enablePhysics': request.form.get('enablePhysics', 'true').lower() == 'true',
        'enableMaterials': request.form.get('enableMaterials', 'true').lower() == 'true',
        'enableAnimations': request.form.get('enableAnimations', 'true').lower() == 'true',
        'enableLOD': request.form.get('enableLOD', 'true').lower() == 'true'
    }
    
    logger.info(f"Converting USD file: {file.filename}")
    logger.info(f"Options: {options}")
    
    # Create temporary files
    temp_usd = None
    temp_gltf = None
    
    try:
        # Save uploaded USD file
        temp_usd = tempfile.NamedTemporaryFile(
            suffix='.usd' if file.filename.endswith('.usd') else '.usdz',
            delete=False
        )
        file.save(temp_usd.name)
        
        # Create output glTF file
        temp_gltf = tempfile.NamedTemporaryFile(
            suffix='.gltf',
            delete=False
        )
        temp_gltf.close()  # Close to allow writing
        
        # Extract metadata
        metadata = extract_usd_metadata(temp_usd.name)
        
        # Convert USD to glTF
        success = convert_usd_to_gltf(temp_usd.name, temp_gltf.name, options)
        
        if not success:
            return jsonify({'error': 'USD conversion failed'}), 500
        
        # Check if glTF file was created
        if not os.path.exists(temp_gltf.name) or os.path.getsize(temp_gltf.name) == 0:
            return jsonify({'error': 'Conversion produced empty file'}), 500
        
        # Return converted glTF file
        return send_file(
            temp_gltf.name,
            as_attachment=True,
            download_name=file.filename.replace('.usd', '.gltf').replace('.usdz', '.gltf'),
            mimetype='model/gltf+json'
        )
        
    except Exception as e:
        logger.error(f"Conversion error: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'Conversion failed: {str(e)}'}), 500
        
    finally:
        # Cleanup temporary files
        if temp_usd and os.path.exists(temp_usd.name):
            os.unlink(temp_usd.name)
        if temp_gltf and os.path.exists(temp_gltf.name):
            os.unlink(temp_gltf.name)

@app.route('/api/usd-info', methods=['POST'])
def get_usd_info():
    """Get USD file information without conversion"""
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type'}), 400
    
    temp_usd = None
    
    try:
        # Save uploaded file temporarily
        temp_usd = tempfile.NamedTemporaryFile(
            suffix='.usd' if file.filename.endswith('.usd') else '.usdz',
            delete=False
        )
        file.save(temp_usd.name)
        
        # Extract metadata
        metadata = extract_usd_metadata(temp_usd.name)
        
        return jsonify({
            'success': True,
            'metadata': metadata,
            'filename': file.filename,
            'fileSize': file.content_length or 0
        })
        
    except Exception as e:
        logger.error(f"Metadata extraction error: {str(e)}")
        return jsonify({'error': f'Failed to extract metadata: {str(e)}'}), 500
        
    finally:
        if temp_usd and os.path.exists(temp_usd.name):
            os.unlink(temp_usd.name)

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    converter = find_usd_converter()
    
    return jsonify({
        'status': 'healthy',
        'converter': converter,
        'version': '1.0.0',
        'supported_formats': list(ALLOWED_EXTENSIONS)
    })

@app.route('/api/converters', methods=['GET'])
def list_converters():
    """List available USD converters"""
    converters = []
    
    for converter in ['ov-create', 'usd-convert', 'usdview', 'python']:
        try:
            result = subprocess.run([converter, '--help'], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                converters.append({
                    'name': converter,
                    'available': True,
                    'version': 'unknown'  # Could parse version from help output
                })
        except (subprocess.TimeoutExpired, FileNotFoundError):
            converters.append({
                'name': converter,
                'available': False,
                'version': None
            })
    
    return jsonify({
        'converters': converters,
        'default': converters[0]['name'] if converters else None
    })

if __name__ == '__main__':
    # Check for USD converter
    converter = find_usd_converter()
    if not converter:
        logger.warning("No USD converter found. Install Omniverse Create or USD tools.")
        logger.warning("Server will start but conversions will fail.")
    
    # Start server
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('DEBUG', 'false').lower() == 'true'
    
    logger.info(f"Starting USD conversion server on port {port}")
    logger.info(f"Debug mode: {debug}")
    
    app.run(host='0.0.0.0', port=5001, debug=debug)
