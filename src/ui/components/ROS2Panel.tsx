/**
 * ROS 2 Integration Panel
 * Connect to ROS 2 systems via rosbridge and deploy trajectories
 */

import { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, Send, Download, RefreshCw } from 'lucide-react';
import { ROSManager } from '../../ros2/bridge';
import { JointState, TFMessage } from '../../ros2/messages';
import './ROS2Panel.css';

interface ROS2PanelProps {
  onClose?: () => void;
}

export function ROS2Panel({ onClose }: ROS2PanelProps) {
  const [rosURL, setRosURL] = useState('ws://localhost:9090');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [lastJointState, setLastJointState] = useState<JointState | null>(null);
  const [topicsList, setTopicsList] = useState<string[]>([]);
  const [nodesList, setNodesList] = useState<string[]>([]);
  const [stats, setStats] = useState({
    activeSubscriptions: 0,
    pendingServiceCalls: 0,
    reconnectAttempts: 0
  });

  const rosManagerRef = useRef<ROSManager | null>(null);

  useEffect(() => {
    // Initialize ROS manager
    rosManagerRef.current = new ROSManager();

    return () => {
      // Cleanup on unmount
      if (rosManagerRef.current) {
        rosManagerRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    // Update stats periodically
    const interval = setInterval(() => {
      if (rosManagerRef.current && connected) {
        const newStats = rosManagerRef.current.getStats();
        setStats({
          activeSubscriptions: newStats.activeSubscriptions,
          pendingServiceCalls: newStats.pendingServiceCalls,
          reconnectAttempts: newStats.reconnectAttempts
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [connected]);

  const handleConnect = async () => {
    if (!rosManagerRef.current) return;

    setConnecting(true);
    try {
      await rosManagerRef.current.connect(rosURL);
      setConnected(true);

      // Subscribe to common topics
      rosManagerRef.current.subscribeToJointStates((state) => {
        setLastJointState(state);
      });

      rosManagerRef.current.subscribeToTF((tf: TFMessage) => {
        console.log('[ROS2Panel] TF update:', tf.transforms.length, 'transforms');
      });

      // Load topics and nodes
      refreshTopicsAndNodes();
    } catch (error) {
      console.error('[ROS2Panel] Connection failed:', error);
      alert(`Failed to connect: ${error}`);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    if (!rosManagerRef.current) return;

    rosManagerRef.current.disconnect();
    setConnected(false);
    setLastJointState(null);
    setTopicsList([]);
    setNodesList([]);
  };

  const refreshTopicsAndNodes = async () => {
    if (!rosManagerRef.current) return;

    try {
      const [topics, nodes] = await Promise.all([
        rosManagerRef.current.getTopics(),
        rosManagerRef.current.getNodes()
      ]);

      setTopicsList(topics);
      setNodesList(nodes);
    } catch (error) {
      console.error('[ROS2Panel] Failed to refresh topics/nodes:', error);
    }
  };

  const handleDeployTrajectory = async () => {
    // This is a placeholder - in real usage, you'd get the trajectory from
    // the trajectory planner and joint names from the selected robot
    alert('Trajectory deployment requires integration with trajectory planner.\nSee ROS2_INTEGRATION_ROADMAP.md for usage examples.');
  };

  const handleExportJSON = () => {
    alert('JSON export requires integration with trajectory planner.\nSee ROS2_INTEGRATION_ROADMAP.md for usage examples.');
  };

  return (
    <div className="ros2-panel">
      <div className="panel-header">
        <h3>ROS 2 Connection</h3>
        {onClose && (
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        )}
      </div>

      <div className="panel-content">
        {/* Connection Section */}
        <div className="connection-section">
          <div className="input-group">
            <label>rosbridge URL:</label>
            <input
              type="text"
              value={rosURL}
              onChange={(e) => setRosURL(e.target.value)}
              placeholder="ws://localhost:9090"
              disabled={connected}
              className="url-input"
            />
          </div>

          <div className="button-group">
            {!connected ? (
              <button
                className="connect-button"
                onClick={handleConnect}
                disabled={connecting}
              >
                {connecting ? (
                  <>
                    <RefreshCw className="icon spinning" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wifi className="icon" />
                    Connect to ROS 2
                  </>
                )}
              </button>
            ) : (
              <button
                className="disconnect-button"
                onClick={handleDisconnect}
              >
                <WifiOff className="icon" />
                Disconnect
              </button>
            )}
          </div>

          <div className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
            <div className="status-dot" />
            <span>
              {connected ? '🟢 Connected' : '🔴 Disconnected'}
            </span>
          </div>
        </div>

        {/* Actions Section */}
        {connected && (
          <>
            <div className="actions-section">
              <h4>Actions</h4>
              <div className="button-group">
                <button
                  className="action-button"
                  onClick={handleDeployTrajectory}
                >
                  <Send className="icon" />
                  Deploy Trajectory
                </button>

                <button
                  className="action-button"
                  onClick={handleExportJSON}
                >
                  <Download className="icon" />
                  Export as JSON
                </button>

                <button
                  className="action-button"
                  onClick={refreshTopicsAndNodes}
                >
                  <RefreshCw className="icon" />
                  Refresh Topics
                </button>
              </div>
            </div>

            {/* Stats Section */}
            <div className="stats-section">
              <h4>Connection Stats</h4>
              <div className="stats-grid">
                <div className="stat-item">
                  <label>Subscriptions:</label>
                  <span>{stats.activeSubscriptions}</span>
                </div>
                <div className="stat-item">
                  <label>Pending Calls:</label>
                  <span>{stats.pendingServiceCalls}</span>
                </div>
                <div className="stat-item">
                  <label>Topics:</label>
                  <span>{topicsList.length}</span>
                </div>
                <div className="stat-item">
                  <label>Nodes:</label>
                  <span>{nodesList.length}</span>
                </div>
              </div>
            </div>

            {/* Joint State Section */}
            {lastJointState && (
              <div className="joint-state-section">
                <h4>Latest Joint State</h4>
                <div className="joint-list">
                  {lastJointState.name.map((name, i) => (
                    <div key={i} className="joint-item">
                      <span className="joint-name">{name}:</span>
                      <span className="joint-value">
                        {lastJointState.position[i]?.toFixed(3) ?? 'N/A'} rad
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Topics List */}
            {topicsList.length > 0 && (
              <div className="topics-section">
                <h4>Available Topics ({topicsList.length})</h4>
                <div className="topics-list">
                  {topicsList.slice(0, 10).map((topic, i) => (
                    <div key={i} className="topic-item">
                      {topic}
                    </div>
                  ))}
                  {topicsList.length > 10 && (
                    <div className="topic-item more">
                      ... and {topicsList.length - 10} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
