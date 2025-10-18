# kinetiCORE

**Web-based 3D Industrial Simulation and Kinematics Platform**

A comprehensive web-based platform for industrial robot simulation, kinematics analysis, and 3D CAD integration. Built with modern web technologies to provide professional-grade simulation capabilities directly in the browser.

## 🎯 Overview

kinetiCORE is a sophisticated 3D simulation platform that enables engineers, roboticists, and manufacturers to:

- **Simulate Industrial Robots** - Complete kinematic chains with forward/inverse kinematics
- **Import CAD Models** - Support for JT, URDF, CATIA, DXF, STL, OBJ, and glTF formats
- **Real-time Physics** - Interactive simulation with collision detection and dynamics
- **Path Planning** - Advanced trajectory planning and optimization
- **Professional UI** - Progressive disclosure interface (Essential/Professional/Expert modes)
- **Boolean Operations** - CSG operations for complex geometry manipulation

## 🏗️ Architecture

```
Web Browser (React + Babylon.js + Rapier Physics)
├── 3D Scene Management (Babylon.js)
├── Physics Engine (Rapier3D)
├── Kinematics Engine (Custom)
├── CAD Import Pipeline (Multiple formats)
├── UI Framework (React + TypeScript)
└── State Management (Zustand)
```

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern UI framework with hooks and context
- **TypeScript** - Type-safe development with strict mode
- **Babylon.js 8.30** - 3D rendering engine with WebGL/WebGPU support
- **Rapier3D** - High-performance physics engine
- **Zustand** - Lightweight state management
- **Tailwind CSS** - Utility-first styling framework
- **Vite** - Fast build tool and dev server

### Backend Services
- **Node.js** - Runtime for server-side services
- **Express** - Web server framework
- **Python** - JT file conversion services
- **PyOpenJt** - JT file parsing and conversion

### Development Tools
- **Vitest** - Unit testing framework
- **ESLint + Prettier** - Code quality and formatting
- **Husky** - Git hooks for quality gates
- **Wrangler** - Cloudflare Pages deployment

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** and npm 9+
- **Modern web browser** (Chrome, Firefox, Safari, Edge)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/kineticore.git
cd kineticore

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

### Development Commands

```bash
# Development server with hot reload
npm run dev

# Type checking
npm run type-check

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build

# Preview production build
npm run preview

# Lint and fix code
npm run lint:fix
```

## ✨ Features

### 🎮 3D Scene Management
- **Multi-selection System** - Ctrl+Click selection with visual feedback
- **Transform Gizmos** - Interactive translate, rotate, and scale tools
- **Scene Tree** - Hierarchical object management with context menus
- **Camera Controls** - Orbit, pan, zoom with keyboard shortcuts
- **Snapping System** - 13 snap types for precise positioning

### 🤖 Kinematics & Robotics
- **Forward Kinematics** - Real-time joint angle calculations
- **Inverse Kinematics** - Target-based robot positioning
- **Kinematic Chains** - Multi-joint robot arm simulation
- **Joint Limits** - Configurable joint constraints and ranges
- **Path Planning** - RRT-based trajectory planning algorithms

### 📁 CAD Import & Export
- **JT Files** - Siemens JT format with kinematic data extraction
- **URDF** - Robot model import with joint definitions
- **CATIA** - Native CATIA file support
- **DXF** - 2D CAD drawings with layer support
- **STL/OBJ** - 3D mesh formats
- **glTF/GLB** - Standard 3D asset format

### ⚡ Physics Simulation
- **Real-time Physics** - Rapier3D physics engine
- **Collision Detection** - Accurate collision response
- **Rigid Body Dynamics** - Mass, inertia, and force simulation
- **Gravity & Constraints** - Realistic physical behavior

### 🔧 Boolean Operations
- **CSG Operations** - Union, Subtract, Intersect
- **Manifold Integration** - High-quality mesh operations
- **Undo/Redo Support** - Full command pattern implementation
- **Material Preservation** - Maintains material properties

### 🎨 User Interface
- **Progressive Disclosure** - Essential/Professional/Expert modes
- **Keyboard Shortcuts** - Industry-standard hotkeys
- **Context Menus** - Right-click object manipulation
- **Inspector Panel** - Property editing and configuration
- **Toast Notifications** - User feedback and status updates

### 🔄 Command System
- **Undo/Redo** - Complete command history with branching
- **Command Pattern** - Extensible action system
- **Keyboard Shortcuts** - Ctrl+Z, Ctrl+Y, Ctrl+D
- **State Management** - Consistent application state

## 🎯 Current Status

### ✅ Production Ready Features
- **Multi-selection System** - Complete with visual feedback
- **Boolean Operations** - CSG operations with undo/redo
- **Command System** - Full undo/redo with command pattern
- **Keyboard Shortcuts** - Industry-standard hotkeys
- **File Import** - JT, URDF, CATIA, DXF, STL, OBJ, glTF
- **Progressive UI** - Essential/Professional/Expert modes
- **Physics Engine** - Rapier3D integration
- **Snapping System** - 13 snap types for precision

### 🧪 Testing Infrastructure
- **100+ Unit Tests** - Comprehensive test coverage
- **Vitest Framework** - Modern testing with coverage
- **Babylon.js Mocks** - Lightweight testing without WebGL
- **Command Testing** - Undo/redo system validation
- **Snapping Tests** - 73 tests for precision system

### 📊 Recent Achievements
- **Critical Bug Fixed** - Snapping system buttons now functional
- **Test Infrastructure** - Complete testing framework setup
- **Code Quality** - TypeScript strict mode, ESLint, Prettier
- **Performance** - Optimized build with code splitting
- **Documentation** - Comprehensive technical documentation

## 🚀 Getting Started

### Basic Workflow

1. **Import CAD Model**
   ```typescript
   // Load robot model
   const robot = await ModelLoader.loadURDF('robot.urdf');
   
   // Or import JT assembly
   const assembly = await ModelLoader.loadJT('assembly.jt');
   ```

2. **Set Up Kinematics**
   ```typescript
   // Create kinematic chain
   const chain = KinematicsManager.createChain(robot);
   
   // Set joint limits
   chain.setJointLimits(0, { min: -180, max: 180 });
   ```

3. **Simulate Motion**
   ```typescript
   // Forward kinematics
   const pose = chain.forwardKinematics([0, 45, -90, 0, 0, 0]);
   
   // Inverse kinematics
   const angles = chain.inverseKinematics(targetPose);
   ```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `W` | Translate mode |
| `E` | Rotate mode |
| `R` | Scale mode |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+D` | Duplicate |
| `Delete` | Delete selected |
| `F` | Frame selected |
| `.` | Zoom fit all |

## 🐛 Troubleshooting

### Common Issues

**TypeScript Errors:**
```bash
# Run type checking
npm run type-check

# Fix auto-fixable issues
npm run lint:fix
```

**Build Failures:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for dependency conflicts
npm ls
```

**Physics Issues:**
- Ensure Rapier3D is properly initialized
- Check coordinate system alignment (Z-up)
- Verify rigid body creation parameters

**Import Issues:**
- Check file format compatibility
- Verify file permissions
- Review browser console for detailed errors

### Performance Optimization

**Large Models:**
- Use LOD (Level of Detail) for complex meshes
- Enable frustum culling for off-screen objects
- Consider mesh simplification for distant objects

**Physics Performance:**
- Adjust physics timestep for better performance
- Use simplified collision shapes when possible
- Enable sleeping for static objects

## 🏗️ Architecture Details

### Core Systems

**Scene Management:**
- Hierarchical scene tree with parent-child relationships
- Entity registry for efficient object lookup
- Transform synchronization between 3D and physics

**Physics Engine:**
- Rapier3D integration with coordinate conversion
- Rigid body dynamics and collision detection
- Constraint system for joints and mechanisms

**Kinematics Engine:**
- Forward kinematics solver for joint chains
- Inverse kinematics with multiple algorithms
- Joint limit enforcement and validation

**Command System:**
- Command pattern for all user actions
- Undo/redo with branching support
- State consistency across operations

### File Structure

```
src/
├── core/           # Core types and utilities
├── physics/        # Physics engine abstraction
├── scene/          # 3D scene management
├── entities/       # Scene entity system
├── kinematics/     # Robot kinematics
├── loaders/        # CAD file importers
├── manipulation/   # Transform tools
├── ui/             # React components
├── history/        # Command system
└── __tests__/      # Unit tests
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test SnappingHelper.test.ts
```

### Test Coverage

Current test coverage includes:
- **SnappingHelper** - 73 tests covering all snap types
- **CommandManager** - 30 tests for undo/redo system
- **TransformCommand** - 22 tests for transform operations
- **Babylon.js Mocks** - Lightweight mocks for testing

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest';
import { SnappingHelper } from '../SnappingHelper';

describe('SnappingHelper', () => {
  it('should snap to nearest vertex', () => {
    // Arrange
    const helper = SnappingHelper.getInstance();
    const point = new Vector3(1, 1, 1);
    
    // Act
    const result = helper.snapToVertex(point, meshes);
    
    // Assert
    expect(result.snapped).toBe(true);
    expect(result.position).toBeDefined();
  });
});
```

## 🚀 Future Enhancements

### Short Term (Next 4 weeks)
- [ ] Web Workers for CSG operations
- [ ] Advanced material editor
- [ ] Animation timeline
- [ ] Constraint editor
- [ ] Performance profiling tools

### Medium Term (Next 3 months)
- [ ] Cloud storage integration
- [ ] Real-time collaboration
- [ ] Advanced path planning algorithms
- [ ] Machine learning integration
- [ ] Mobile responsive UI

### Long Term (6+ months)
- [ ] WebAssembly physics engine
- [ ] VR/AR support
- [ ] Enterprise features
- [ ] Plugin system
- [ ] API for third-party integrations

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/kineticore.git`
3. Install dependencies: `npm install`
4. Create a feature branch: `git checkout -b feature/amazing-feature`
5. Make your changes and add tests
6. Run tests: `npm test`
7. Commit your changes: `git commit -m 'feat: add amazing feature'`
8. Push to your branch: `git push origin feature/amazing-feature`
9. Open a Pull Request

### Code Standards

- TypeScript strict mode
- ESLint + Prettier formatting
- Write tests for new features
- Follow conventional commits
- Update documentation

## 📞 Support

### Getting Help

- **Documentation** - Check the `/docs` folder for detailed guides
- **Issues** - Report bugs and request features on GitHub
- **Discussions** - Join community discussions
- **Email** - Contact the team directly

### Resources

- [Architecture Decisions](ARCHITECTURE_DECISIONS.md)
- [Implementation Status](IMPLEMENTATION_STATUS.md)
- [Testing Guide](UNIT_TESTING_GUIDE.md)
- [Technical Debt Audit](TECHNICAL_DEBT_AUDIT.md)

---

**Built with ❤️ by the kinetiCORE team**

*George (Architecture Lead) • Cole (3D/Babylon) • Edwin (UI/UX)*