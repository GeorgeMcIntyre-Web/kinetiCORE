from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
import os
import logging
from ..utils.file_manager import FileManager
from ..utils.hashing import calculate_file_hash, get_cache_path
from ..models.task_models import ConversionRequest
from ..converter.usd_to_gltf import UsdToGltfConverter
import asyncio
import threading

logger = logging.getLogger(__name__)
upload_bp = Blueprint('upload', __name__)

# Simple in-memory task queue for MVP (replace with Redis/RQ in full prod)
tasks = {}

from ..socket_manager import emit_progress

def process_conversion(task_id, input_path, output_path, options):
    """Background conversion task."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    emit_progress(task_id, 10.0, "Initializing conversion...")
    
    converter = UsdToGltfConverter()
    # Note: In a real implementation, the converter would accept a progress callback
    success = loop.run_until_complete(converter.convert(input_path, output_path, options))
    
    tasks[task_id]['status'] = 'completed' if success else 'failed'
    tasks[task_id]['progress'] = 100.0
    
    if success:
        result_url = f"/cache/{os.path.basename(output_path)}"
        tasks[task_id]['result_url'] = result_url
        emit_progress(task_id, 100.0, "Conversion completed")
    else:
        emit_progress(task_id, 100.0, "Conversion failed")

@upload_bp.route('/convert', methods=['POST'])
def convert():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
        
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'No filename'}), 400

    # 1. Save to Temp
    fm = FileManager()
    temp_path = fm.get_temp_file(suffix=os.path.splitext(file.filename)[1])
    file.save(temp_path)
    
    # 2. Calculate Hash
    file_hash = calculate_file_hash(temp_path)
    
    # 3. Check Cache
    cache_dir = os.path.join(os.getcwd(), '.cache')
    os.makedirs(cache_dir, exist_ok=True)
    cached_glb = get_cache_path(cache_dir, file_hash, '.glb')
    
    if os.path.exists(cached_glb):
        return jsonify({
            'task_id': 'cached',
            'status': 'completed',
            'result_url': f"/cache/{file_hash}.glb",
            'metadata_url': f"/cache/{file_hash}.kineti.json"
        })

    # 4. Queue Task
    task_id = file_hash # Use hash as task ID for simplicity in MVP
    tasks[task_id] = {'status': 'processing', 'progress': 0.0}
    
    thread = threading.Thread(target=process_conversion, args=(task_id, temp_path, cached_glb, {}))
    thread.start()
    
    return jsonify({
        'task_id': task_id,
        'status': 'processing'
    })
