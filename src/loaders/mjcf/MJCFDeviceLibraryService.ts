/**
 * MJCF Device Library Service
 * Owner: George
 *
 * Provides a catalog of available MJCF devices that can be imported
 * This bridges the Device Library UI with the MJCF loader system
 */

export interface MJCFDeviceCatalogItem {
  id: string;
  name: string;
  type: 'robot' | 'gripper' | 'valve' | 'fixture' | 'actuator' | 'sensor' | 'custom';
  category: string;
  description: string;
  thumbnail?: string;
  mjcfFilePath?: string; // Path to MJCF file (if bundled)
  joints: number;
  actuators: number;
  manufacturer?: string;
  model?: string;
  hasKeyframes: boolean;
  keyframeCount: number;
  tags: string[];
}

/**
 * MJCF Device Library Service - Catalog of available devices
 */
export class MJCFDeviceLibraryService {
  private static instance: MJCFDeviceLibraryService;
  private catalog: MJCFDeviceCatalogItem[];

  private constructor() {
    this.catalog = this.initializeCatalog();
  }

  static getInstance(): MJCFDeviceLibraryService {
    if (!this.instance) {
      this.instance = new MJCFDeviceLibraryService();
    }
    return this.instance;
  }

  /**
   * Initialize the device catalog
   * TODO: This should eventually load from a JSON file or API
   */
  private initializeCatalog(): MJCFDeviceCatalogItem[] {
    return [
      // ===== ROBOTS =====
      {
        id: 'google_robot',
        name: 'Google Robot',
        type: 'robot',
        category: 'Robots',
        description: 'Google research robot with 7 DOF arm and mobile base',
        joints: 8,
        actuators: 8,
        manufacturer: 'Google',
        model: 'Research Robot',
        hasKeyframes: true,
        keyframeCount: 3,
        tags: ['research', 'mobile', '7-dof']
      },
      {
        id: 'franka_panda',
        name: 'Franka Emika Panda',
        type: 'robot',
        category: 'Robots',
        description: '7-axis collaborative robot arm with parallel gripper',
        joints: 9,
        actuators: 9,
        manufacturer: 'Franka Emika',
        model: 'Panda',
        hasKeyframes: true,
        keyframeCount: 4,
        tags: ['collaborative', '7-dof', 'research']
      },
      {
        id: 'ur5',
        name: 'Universal Robots UR5',
        type: 'robot',
        category: 'Robots',
        description: '6-axis industrial collaborative robot',
        joints: 6,
        actuators: 6,
        manufacturer: 'Universal Robots',
        model: 'UR5',
        hasKeyframes: true,
        keyframeCount: 2,
        tags: ['collaborative', 'industrial', '6-dof']
      },

      // ===== GRIPPERS =====
      {
        id: 'robotiq_2f_85',
        name: 'Robotiq 2F-85',
        type: 'gripper',
        category: 'Grippers',
        description: 'Adaptive parallel gripper with 85mm stroke and force control',
        joints: 2,
        actuators: 1,
        manufacturer: 'Robotiq',
        model: '2F-85',
        hasKeyframes: true,
        keyframeCount: 3,
        tags: ['adaptive', 'parallel', 'force-control']
      },
      {
        id: 'schunk_pgn_plus_125',
        name: 'Schunk PGN-Plus 125',
        type: 'gripper',
        category: 'Grippers',
        description: 'High-precision parallel gripper with 125mm stroke',
        joints: 2,
        actuators: 1,
        manufacturer: 'Schunk',
        model: 'PGN-Plus 125',
        hasKeyframes: true,
        keyframeCount: 2,
        tags: ['precision', 'parallel', 'high-force']
      },
      {
        id: 'onrobot_rg2',
        name: 'OnRobot RG2',
        type: 'gripper',
        category: 'Grippers',
        description: 'Compact collaborative gripper with 110mm stroke',
        joints: 2,
        actuators: 1,
        manufacturer: 'OnRobot',
        model: 'RG2',
        hasKeyframes: true,
        keyframeCount: 2,
        tags: ['collaborative', 'compact', 'parallel']
      },

      // ===== VALVES =====
      {
        id: 'pneumatic_ball_valve',
        name: 'Pneumatic Ball Valve',
        type: 'valve',
        category: 'Valves',
        description: 'Quarter-turn pneumatic ball valve with position feedback',
        joints: 1,
        actuators: 1,
        manufacturer: 'Parker',
        model: 'PVS-1/2',
        hasKeyframes: true,
        keyframeCount: 2,
        tags: ['pneumatic', 'quarter-turn', 'feedback']
      },
      {
        id: 'solenoid_3_way',
        name: 'Solenoid 3-Way Valve',
        type: 'valve',
        category: 'Valves',
        description: '3-way solenoid valve for pneumatic control',
        joints: 1,
        actuators: 1,
        manufacturer: 'SMC',
        model: 'VQC1000',
        hasKeyframes: true,
        keyframeCount: 2,
        tags: ['solenoid', '3-way', 'pneumatic']
      },
      {
        id: 'proportional_control_valve',
        name: 'Proportional Control Valve',
        type: 'valve',
        category: 'Valves',
        description: 'Proportional control valve with analog feedback',
        joints: 1,
        actuators: 1,
        manufacturer: 'Festo',
        model: 'MPPE-3-1/8',
        hasKeyframes: false,
        keyframeCount: 0,
        tags: ['proportional', 'analog', 'control']
      },

      // ===== FIXTURES =====
      {
        id: 'clamping_fixture',
        name: 'Clamping Fixture',
        type: 'fixture',
        category: 'Fixtures',
        description: 'Universal clamping fixture with pneumatic actuation',
        joints: 4,
        actuators: 2,
        manufacturer: 'Schunk',
        model: 'KSP-100',
        hasKeyframes: true,
        keyframeCount: 3,
        tags: ['pneumatic', 'universal', 'clamping']
      },
      {
        id: 'welding_fixture',
        name: 'Welding Fixture',
        type: 'fixture',
        category: 'Fixtures',
        description: 'Precision welding fixture with adjustable clamps',
        joints: 6,
        actuators: 3,
        manufacturer: 'De-Sta-Co',
        model: 'WF-200',
        hasKeyframes: true,
        keyframeCount: 4,
        tags: ['welding', 'precision', 'adjustable']
      },
      {
        id: 'assembly_jig',
        name: 'Assembly Jig',
        type: 'fixture',
        category: 'Fixtures',
        description: 'Modular assembly jig with quick-change tooling',
        joints: 8,
        actuators: 4,
        manufacturer: 'Carr Lane',
        model: 'AJ-300',
        hasKeyframes: true,
        keyframeCount: 5,
        tags: ['modular', 'assembly', 'quick-change']
      }
    ];
  }

  /**
   * Get all devices in the catalog
   */
  getAllDevices(): MJCFDeviceCatalogItem[] {
    return [...this.catalog];
  }

  /**
   * Get devices by type
   */
  getDevicesByType(type: MJCFDeviceCatalogItem['type']): MJCFDeviceCatalogItem[] {
    return this.catalog.filter(d => d.type === type);
  }

  /**
   * Get devices by category
   */
  getDevicesByCategory(category: string): MJCFDeviceCatalogItem[] {
    return this.catalog.filter(d => d.category === category);
  }

  /**
   * Get device by ID
   */
  getDevice(id: string): MJCFDeviceCatalogItem | undefined {
    return this.catalog.find(d => d.id === id);
  }

  /**
   * Search devices by name or tags
   */
  searchDevices(query: string): MJCFDeviceCatalogItem[] {
    const lowerQuery = query.toLowerCase();
    return this.catalog.filter(d =>
      d.name.toLowerCase().includes(lowerQuery) ||
      d.description.toLowerCase().includes(lowerQuery) ||
      d.manufacturer?.toLowerCase().includes(lowerQuery) ||
      d.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get unique categories
   */
  getCategories(): string[] {
    return [...new Set(this.catalog.map(d => d.category))];
  }

  /**
   * Get unique manufacturers
   */
  getManufacturers(): string[] {
    const manufacturers = this.catalog
      .map(d => d.manufacturer)
      .filter((m): m is string => m !== undefined);
    return [...new Set(manufacturers)];
  }

  /**
   * Add a custom device to the catalog (user-imported MJCF)
   */
  addCustomDevice(device: MJCFDeviceCatalogItem): void {
    const existing = this.catalog.find(d => d.id === device.id);
    if (existing) {
      console.warn(`[MJCFDeviceLibrary] Device '${device.id}' already exists, replacing`);
      const index = this.catalog.indexOf(existing);
      this.catalog[index] = device;
    } else {
      this.catalog.push(device);
    }
    console.log(`[MJCFDeviceLibrary] Added custom device: ${device.name}`);
  }

  /**
   * Remove a device from the catalog
   */
  removeDevice(id: string): void {
    const index = this.catalog.findIndex(d => d.id === id);
    if (index !== -1) {
      const device = this.catalog[index];
      this.catalog.splice(index, 1);
      console.log(`[MJCFDeviceLibrary] Removed device: ${device.name}`);
    }
  }

  /**
   * Get statistics about the catalog
   */
  getStatistics(): {
    totalDevices: number;
    devicesByType: Record<string, number>;
    devicesWithKeyframes: number;
  } {
    const devicesByType: Record<string, number> = {};
    this.catalog.forEach(d => {
      devicesByType[d.type] = (devicesByType[d.type] || 0) + 1;
    });

    return {
      totalDevices: this.catalog.length,
      devicesByType,
      devicesWithKeyframes: this.catalog.filter(d => d.hasKeyframes).length
    };
  }
}

/**
 * Helper function to convert catalog item to importable format
 */
export function getCatalogItemFilePath(item: MJCFDeviceCatalogItem): string | null {
  // If a file path is explicitly set, use it
  if (item.mjcfFilePath) {
    return item.mjcfFilePath;
  }

  // Otherwise, construct a conventional path (assuming files are organized by type/id)
  // TODO: Update this to match your actual MJCF file organization
  return `/assets/mjcf/${item.type}/${item.id}.xml`;
}
