/**
 * Device Library Panel
 * Owner: Edwin (UI Lead)
 * 
 * Categorized device library with search, preview thumbnails, and drag-and-drop
 * Follows the systematic button process and design system
 */

import { useState, useMemo } from 'react';
import { Search, Grip, Wrench, Settings, Plus } from 'lucide-react';
import { ButtonTemplate } from './buttons/ButtonTemplate';

export interface DeviceItem {
  id: string;
  name: string;
  type: 'gripper' | 'valve' | 'fixture' | 'custom';
  category: string;
  description: string;
  thumbnail?: string;
  mjcfFile?: string;
  joints: number;
  actuators: number;
  manufacturer?: string;
  model?: string;
}

// Mock device data - in real implementation, this would come from a service
const MOCK_DEVICES: DeviceItem[] = [
  // Grippers
  {
    id: 'schunk-pgn-plus-125',
    name: 'Schunk PGN-Plus 125',
    type: 'gripper',
    category: 'Grippers',
    description: 'High-precision parallel gripper with 125mm stroke',
    joints: 2,
    actuators: 1,
    manufacturer: 'Schunk',
    model: 'PGN-Plus 125'
  },
  {
    id: 'robotiq-2f-85',
    name: 'Robotiq 2F-85',
    type: 'gripper',
    category: 'Grippers',
    description: 'Adaptive gripper with 85mm stroke and force control',
    joints: 2,
    actuators: 1,
    manufacturer: 'Robotiq',
    model: '2F-85'
  },
  {
    id: 'onrobot-rg2',
    name: 'OnRobot RG2',
    type: 'gripper',
    category: 'Grippers',
    description: 'Compact gripper with 110mm stroke',
    joints: 2,
    actuators: 1,
    manufacturer: 'OnRobot',
    model: 'RG2'
  },
  
  // Valves
  {
    id: 'pneumatic-ball-valve',
    name: 'Pneumatic Ball Valve',
    type: 'valve',
    category: 'Valves',
    description: 'Quarter-turn pneumatic ball valve with position feedback',
    joints: 1,
    actuators: 1,
    manufacturer: 'Parker',
    model: 'PVS-1/2'
  },
  {
    id: 'solenoid-3-way',
    name: 'Solenoid 3-Way',
    type: 'valve',
    category: 'Valves',
    description: '3-way solenoid valve for pneumatic control',
    joints: 1,
    actuators: 1,
    manufacturer: 'SMC',
    model: 'VQC1000'
  },
  {
    id: 'proportional-control',
    name: 'Proportional Control',
    type: 'valve',
    category: 'Valves',
    description: 'Proportional control valve with analog feedback',
    joints: 1,
    actuators: 1,
    manufacturer: 'Festo',
    model: 'MPPE-3-1/8'
  },
  
  // Fixtures
  {
    id: 'clamping-fixture',
    name: 'Clamping Fixture',
    type: 'fixture',
    category: 'Fixtures',
    description: 'Universal clamping fixture with pneumatic actuation',
    joints: 4,
    actuators: 2,
    manufacturer: 'Schunk',
    model: 'KSP-100'
  },
  {
    id: 'welding-fixture',
    name: 'Welding Fixture',
    type: 'fixture',
    category: 'Fixtures',
    description: 'Precision welding fixture with adjustable clamps',
    joints: 6,
    actuators: 3,
    manufacturer: 'De-Sta-Co',
    model: 'WF-200'
  },
  {
    id: 'assembly-jig',
    name: 'Assembly Jig',
    type: 'fixture',
    category: 'Fixtures',
    description: 'Modular assembly jig with quick-change tooling',
    joints: 8,
    actuators: 4,
    manufacturer: 'Carr Lane',
    model: 'AJ-300'
  }
];

export function DeviceLibrary() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDevice, setSelectedDevice] = useState<DeviceItem | null>(null);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = ['all', ...new Set(MOCK_DEVICES.map(d => d.category))];
    return cats;
  }, []);

  // Filter devices based on search and category
  const filteredDevices = useMemo(() => {
    return MOCK_DEVICES.filter(device => {
      const matchesSearch = device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           device.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           device.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || device.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  // Group devices by category
  const groupedDevices = useMemo(() => {
    const groups: { [key: string]: DeviceItem[] } = {};
    
    filteredDevices.forEach(device => {
      if (!groups[device.category]) {
        groups[device.category] = [];
      }
      groups[device.category].push(device);
    });
    
    return groups;
  }, [filteredDevices]);

  const handleDeviceSelect = (device: DeviceItem) => {
    setSelectedDevice(device);
    console.log(`[DeviceLibrary] Selected device: ${device.name}`);
  };

  const handleDeviceImport = () => {
    console.log('[DeviceLibrary] Import custom MJCF device');
    // TODO: Implement file picker for MJCF import
  };

  const handleDeviceDragStart = (device: DeviceItem) => {
    console.log(`[DeviceLibrary] Dragging device: ${device.name}`);
    // TODO: Implement drag-and-drop to scene
  };

  const getDeviceIcon = (type: DeviceItem['type']) => {
    switch (type) {
      case 'gripper': return <Grip className="w-5 h-5" />;
      case 'valve': return <Wrench className="w-5 h-5" />;
      case 'fixture': return <Settings className="w-5 h-5" />;
      default: return <Plus className="w-5 h-5" />;
    }
  };

  const getDeviceTypeColor = (type: DeviceItem['type']) => {
    switch (type) {
      case 'gripper': return 'text-blue-600 bg-blue-100';
      case 'valve': return 'text-green-600 bg-green-100';
      case 'fixture': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Device Library
          </h2>
          <ButtonTemplate
            id="device_import_custom"
            label="Import Custom"
            icon="upload"
            action="Import custom MJCF device"
            stateKey="deviceImportOpen"
            initialState={false}
            stateType="boolean"
            variant="secondary"
            size="sm"
            ariaLabel="Import custom MJCF device"
            callback={handleDeviceImport}
          />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search devices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Category Filter */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <ButtonTemplate
              key={category}
              id={`device_category_${category}`}
              label={category === 'all' ? 'All' : category}
              action={`Filter by ${category} category`}
              stateKey={`deviceCategory_${category}`}
              initialState={category === 'all'}
              stateType="boolean"
              variant={selectedCategory === category ? 'primary' : 'ghost'}
              size="sm"
              ariaLabel={`Filter by ${category} category`}
              callback={() => setSelectedCategory(category)}
            />
          ))}
        </div>
      </div>

      {/* Device List */}
      <div className="flex-1 overflow-y-auto p-4">
        {Object.keys(groupedDevices).length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No devices found matching your search.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedDevices).map(([category, devices]) => (
              <div key={category}>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  {category} ({devices.length})
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {devices.map(device => (
                    <div
                      key={device.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                        selectedDevice?.id === device.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                      onClick={() => handleDeviceSelect(device)}
                      draggable
                      onDragStart={() => handleDeviceDragStart(device)}
                    >
                      <div className="flex items-start space-x-3">
                        {/* Device Icon */}
                        <div className={`p-2 rounded-lg ${getDeviceTypeColor(device.type)}`}>
                          {getDeviceIcon(device.type)}
                        </div>

                        {/* Device Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {device.name}
                            </h4>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {device.joints}J/{device.actuators}A
                            </span>
                          </div>
                          
                          {device.manufacturer && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {device.manufacturer} {device.model}
                            </p>
                          )}
                          
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
                            {device.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Device Details Panel */}
      {selectedDevice && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${getDeviceTypeColor(selectedDevice.type)}`}>
              {getDeviceIcon(selectedDevice.type)}
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                {selectedDevice.name}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {selectedDevice.joints} joints, {selectedDevice.actuators} actuators
              </p>
            </div>
            <ButtonTemplate
              id={`device_add_${selectedDevice.id}`}
              label="Add to Scene"
              icon="plus"
              action={`Add ${selectedDevice.name} to scene`}
              stateKey={`deviceAdded_${selectedDevice.id}`}
              initialState={false}
              stateType="boolean"
              variant="primary"
              size="sm"
              ariaLabel={`Add ${selectedDevice.name} to scene`}
              callback={() => {
                console.log(`[DeviceLibrary] Adding ${selectedDevice.name} to scene`);
                // TODO: Implement add to scene functionality
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
