from flask import request
from ..socket_manager import socketio
import logging

logger = logging.getLogger(__name__)

@socketio.on('connect')
def handle_connect():
    logger.info(f"Client connected: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"Client disconnected: {request.sid}")

@socketio.on('subscribe')
def handle_subscribe(data):
    """Allow client to subscribe to task updates (room = task_id)."""
    task_id = data.get('task_id')
    if task_id:
        from flask_socketio import join_room
        join_room(task_id)
        logger.info(f"Client {request.sid} subscribed to {task_id}")
