import pytest
import os
import json
import tempfile
from ..app import app, socketio
from ..utils.hashing import calculate_file_hash

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_health_check(client):
    rv = client.get('/health')
    assert rv.status_code == 200
    assert rv.json['status'] == 'healthy'

def test_upload_and_conversion(client):
    # Create a dummy USD file
    with tempfile.NamedTemporaryFile(suffix='.usd', delete=False) as tf:
        tf.write(b"dummy usd content")
        tf_path = tf.name
    
    try:
        data = {
            'file': (open(tf_path, 'rb'), 'test.usd')
        }
        rv = client.post('/api/convert', data=data, content_type='multipart/form-data')
        
        assert rv.status_code == 200
        json_data = rv.json
        assert 'task_id' in json_data
        assert json_data['status'] in ['processing', 'completed']
        
        # Verify cache existence (mock converter creates it)
        # In a real test we'd wait for the thread, but here we just check the response structure
        
    finally:
        os.unlink(tf_path)

def test_caching_mechanism(client):
    # Test that uploading the same file twice returns cached result
    content = b"unique content for caching test"
    with tempfile.NamedTemporaryFile(suffix='.usd', delete=False) as tf:
        tf.write(content)
        tf_path = tf.name
        
    try:
        # First upload
        data1 = {'file': (open(tf_path, 'rb'), 'cache_test.usd')}
        rv1 = client.post('/api/convert', data=data1, content_type='multipart/form-data')
        task_id1 = rv1.json['task_id']
        
        # Wait a bit for the thread (in a real test)
        import time
        time.sleep(0.2)
        
        # Second upload
        data2 = {'file': (open(tf_path, 'rb'), 'cache_test.usd')}
        rv2 = client.post('/api/convert', data=data2, content_type='multipart/form-data')
        
        assert rv2.json['task_id'] == task_id1 or rv2.json['task_id'] == 'cached'
        
    finally:
        os.unlink(tf_path)
