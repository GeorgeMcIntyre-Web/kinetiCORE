#!/usr/bin/env python3
"""
Asset Management API Server
Owner: George

Scalable backend system for managing kinetiCORE's asset library.
Supports MongoDB database, Cloudflare R2 storage, and comprehensive asset operations.
"""

import os
import sys
import json
import uuid
import hashlib
import mimetypes
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pymongo
from pymongo import MongoClient
from bson import ObjectId
import boto3
from botocore.exceptions import ClientError
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size

# Enable CORS for all routes
CORS(app)

# Configuration
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/kineticore_assets')
R2_ACCESS_KEY_ID = os.getenv('R2_ACCESS_KEY_ID')
R2_SECRET_ACCESS_KEY = os.getenv('R2_SECRET_ACCESS_KEY')
R2_BUCKET_NAME = os.getenv('R2_BUCKET_NAME', 'kineticore-assets')
R2_ENDPOINT_URL = os.getenv('R2_ENDPOINT_URL', 'https://your-account-id.r2.cloudflarestorage.com')

# Initialize MongoDB client
try:
    client = MongoClient(MONGODB_URI)
    db = client.kineticore_assets
    assets_collection = db.assets
    categories_collection = db.categories
    usage_collection = db.usage_stats
    logger.info("Connected to MongoDB")
except Exception as e:
    logger.error(f"Failed to connect to MongoDB: {e}")
    client = None
    db = None
    assets_collection = None
    categories_collection = None
    usage_collection = None

# Initialize R2 client
try:
    r2_client = boto3.client(
        's3',
        endpoint_url=R2_ENDPOINT_URL,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name='auto'
    )
    logger.info("Connected to Cloudflare R2")
except Exception as e:
    logger.error(f"Failed to connect to R2: {e}")
    r2_client = None

class AssetManager:
    """Main asset management class"""
    
    def __init__(self):
        self.assets_collection = assets_collection
        self.categories_collection = categories_collection
        self.usage_collection = usage_collection
        self.r2_client = r2_client
    
    def create_asset(self, asset_data: Dict[str, Any]) -> str:
        """Create a new asset"""
        try:
            # Generate unique ID
            asset_id = str(uuid.uuid4())
            
            # Prepare asset document
            asset_doc = {
                '_id': ObjectId(),
                'id': asset_id,
                'name': asset_data.get('name', ''),
                'manufacturer': asset_data.get('manufacturer'),
                'modelNumber': asset_data.get('modelNumber'),
                'version': asset_data.get('version'),
                
                # Classification
                'domain': asset_data.get('domain', 'custom'),
                'assetClass': asset_data.get('assetClass', 'structures'),
                'assetType': asset_data.get('assetType', 'generic'),
                
                # Files
                'loaderType': asset_data.get('loaderType', 'glb'),
                'filePath': asset_data.get('filePath', ''),
                'fileSize': asset_data.get('fileSize'),
                'thumbnail': asset_data.get('thumbnail'),
                
                # Capabilities
                'capabilities': asset_data.get('capabilities', {}),
                
                # Discovery
                'tags': asset_data.get('tags', []),
                'searchKeywords': asset_data.get('searchKeywords', []),
                'description': asset_data.get('description'),
                
                # Documentation
                'documentationUrl': asset_data.get('documentationUrl'),
                'specSheetUrl': asset_data.get('specSheetUrl'),
                
                # Sourcing
                'source': asset_data.get('source', 'local'),
                'vendor': asset_data.get('vendor'),
                
                # Asset Origin & Provenance
                'origin': asset_data.get('origin'),
                'provenanceHistory': asset_data.get('provenanceHistory', []),
                
                # Usage tracking
                'usageCount': 0,
                'lastUsed': None,
                'favorites': 0,
                
                # Metadata
                'createdAt': datetime.now(timezone.utc),
                'updatedAt': datetime.now(timezone.utc),
                'createdBy': asset_data.get('createdBy', 'system'),
                'isActive': True
            }
            
            # Insert into database
            result = self.assets_collection.insert_one(asset_doc)
            
            logger.info(f"Created asset: {asset_id}")
            return asset_id
            
        except Exception as e:
            logger.error(f"Failed to create asset: {e}")
            raise e
    
    def get_asset(self, asset_id: str) -> Optional[Dict[str, Any]]:
        """Get asset by ID"""
        try:
            asset = self.assets_collection.find_one({'id': asset_id, 'isActive': True})
            if asset:
                # Convert ObjectId to string
                asset['_id'] = str(asset['_id'])
                return asset
            return None
        except Exception as e:
            logger.error(f"Failed to get asset {asset_id}: {e}")
            return None
    
    def update_asset(self, asset_id: str, updates: Dict[str, Any]) -> bool:
        """Update asset"""
        try:
            updates['updatedAt'] = datetime.now(timezone.utc)
            result = self.assets_collection.update_one(
                {'id': asset_id, 'isActive': True},
                {'$set': updates}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Failed to update asset {asset_id}: {e}")
            return False
    
    def delete_asset(self, asset_id: str) -> bool:
        """Soft delete asset"""
        try:
            result = self.assets_collection.update_one(
                {'id': asset_id, 'isActive': True},
                {'$set': {'isActive': False, 'updatedAt': datetime.now(timezone.utc)}}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Failed to delete asset {asset_id}: {e}")
            return False
    
    def search_assets(self, query: str, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Search assets with filters"""
        try:
            search_filter = {'isActive': True}
            
            # Text search
            if query:
                search_filter['$text'] = {'$search': query}
            
            # Apply additional filters
            if filters:
                if 'domain' in filters:
                    search_filter['domain'] = filters['domain']
                if 'assetClass' in filters:
                    search_filter['assetClass'] = filters['assetClass']
                if 'tags' in filters:
                    search_filter['tags'] = {'$in': filters['tags']}
                if 'minUsageCount' in filters:
                    search_filter['usageCount'] = {'$gte': filters['minUsageCount']}
            
            # Execute search
            cursor = self.assets_collection.find(search_filter)
            
            # Sort by relevance or usage count
            if query:
                cursor = cursor.sort([('score', {'$meta': 'textScore'})])
            else:
                cursor = cursor.sort([('usageCount', -1), ('createdAt', -1)])
            
            # Limit results
            limit = filters.get('limit', 50) if filters else 50
            cursor = cursor.limit(limit)
            
            assets = []
            for asset in cursor:
                asset['_id'] = str(asset['_id'])
                assets.append(asset)
            
            return assets
            
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return []
    
    def get_categories(self) -> List[Dict[str, Any]]:
        """Get asset categories"""
        try:
            # Get unique domains and asset classes
            domains = self.assets_collection.distinct('domain', {'isActive': True})
            asset_classes = self.assets_collection.distinct('assetClass', {'isActive': True})
            
            # Get tag counts
            pipeline = [
                {'$match': {'isActive': True}},
                {'$unwind': '$tags'},
                {'$group': {'_id': '$tags', 'count': {'$sum': 1}}},
                {'$sort': {'count': -1}},
                {'$limit': 50}
            ]
            tag_counts = list(self.assets_collection.aggregate(pipeline))
            
            return {
                'domains': domains,
                'assetClasses': asset_classes,
                'popularTags': tag_counts
            }
            
        except Exception as e:
            logger.error(f"Failed to get categories: {e}")
            return {'domains': [], 'assetClasses': [], 'popularTags': []}
    
    def record_usage(self, asset_id: str, user_id: str = None) -> bool:
        """Record asset usage"""
        try:
            # Update usage count
            self.assets_collection.update_one(
                {'id': asset_id, 'isActive': True},
                {
                    '$inc': {'usageCount': 1},
                    '$set': {'lastUsed': datetime.now(timezone.utc)}
                }
            )
            
            # Record detailed usage stats
            if user_id:
                usage_doc = {
                    'assetId': asset_id,
                    'userId': user_id,
                    'timestamp': datetime.now(timezone.utc),
                    'action': 'view'
                }
                self.usage_collection.insert_one(usage_doc)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to record usage for {asset_id}: {e}")
            return False
    
    def upload_file(self, file_data: bytes, filename: str, asset_id: str) -> Optional[str]:
        """Upload file to R2 storage"""
        if not self.r2_client:
            logger.error("R2 client not available")
            return None
        
        try:
            # Determine file type and path
            file_extension = filename.split('.')[-1].lower()
            file_type = 'models' if file_extension in ['glb', 'gltf', 'obj', 'stl'] else 'thumbnails'
            
            # Generate unique filename
            file_hash = hashlib.md5(file_data).hexdigest()
            unique_filename = f"{asset_id}_{file_hash}.{file_extension}"
            s3_key = f"{file_type}/{unique_filename}"
            
            # Upload to R2
            self.r2_client.put_object(
                Bucket=R2_BUCKET_NAME,
                Key=s3_key,
                Body=file_data,
                ContentType=mimetypes.guess_type(filename)[0] or 'application/octet-stream',
                CacheControl='public, max-age=31536000'  # 1 year cache
            )
            
            # Generate public URL
            public_url = f"https://assets.kineticore.com/{s3_key}"
            
            logger.info(f"Uploaded file: {s3_key}")
            return public_url
            
        except Exception as e:
            logger.error(f"Failed to upload file {filename}: {e}")
            return None
    
    def generate_thumbnail(self, asset_id: str, model_url: str) -> Optional[str]:
        """Generate thumbnail for asset"""
        try:
            # This would integrate with the thumbnail generation service
            # For now, return a placeholder
            return f"https://assets.kineticore.com/thumbnails/{asset_id}.png"
        except Exception as e:
            logger.error(f"Failed to generate thumbnail for {asset_id}: {e}")
            return None

# Initialize asset manager
asset_manager = AssetManager()

# API Routes

@app.route('/api/assets', methods=['GET'])
def get_assets():
    """Get assets with optional filtering"""
    try:
        query = request.args.get('q', '')
        domain = request.args.get('domain')
        asset_class = request.args.get('assetClass')
        tags = request.args.getlist('tags')
        limit = int(request.args.get('limit', 50))
        
        filters = {
            'domain': domain,
            'assetClass': asset_class,
            'tags': tags if tags else None,
            'limit': limit
        }
        
        assets = asset_manager.search_assets(query, filters)
        
        return jsonify({
            'success': True,
            'assets': assets,
            'total': len(assets)
        })
        
    except Exception as e:
        logger.error(f"Get assets error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/assets/<asset_id>', methods=['GET'])
def get_asset(asset_id: str):
    """Get specific asset"""
    try:
        asset = asset_manager.get_asset(asset_id)
        if asset:
            return jsonify({
                'success': True,
                'asset': asset
            })
        else:
            return jsonify({'error': 'Asset not found'}), 404
            
    except Exception as e:
        logger.error(f"Get asset error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/assets', methods=['POST'])
def create_asset():
    """Create new asset"""
    try:
        asset_data = request.get_json()
        
        if not asset_data:
            return jsonify({'error': 'Asset data required'}), 400
        
        asset_id = asset_manager.create_asset(asset_data)
        
        return jsonify({
            'success': True,
            'assetId': asset_id
        })
        
    except Exception as e:
        logger.error(f"Create asset error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/assets/<asset_id>', methods=['PUT'])
def update_asset(asset_id: str):
    """Update asset"""
    try:
        updates = request.get_json()
        
        if not updates:
            return jsonify({'error': 'Update data required'}), 400
        
        success = asset_manager.update_asset(asset_id, updates)
        
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'Asset not found or update failed'}), 404
            
    except Exception as e:
        logger.error(f"Update asset error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/assets/<asset_id>', methods=['DELETE'])
def delete_asset(asset_id: str):
    """Delete asset"""
    try:
        success = asset_manager.delete_asset(asset_id)
        
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'Asset not found or delete failed'}), 404
            
    except Exception as e:
        logger.error(f"Delete asset error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/assets/<asset_id>/usage', methods=['POST'])
def record_usage(asset_id: str):
    """Record asset usage"""
    try:
        data = request.get_json() or {}
        user_id = data.get('userId')
        
        success = asset_manager.record_usage(asset_id, user_id)
        
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'Failed to record usage'}), 500
            
    except Exception as e:
        logger.error(f"Record usage error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/categories', methods=['GET'])
def get_categories():
    """Get asset categories"""
    try:
        categories = asset_manager.get_categories()
        
        return jsonify({
            'success': True,
            'categories': categories
        })
        
    except Exception as e:
        logger.error(f"Get categories error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/upload', methods=['POST'])
def upload_file():
    """Upload file for asset"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        asset_id = request.form.get('assetId')
        
        if not asset_id:
            return jsonify({'error': 'Asset ID required'}), 400
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Read file data
        file_data = file.read()
        
        # Upload to R2
        file_url = asset_manager.upload_file(file_data, file.filename, asset_id)
        
        if file_url:
            # Update asset with file URL
            asset_manager.update_asset(asset_id, {'filePath': file_url})
            
            return jsonify({
                'success': True,
                'fileUrl': file_url
            })
        else:
            return jsonify({'error': 'Upload failed'}), 500
            
    except Exception as e:
        logger.error(f"Upload error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/generate-thumbnail', methods=['POST'])
def generate_thumbnail():
    """Generate thumbnail for asset"""
    try:
        data = request.get_json()
        asset_id = data.get('assetId')
        model_url = data.get('modelUrl')
        
        if not asset_id or not model_url:
            return jsonify({'error': 'Asset ID and model URL required'}), 400
        
        thumbnail_url = asset_manager.generate_thumbnail(asset_id, model_url)
        
        if thumbnail_url:
            # Update asset with thumbnail URL
            asset_manager.update_asset(asset_id, {'thumbnail': thumbnail_url})
            
            return jsonify({
                'success': True,
                'thumbnailUrl': thumbnail_url
            })
        else:
            return jsonify({'error': 'Thumbnail generation failed'}), 500
            
    except Exception as e:
        logger.error(f"Thumbnail generation error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'version': '1.0.0',
        'database': 'connected' if client else 'disconnected',
        'storage': 'connected' if r2_client else 'disconnected',
        'features': [
            'asset-management',
            'file-upload',
            'thumbnail-generation',
            'usage-tracking',
            'search-and-filter'
        ]
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True)
