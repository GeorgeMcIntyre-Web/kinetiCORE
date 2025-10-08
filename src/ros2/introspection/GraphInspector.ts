/**
 * ROS Graph Inspector
 * Introspect ROS 2 computation graph (nodes, topics, services)
 */

import { ROSBridgeClient } from '../bridge/ROSBridgeClient';

export interface ROSNode {
  name: string;
  namespace: string;
  publishers: string[];
  subscribers: string[];
  services: string[];
}

export interface ROSTopic {
  name: string;
  type: string;
  publishers: string[];
  subscribers: string[];
}

export interface ROSService {
  name: string;
  type: string;
  node: string;
}

export interface GraphData {
  nodes: ROSNode[];
  topics: ROSTopic[];
  services: ROSService[];
}

/**
 * Inspects ROS 2 computation graph
 */
export class GraphInspector {
  private bridge: ROSBridgeClient;

  constructor(bridge: ROSBridgeClient) {
    this.bridge = bridge;
  }

  /**
   * Get list of all nodes
   */
  async getNodes(): Promise<string[]> {
    try {
      const result = await this.bridge.callService<
        Record<string, never>,
        { nodes: string[] }
      >('/rosapi/nodes', 'rosapi/Nodes', {});
      return result.nodes || [];
    } catch (error) {
      console.error('[GraphInspector] Failed to get nodes:', error);
      return [];
    }
  }

  /**
   * Get list of all topics
   */
  async getTopics(): Promise<string[]> {
    try {
      const result = await this.bridge.callService<
        Record<string, never>,
        { topics: string[] }
      >('/rosapi/topics', 'rosapi/Topics', {});
      return result.topics || [];
    } catch (error) {
      console.error('[GraphInspector] Failed to get topics:', error);
      return [];
    }
  }

  /**
   * Get list of all services
   */
  async getServices(): Promise<string[]> {
    try {
      const result = await this.bridge.callService<
        Record<string, never>,
        { services: string[] }
      >('/rosapi/services', 'rosapi/Services', {});
      return result.services || [];
    } catch (error) {
      console.error('[GraphInspector] Failed to get services:', error);
      return [];
    }
  }

  /**
   * Get topic type
   */
  async getTopicType(topic: string): Promise<string | null> {
    try {
      const result = await this.bridge.callService<
        { topic: string },
        { type: string }
      >('/rosapi/topic_type', 'rosapi/TopicType', { topic });
      return result.type || null;
    } catch (error) {
      console.error(`[GraphInspector] Failed to get type for ${topic}:`, error);
      return null;
    }
  }

  /**
   * Get service type
   */
  async getServiceType(service: string): Promise<string | null> {
    try {
      const result = await this.bridge.callService<
        { service: string },
        { type: string }
      >('/rosapi/service_type', 'rosapi/ServiceType', { service });
      return result.type || null;
    } catch (error) {
      console.error(`[GraphInspector] Failed to get type for ${service}:`, error);
      return null;
    }
  }

  /**
   * Get publishers for a topic
   */
  async getPublishers(topic: string): Promise<string[]> {
    try {
      const result = await this.bridge.callService<
        { topic: string },
        { publishers: string[] }
      >('/rosapi/publishers', 'rosapi/Publishers', { topic });
      return result.publishers || [];
    } catch (error) {
      console.error(`[GraphInspector] Failed to get publishers for ${topic}:`, error);
      return [];
    }
  }

  /**
   * Get subscribers for a topic
   */
  async getSubscribers(topic: string): Promise<string[]> {
    try {
      const result = await this.bridge.callService<
        { topic: string },
        { subscribers: string[] }
      >('/rosapi/subscribers', 'rosapi/Subscribers', { topic });
      return result.subscribers || [];
    } catch (error) {
      console.error(`[GraphInspector] Failed to get subscribers for ${topic}:`, error);
      return [];
    }
  }

  /**
   * Get complete graph data
   */
  async getGraphData(): Promise<GraphData> {
    const [nodes, topicNames, serviceNames] = await Promise.all([
      this.getNodes(),
      this.getTopics(),
      this.getServices()
    ]);

    // Get topic details
    const topics: ROSTopic[] = await Promise.all(
      topicNames.map(async (name) => {
        const [type, publishers, subscribers] = await Promise.all([
          this.getTopicType(name),
          this.getPublishers(name),
          this.getSubscribers(name)
        ]);

        return {
          name,
          type: type || 'unknown',
          publishers,
          subscribers
        };
      })
    );

    // Get service details
    const services: ROSService[] = await Promise.all(
      serviceNames.map(async (name) => {
        const type = await this.getServiceType(name);

        return {
          name,
          type: type || 'unknown',
          node: '' // Would need additional service to get this
        };
      })
    );

    // Build node details
    const nodeDetails: ROSNode[] = nodes.map((name) => {
      const publishers = topics
        .filter((t) => t.publishers.includes(name))
        .map((t) => t.name);

      const subscribers = topics
        .filter((t) => t.subscribers.includes(name))
        .map((t) => t.name);

      const nodeServices = services
        .filter((s) => s.name.startsWith(name))
        .map((s) => s.name);

      // Extract namespace from node name
      const parts = name.split('/');
      const namespace = parts.length > 1 ? parts.slice(0, -1).join('/') : '/';

      return {
        name,
        namespace,
        publishers,
        subscribers,
        services: nodeServices
      };
    });

    return {
      nodes: nodeDetails,
      topics,
      services
    };
  }

  /**
   * Generate graph in DOT format (for visualization tools)
   */
  generateDOT(graphData: GraphData): string {
    let dot = 'digraph ROS {\n';
    dot += '  rankdir=LR;\n';
    dot += '  node [shape=box];\n\n';

    // Add nodes
    graphData.nodes.forEach((node) => {
      const label = node.name.replace(/\//g, '_');
      dot += `  ${label} [label="${node.name}", shape=ellipse, color=blue];\n`;
    });

    dot += '\n';

    // Add topics
    graphData.topics.forEach((topic) => {
      const label = topic.name.replace(/\//g, '_');
      dot += `  ${label} [label="${topic.name}\\n(${topic.type})", shape=box, color=green];\n`;
    });

    dot += '\n';

    // Add connections
    graphData.topics.forEach((topic) => {
      const topicLabel = topic.name.replace(/\//g, '_');

      topic.publishers.forEach((pub) => {
        const pubLabel = pub.replace(/\//g, '_');
        dot += `  ${pubLabel} -> ${topicLabel};\n`;
      });

      topic.subscribers.forEach((sub) => {
        const subLabel = sub.replace(/\//g, '_');
        dot += `  ${topicLabel} -> ${subLabel};\n`;
      });
    });

    dot += '}\n';
    return dot;
  }

  /**
   * Get statistics about the graph
   */
  getGraphStats(graphData: GraphData): {
    nodeCount: number;
    topicCount: number;
    serviceCount: number;
    connectionCount: number;
  } {
    const connectionCount = graphData.topics.reduce(
      (sum, topic) => sum + topic.publishers.length + topic.subscribers.length,
      0
    );

    return {
      nodeCount: graphData.nodes.length,
      topicCount: graphData.topics.length,
      serviceCount: graphData.services.length,
      connectionCount
    };
  }
}
