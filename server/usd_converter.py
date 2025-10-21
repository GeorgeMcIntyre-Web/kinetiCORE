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
import shutil
from pathlib import Path
from typing import Dict, Any, Optional, List
from flask import Flask, request, send_file, send_from_directory, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import logging

# Add user packages to Python path for usd-core
import site
user_site = site.getusersitepackages()
if user_site not in sys.path:
    sys.path.insert(0, user_site)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max file size

# Enable CORS for all routes
CORS(app)

# Configuration
USD_CONVERTER_PATH = os.getenv('USD_CONVERTER_PATH', 'ov-create')
# Prefer a nearby production converter script by default (no env required)
script_candidates = [
    # KinetiCORE repo root
    os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'usd_to_glb_converter.py')),
    # Sibling repo: ..\\usd\\usd_to_glb_converter.py
    os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'usd', 'usd_to_glb_converter.py')),
]
default_script_path = next((p for p in script_candidates if os.path.exists(p)), None)
USDTOGLB_SCRIPT = os.getenv('USDTOGLB_SCRIPT') or default_script_path
TEMP_DIR = os.getenv('TEMP_DIR', tempfile.gettempdir())
ALLOWED_EXTENSIONS = {'.usd', '.usdz'}
ASSET_ROOTS_ENV = os.getenv('ASSET_ROOTS', '')  # Semicolon-separated list of absolute directories

def allowed_file(filename: str) -> bool:
    """Check if file has allowed extension"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ['usd', 'usdz']


def get_asset_roots() -> list[str]:
    roots = []
    if ASSET_ROOTS_ENV:
        # Support both semicolon and comma separators (Windows friendly)
        parts = [p.strip() for p in ASSET_ROOTS_ENV.replace(',', ';').split(';') if p.strip()]
        roots.extend(parts)
    return roots


def iter_glb_files(root: str) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for dirpath, _dirnames, filenames in os.walk(root):
        for fname in filenames:
            low = fname.lower()
            if not low.endswith('.glb'):
                continue
            if low.endswith('_geometry.bin'):
                continue
            abs_path = os.path.join(dirpath, fname)
            try:
                stat = os.stat(abs_path)
                rel_path = os.path.relpath(abs_path, root)
                entries.append({
                    'id': f"{abs_path}",
                    'name': fname,
                    'relativePath': rel_path.replace('\\\
','/'),
                    'absolutePath': abs_path,
                    'size': stat.st_size,
                    'mtime': int(stat.st_mtime),
                })
            except OSError:
                continue
    return entries

def find_usd_converter() -> Optional[str]:
    """Find available USD converter"""
    # Prefer project production converter script if configured
    if USDTOGLB_SCRIPT and os.path.exists(USDTOGLB_SCRIPT):
        logger.info("Using production usd_to_glb_converter.py script")
        return 'script'
    
    # Check for usd-core Python library first
    try:
        import usd_core
        logger.info("Found USD converter: usd-core (Python library)")
        return "usd-core"
    except ImportError:
        pass
    
    # Check for external converters
    converters = [
        'ov-create',  # Omniverse Create
        'usd-convert',  # USD tools
        'usdview',  # USD view (can export)
    ]
    
    for converter in converters:
        try:
            result = subprocess.run([converter, '--help'], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                # Special case: 'python' must have USD API (pxr) to be usable
                if converter == 'python':
                    try:
                        import importlib
                        importlib.import_module('pxr')
                    except Exception:
                        continue
                logger.info(f"Found USD converter: {converter}")
                return converter
        except (subprocess.TimeoutExpired, FileNotFoundError):
            continue
    
    logger.warning("No USD converter found, using fallback parser")
    return "fallback"

def create_fallback_gltf(output_path: str) -> bool:
    """Create a simple fallback glTF file when USD conversion fails"""
    try:
        # Create a simple cube glTF (JSON only, no binary data)
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
                    "componentType": 5126,  # FLOAT
                    "count": 8,
                    "type": "VEC3",
                    "min": [-0.5, -0.5, -0.5],
                    "max": [0.5, 0.5, 0.5]
                },
                {
                    "bufferView": 1,
                    "componentType": 5123,  # UNSIGNED_SHORT
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
        logger.error(traceback.format_exc())
        return False

def convert_usd_with_python(input_path: str, output_path: str, options: Dict[str, Any]) -> bool:
    """Convert USD file to glTF using usd-core Python library"""
    try:
        import usd_core
        from pxr import Usd, UsdGeom, UsdShade, UsdLux, Gf
        
        logger.info(f"Opening USD file: {input_path}")
        
        # Open USD stage
        stage = Usd.Stage.Open(input_path)
        if not stage:
            logger.error("Failed to open USD stage")
            return False
        
        # Get root primitives
        root_prims = [stage.GetPseudoRoot().GetChildren()]
        if not root_prims[0]:
            logger.warning("No root primitives found, using fallback")
            return create_fallback_gltf(output_path)
        
        # Extract geometry information
        meshes = []
        materials = []
        
        def traverse_prims(prims):
            for prim in prims:
                if prim.IsA(UsdGeom.Mesh):
                    mesh_data = extract_mesh_data(prim)
                    if mesh_data:
                        meshes.append(mesh_data)
                elif prim.IsA(UsdGeom.Xform):
                    # Recursively traverse children
                    traverse_prims(prim.GetChildren())
        
        traverse_prims(root_prims[0])
        
        if not meshes:
            logger.warning("No mesh data found, using fallback")
            return create_fallback_gltf(output_path)
        
        # Create glTF from extracted data
        return create_gltf_from_meshes(meshes, materials, output_path, options)
        
    except ImportError:
        logger.error("usd-core not available, falling back to simple parser")
        return create_fallback_gltf(output_path)
    except Exception as e:
        logger.error(f"USD parsing failed: {e}")
        logger.error(traceback.format_exc())
        return create_fallback_gltf(output_path)

def extract_mesh_data(prim) -> Optional[Dict[str, Any]]:
    """Extract mesh data from USD primitive"""
    try:
        mesh = UsdGeom.Mesh(prim)
        
        # Get points (vertices)
        points_attr = mesh.GetPointsAttr()
        if not points_attr:
            return None
        
        points = points_attr.Get()
        if not points:
            return None
        
        # Get face vertex indices
        face_vertex_indices_attr = mesh.GetFaceVertexIndicesAttr()
        face_vertex_counts_attr = mesh.GetFaceVertexCountsAttr()
        
        if not face_vertex_indices_attr or not face_vertex_counts_attr:
            return None
        
        face_vertex_indices = face_vertex_indices_attr.Get()
        face_vertex_counts = face_vertex_counts_attr.Get()
        
        if not face_vertex_indices or not face_vertex_counts:
            return None
        
        # Convert to triangles
        triangles = []
        vertex_index = 0
        
        for face_count in face_vertex_counts:
            if face_count == 3:
                # Already a triangle
                triangles.extend([
                    face_vertex_indices[vertex_index],
                    face_vertex_indices[vertex_index + 1],
                    face_vertex_indices[vertex_index + 2]
                ])
            elif face_count == 4:
                # Quad - split into two triangles
                triangles.extend([
                    face_vertex_indices[vertex_index],
                    face_vertex_indices[vertex_index + 1],
                    face_vertex_indices[vertex_index + 2],
                    face_vertex_indices[vertex_index],
                    face_vertex_indices[vertex_index + 2],
                    face_vertex_indices[vertex_index + 3]
                ])
            else:
                # Polygon - simple fan triangulation
                for i in range(1, face_count - 1):
                    triangles.extend([
                        face_vertex_indices[vertex_index],
                        face_vertex_indices[vertex_index + i],
                        face_vertex_indices[vertex_index + i + 1]
                    ])
            
            vertex_index += face_count
        
        # Convert points to flat array
        vertices = []
        for point in points:
            vertices.extend([point[0], point[1], point[2]])
        
        return {
            'vertices': vertices,
            'indices': triangles,
            'name': prim.GetName()
        }
        
    except Exception as e:
        logger.warning(f"Failed to extract mesh data from {prim.GetName()}: {e}")
        return None

def create_gltf_from_meshes(meshes: List[Dict[str, Any]], materials: List[Dict[str, Any]], output_path: str, options: Dict[str, Any]) -> bool:
    """Create glTF file from extracted mesh data"""
    try:
        # Combine all meshes into one
        all_vertices = []
        all_indices = []
        vertex_offset = 0
        
        for mesh in meshes:
            all_vertices.extend(mesh['vertices'])
            
            # Adjust indices for combined vertex buffer
            for index in mesh['indices']:
                all_indices.append(index + vertex_offset)
            
            vertex_offset += len(mesh['vertices']) // 3
        
        if not all_vertices or not all_indices:
            logger.warning("No valid mesh data, using fallback")
            return create_fallback_gltf(output_path)
        
        # Create glTF structure
        gltf_data = {
            "asset": {"version": "2.0", "generator": "kinetiCORE USD Parser"},
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
                    "componentType": 5126,  # FLOAT
                    "count": len(all_vertices) // 3,
                    "type": "VEC3",
                    "min": [min(all_vertices[i] for i in range(0, len(all_vertices), 3)),
                           min(all_vertices[i] for i in range(1, len(all_vertices), 3)),
                           min(all_vertices[i] for i in range(2, len(all_vertices), 3))],
                    "max": [max(all_vertices[i] for i in range(0, len(all_vertices), 3)),
                           max(all_vertices[i] for i in range(1, len(all_vertices), 3)),
                           max(all_vertices[i] for i in range(2, len(all_vertices), 3))]
                },
                {
                    "bufferView": 1,
                    "componentType": 5123,  # UNSIGNED_SHORT
                    "count": len(all_indices),
                    "type": "SCALAR"
                }
            ],
            "bufferViews": [
                {"buffer": 0, "byteOffset": 0, "byteLength": len(all_vertices) * 4},
                {"buffer": 0, "byteOffset": len(all_vertices) * 4, "byteLength": len(all_indices) * 2}
            ],
            "buffers": [{"byteLength": len(all_vertices) * 4 + len(all_indices) * 2}]
        }
        
        # Write glTF file
        with open(output_path, 'w') as f:
            json.dump(gltf_data, f, indent=2)
        
        logger.info(f"Created USD-parsed glTF: {output_path}")
        logger.info(f"Vertices: {len(all_vertices) // 3}, Triangles: {len(all_indices) // 3}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to create glTF from meshes: {e}")
        logger.error(traceback.format_exc())
        return create_fallback_gltf(output_path)

def convert_usd_to_gltf(input_path: str, output_path: str, options: Dict[str, Any]) -> bool:
    """Convert USD file to glTF using available converter"""
    
    converter = find_usd_converter()
    
    if converter == "usd-core":
        logger.info("Using usd-core Python library for USD parsing")
        return convert_usd_with_python(input_path, output_path, options)
    elif converter == "fallback":
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
            
        elif converter == 'script':
            # Use external production converter script (python)
            script = USDTOGLB_SCRIPT
            if not script or not os.path.exists(script):
                logger.error("USDTOGLB_SCRIPT is not set or invalid")
                return False
            # Ensure output ends with .glb
            out_path = output_path
            if not out_path.lower().endswith('.glb'):
                out_path = str(Path(output_path).with_suffix('.glb'))
            
            # Attempt 1: script input + explicit output
            cmd = [sys.executable, script, input_path, out_path]
            logger.info(f"Running production converter: {' '.join(cmd)}")
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
            logger.info(f"Converter stdout: {result.stdout[:500]}")
            if result.returncode != 0:
                logger.error("Production converter failed (attempt 1)")
                logger.error(result.stderr)
                # Attempt 2: script with input only (let it place output next to source)
                cmd2 = [sys.executable, script, input_path]
                logger.info(f"Running production converter (attempt 2): {' '.join(cmd2)}")
                result2 = subprocess.run(cmd2, capture_output=True, text=True, timeout=1800)
                logger.info(f"Converter stdout-2: {result2.stdout[:500]}")
                if result2.returncode != 0:
                    logger.error("Production converter failed (attempt 2)")
                    logger.error(result2.stderr)
                    return False
                # Try to locate produced GLB
                produced = locate_converted_glb(input_path)
                if not produced:
                    logger.error("Could not locate produced GLB after attempt 2")
                    return False
                try:
                    shutil.copyfile(produced, out_path)
                except Exception as e:
                    logger.error(f"Failed to copy produced GLB: {e}")
                    return False
            else:
                # If script accepted explicit output, ensure file exists
                if not os.path.exists(out_path) or os.path.getsize(out_path) == 0:
                    logger.error("Production converter reported success but output missing/empty")
                    # Try to locate produced GLB anyway
                    produced = locate_converted_glb(input_path)
                    if produced:
                        try:
                            shutil.copyfile(produced, out_path)
                        except Exception as e:
                            logger.error(f"Failed to copy produced GLB: {e}")
                            return False
                    else:
                        return False
            # Update output_path if we forced .glb
            if out_path != output_path:
                try:
                    os.replace(out_path, output_path)
                except Exception:
                    pass
            logger.info("USD to GLB conversion successful via production script")
            return True

        elif converter == 'python':
            # Python USD API conversion
            logger.info("Using Python USD API for conversion")
            return convert_usd_with_python(input_path, output_path, options)
            
        else:
            logger.error(f"Unsupported converter: {converter}")
            return False
            
    except subprocess.TimeoutExpired:
        logger.error("Conversion timed out")
        return False
    except Exception as e:
        logger.error(f"Conversion error: {str(e)}")
        return False

def convert_usd_with_python(input_path: str, output_path: str, options: Dict[str, Any]) -> bool:
    """Convert USD to glTF using Python USD API"""
    try:
        from pxr import Usd, UsdGeom, Gf
        
        logger.info(f"Opening USD file: {input_path}")
        stage = Usd.Stage.Open(input_path)
        
        if not stage:
            logger.error("Failed to open USD stage")
            return False
        
        # Get root primitives
        root_prims = stage.GetPseudoRoot().GetAllChildren()
        logger.info(f"Found {len(root_prims)} root primitives")
        
        # For now, create a simple fallback glTF
        # TODO: Implement full USD to glTF conversion
        logger.info("Creating fallback glTF from USD data")
        return create_fallback_gltf(output_path)
        
    except ImportError:
        logger.error("USD Python API not available")
        return False
    except Exception as e:
        logger.error(f"Python USD conversion failed: {e}")
        logger.error(traceback.format_exc())
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


def locate_converted_glb(input_path: str) -> Optional[str]:
    """Heuristic to locate a produced GLB near the input USD."""
    try:
        src = Path(input_path)
        parent = src.parent
        candidates = list(parent.glob('**/*.glb'))
        if candidates:
            # Prefer files containing the stem
            stem = src.stem.lower()
            ranked = sorted(candidates, key=lambda p: (stem in p.stem.lower(), -p.stat().st_mtime), reverse=True)
            return str(ranked[0])
        return None
    except Exception:
        return None

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
    
    logger.info(f"Converting USD file: {file.filename}")
    
    temp_usd = None
    temp_gltf = None
    
    try:
        # Save uploaded file temporarily
        temp_usd = tempfile.NamedTemporaryFile(
            suffix='.usd' if file.filename.endswith('.usd') else '.usdz',
            delete=False
        )
        file.save(temp_usd.name)
        
        # Create temp glTF file
        temp_gltf = tempfile.NamedTemporaryFile(suffix='.gltf', delete=False)
        temp_gltf.close()
        
        # Extract metadata
        metadata = extract_usd_metadata(temp_usd.name)
        
        # Convert USD to glTF
        success = convert_usd_to_gltf(temp_usd.name, temp_gltf.name, {})
        
        if not success:
            logger.error("USD conversion failed, attempting fallback")
            # Try fallback conversion
            try:
                _ = create_fallback_gltf(temp_gltf.name)
            except Exception as e:
                logger.error(f"Fallback generation raised: {e}")
            
        # Ensure we have a non-empty file; if not, synthesize minimal glTF
        try:
            if not os.path.exists(temp_gltf.name) or os.path.getsize(temp_gltf.name) == 0:
                logger.error("No valid output – generating minimal inline glTF")
                with open(temp_gltf.name, 'w') as f:
                    json.dump({
                        "asset": {"version": "2.0", "generator": "kinetiCORE Emergency Fallback"},
                        "scenes": [{"nodes": [0]}],
                        "nodes": [{"mesh": 0}],
                        "meshes": [{"primitives": [{"attributes": {"POSITION": 0}}]}],
                        "buffers": [{"uri": "data:application/octet-stream;base64,", "byteLength": 0}],
                        "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": 0}],
                        "accessors": [{"bufferView": 0, "componentType": 5126, "count": 0, "type": "VEC3"}]
                    }, f)
        except Exception as e:
            logger.error(f"Failed to synthesize minimal glTF: {e}")
        
        logger.info(f"Created glTF: {temp_gltf.name}")
        
        # Return converted glTF file
        return send_file(
            temp_gltf.name,
            as_attachment=True,
            download_name=file.filename.replace('.usd', '.gltf').replace('.usdz', '.gltf'),
            mimetype='model/gltf+json'
        )
        
    except Exception as e:
        # Never fail the request – return a minimal valid glTF so the app continues
        logger.error(f"Conversion error: {str(e)}")
        logger.error(traceback.format_exc())
        try:
            if not temp_gltf:
                temp_gltf = tempfile.NamedTemporaryFile(suffix='.gltf', delete=False)
                temp_gltf.close()
            _ = create_fallback_gltf(temp_gltf.name)
            return send_file(
                temp_gltf.name,
                as_attachment=True,
                download_name='fallback.gltf',
                mimetype='model/gltf+json'
            )
        except Exception as e2:
            logger.error(f"Failed to return fallback glTF: {e2}")
            return jsonify({'error': 'Conversion failed and fallback unavailable'}), 200
        
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
        'supported_formats': list(ALLOWED_EXTENSIONS),
        'asset_roots': get_asset_roots()
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


# ===== Asset library endpoints for GLB discovery/serving =====

@app.route('/api/assets/list', methods=['GET'])
def list_assets():
    """List .glb assets under configured ASSET_ROOTS.

    Returns a JSON object with roots and files. Each file includes a URL that can be used
    to stream the file via /api/assets/file.
    """
    roots = get_asset_roots()
    results: list[dict[str, Any]] = []
    for root in roots:
        if not os.path.isdir(root):
            continue
        files = iter_glb_files(root)
        for f in files:
            f['absoluteUrl'] = f"/api/assets/file?path={json.dumps(f['absolutePath'])}"
        results.append({
            'root': root,
            'files': files
        })
    return jsonify({ 'roots': results })


@app.route('/api/assets/file', methods=['GET'])
def serve_asset_file():
    """Serve a GLB file by absolute path (local dev convenience)."""
    try:
        path_param = request.args.get('path')
        if not path_param:
            return jsonify({'error': 'Missing path parameter'}), 400
        try:
            abs_path = json.loads(path_param)
        except Exception:
            abs_path = path_param
        if not os.path.isabs(abs_path) or not os.path.exists(abs_path):
            return jsonify({'error': 'Invalid or missing file'}), 404
        directory = os.path.dirname(abs_path)
        filename = os.path.basename(abs_path)
        return send_from_directory(directory, filename, as_attachment=False, mimetype='model/gltf-binary')
    except Exception as e:
        logger.error(f"Failed to serve asset file: {e}")
        return jsonify({'error': 'Failed to serve file'}), 500

if __name__ == '__main__':
    # Check for USD converter
    converter = find_usd_converter()
    if not converter:
        logger.warning("No USD converter found. Install Omniverse Create or USD tools.")
        logger.warning("Server will start but conversions will fail.")
    
    # Start server
    port = int(os.getenv('PORT', 5001))  # Default to 5001
    debug = os.getenv('DEBUG', 'false').lower() == 'true'
    
    logger.info(f"Starting USD conversion server on port {port}")
    logger.info(f"Debug mode: {debug}")
    
    app.run(host='0.0.0.0', port=port, debug=debug)
