from flask import Blueprint, send_from_directory
import os

cache_bp = Blueprint('cache', __name__)

@cache_bp.route('/<path:filename>')
def serve_cache(filename):
    cache_dir = os.path.join(os.getcwd(), '.cache')
    return send_from_directory(cache_dir, filename)
