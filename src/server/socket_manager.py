from flask_socketio import SocketIO

socketio = SocketIO(cors_allowed_origins="*")

def emit_progress(task_id: str, progress: float, message: str):
    """Emit progress update to clients."""
    socketio.emit('progress', {
        'task_id': task_id,
        'progress': progress,
        'message': message
    })
