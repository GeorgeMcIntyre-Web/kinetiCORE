/**
 * Collaboration Panel Component
 * Owner: Edwin
 * 
 * UI component for real-time collaboration features including user presence,
 * comments, annotations, and asset locking
 */

import React, { useState, useEffect } from 'react';
import { ProjectManager } from '../../project/ProjectManager';
import type { Project, ActiveUser, Comment, Annotation, AssetLock } from '../../project/types';

interface CollaborationPanelProps {
  project: Project | null;
}

export const CollaborationPanel: React.FC<CollaborationPanelProps> = ({ project }) => {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [locks, setLocks] = useState<AssetLock[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(true);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [showPresence, setShowPresence] = useState(true);

  const projectManager = ProjectManager.getInstance();

  // Update active users periodically
  useEffect(() => {
    if (!project) return;

    const updateActiveUsers = () => {
      const users = projectManager.getActiveUsers();
      setActiveUsers(users);
    };

    updateActiveUsers();
    const interval = setInterval(updateActiveUsers, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, [project]);

  // Load collaboration data when project changes
  useEffect(() => {
    if (!project) {
      setComments([]);
      setAnnotations([]);
      setLocks([]);
      return;
    }

    loadCollaborationData();
  }, [project?.id]);

  const loadCollaborationData = async () => {
    if (!project) return;

    try {
      const session = projectManager.getCollaborationSession(project.id);
      if (session) {
        setLocks(session.locks);
      }
      // TODO: Load comments and annotations from database
    } catch (err) {
      console.error('Failed to load collaboration data:', err);
    }
  };

  const handleAddComment = async () => {
    if (!project || !newComment.trim()) return;

    try {
      const comment = await projectManager.addComment(project.id, {
        projectId: project.id,
        authorId: projectManager.getCurrentUserId(),
        authorName: 'Current User', // TODO: Get real name
        content: newComment.trim(),
        isResolved: false,
        replies: [],
        mentions: [],
      });

      setComments(prev => [comment, ...prev]);
      setNewComment('');
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddComment();
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getLockIcon = (lockType: string): string => {
    return lockType === 'hard' ? '🔒' : '🔓';
  };

  const getAnnotationIcon = (type: string): string => {
    switch (type) {
      case 'note': return '📝';
      case 'warning': return '⚠️';
      case 'question': return '❓';
      case 'highlight': return '🖍️';
      case 'measurement': return '📏';
      default: return '📌';
    }
  };

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">👥</div>
          <p>No project selected</p>
          <p className="text-sm">Select a project to see collaboration features</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Collaboration</h3>
        
        {/* Toggle Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowPresence(!showPresence)}
            className={`px-3 py-1 text-xs rounded ${
              showPresence ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            👥 Presence ({activeUsers.length})
          </button>
          <button
            onClick={() => setShowComments(!showComments)}
            className={`px-3 py-1 text-xs rounded ${
              showComments ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            💬 Comments ({comments.length})
          </button>
          <button
            onClick={() => setShowAnnotations(!showAnnotations)}
            className={`px-3 py-1 text-xs rounded ${
              showAnnotations ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            📌 Annotations ({annotations.length})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Active Users */}
        {showPresence && (
          <div className="p-4 border-b border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Active Users</h4>
            {activeUsers.length === 0 ? (
              <p className="text-sm text-gray-500">No active users</p>
            ) : (
              <div className="space-y-2">
                {activeUsers.map((user) => (
                  <div key={user.userId} className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${getStatusColor('online')}`}></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                    </div>
                    {user.isTyping && (
                      <div className="text-xs text-blue-600 animate-pulse">typing...</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Asset Locks */}
        {locks.length > 0 && (
          <div className="p-4 border-b border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Asset Locks</h4>
            <div className="space-y-2">
              {locks.map((lock) => (
                <div key={lock.assetInstanceId} className="flex items-center gap-2 p-2 bg-yellow-50 rounded">
                  <span className="text-sm">{getLockIcon(lock.lockType)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      Asset {lock.assetInstanceId}
                    </p>
                    <p className="text-xs text-gray-600">
                      Locked by {lock.lockedBy} • {lock.lockType} lock
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comments */}
        {showComments && (
          <div className="p-4 border-b border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Comments</h4>
            
            {/* Add Comment */}
            <div className="mb-4">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Add a comment..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Comment
                </button>
              </div>
            </div>

            {/* Comments List */}
            {comments.length === 0 ? (
              <p className="text-sm text-gray-500">No comments yet</p>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-start gap-2 mb-2">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                        {comment.authorName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{comment.authorName}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(comment.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {comment.isResolved && (
                        <span className="text-xs text-green-600">✅ Resolved</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700">{comment.content}</p>
                    {comment.assetInstanceId && (
                      <p className="text-xs text-gray-500 mt-1">
                        On asset: {comment.assetInstanceId}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Annotations */}
        {showAnnotations && (
          <div className="p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Annotations</h4>
            {annotations.length === 0 ? (
              <p className="text-sm text-gray-500">No annotations yet</p>
            ) : (
              <div className="space-y-2">
                {annotations.map((annotation) => (
                  <div key={annotation.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                    <span className="text-sm">{getAnnotationIcon(annotation.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{annotation.content}</p>
                      <p className="text-xs text-gray-500">
                        {annotation.type} • {new Date(annotation.createdAt).toLocaleString()}
                      </p>
                      {annotation.assetInstanceId && (
                        <p className="text-xs text-gray-500">
                          On asset: {annotation.assetInstanceId}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
