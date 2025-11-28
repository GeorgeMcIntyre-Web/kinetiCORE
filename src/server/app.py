from flask import Flask
from flask_cors import CORS
import logging
import os

from .routes.upload import upload_bp
from .routes.cache import cache_bp
from .socket_manager import socketio
import src.server.routes.progress # Register handlers

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_app():
    app = Flask(__name__)
    CORS(app)
    
    # Config
    app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024 # 500 MB
    app.config['UPLOAD_FOLDER'] = os.path.join(os.getcwd(), 'temp_uploads')
    
    # Register Blueprints
    app.register_blueprint(upload_bp, url_prefix='/api')
    app.register_blueprint(cache_bp, url_prefix='/cache')
    
    @app.route('/health')
    def health():
        return {'status': 'healthy', 'backend': 'production-mvp'}

    socketio.init_app(app)
    return app

app = create_app()

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5001)
