# Week 2 Planning: BasePanel System & Component Registry

## 📋 Overview

**Objective:** Convert existing components (Inspector, SceneTree, Toolbar) to inherit from BasePanel abstract class and implement ComponentRegistry for dynamic panel management.

**Dependencies:** Week 1 UserLevel implementation (COMPLETED)

**Timeline:** 5 days (estimated 12-15 hours)

---

## 🎯 Goals

### **Primary Goals:**
1. Create BasePanel abstract class with panel metadata
2. Implement PanelRegistry for dynamic panel management
3. Convert Inspector to BasePanel
4. Convert SceneTree to BasePanel
5. Convert Toolbar to BasePanel
6. Remove temporary UserLevelSwitcher
7. Add proper header UI with level selector

### **Secondary Goals:**
1. Add localStorage persistence for user level preference
2. Create LayoutManager for panel state management
3. Implement panel visibility toggling based on user level
4. Add telemetry hooks (optional)

---

## 📁 File Structure

```
src/ui/
├── core/
│   ├── UserLevelContext.tsx          (✅ Week 1)
│   ├── BasePanel.tsx                 (NEW - Week 2)
│   ├── PanelRegistry.ts              (NEW - Week 2)
│   ├── LayoutManager.tsx             (NEW - Week 2)
│   └── types.ts                      (NEW - Week 2)
├── panels/
│   ├── InspectorPanel.tsx            (NEW - Week 2)
│   ├── SceneTreePanel.tsx            (NEW - Week 2)
│   └── ToolbarPanel.tsx              (NEW - Week 2)
├── components/
│   ├── Inspector.tsx                 (✅ Keep - wrapped by InspectorPanel)
│   ├── SceneTree.tsx                 (✅ Keep - wrapped by SceneTreePanel)
│   ├── Toolbar.tsx                   (✅ Keep - wrapped by ToolbarPanel)
│   └── Header.tsx                    (NEW - Week 2)
└── layouts/
    └── MainLayout.tsx                (NEW - Week 2)
```

---

## 🔨 Implementation Plan

### **Day 1: Foundation Classes**

#### **Task 1.1: Create BasePanel Abstract Class**
**File:** `src/ui/core/BasePanel.tsx`

```typescript
import { ReactNode } from 'react';
import { UserLevel } from './UserLevelContext';

export interface PanelConfig {
  id: string;
  name: string;
  position: 'left' | 'right' | 'center' | 'top' | 'bottom' | 'floating';
  defaultSize?: number; // percentage or pixels
  minSize: number;
  maxSize?: number;
  resizable: boolean;
  collapsible: boolean;
  userLevels: UserLevel[]; // Which levels can see this panel
  workspaces: string[]; // Which workspaces include this panel
  defaultCollapsed?: boolean;
}

export interface PanelState {
  id: string;
  visible: boolean;
  collapsed: boolean;
  size: number;
  position: { x?: number; y?: number }; // For floating panels
}

export abstract class BasePanel {
  protected config: PanelConfig;

  constructor(config: PanelConfig) {
    this.config = config;
  }

  // Abstract methods that subclasses must implement
  abstract render(): ReactNode;
  abstract getDefaultState(): PanelState;

  // Common methods available to all panels
  getId(): string {
    return this.config.id;
  }

  getName(): string {
    return this.config.name;
  }

  getConfig(): PanelConfig {
    return { ...this.config };
  }

  isVisibleForUserLevel(userLevel: UserLevel): boolean {
    return this.config.userLevels.includes(userLevel);
  }

  isVisibleForWorkspace(workspace: string): boolean {
    return this.config.workspaces.includes(workspace) ||
           this.config.workspaces.includes('*'); // Wildcard for all workspaces
  }

  canResize(): boolean {
    return this.config.resizable;
  }

  canCollapse(): boolean {
    return this.config.collapsible;
  }
}
```

**Testing:**
- Create test instance
- Verify abstract methods throw errors
- Test visibility logic

---

#### **Task 1.2: Create PanelRegistry**
**File:** `src/ui/core/PanelRegistry.ts`

```typescript
import { BasePanel } from './BasePanel';
import { UserLevel } from './UserLevelContext';

export class PanelRegistry {
  private static instance: PanelRegistry;
  private panels: Map<string, BasePanel> = new Map();

  private constructor() {}

  static getInstance(): PanelRegistry {
    if (!PanelRegistry.instance) {
      PanelRegistry.instance = new PanelRegistry();
    }
    return PanelRegistry.instance;
  }

  register(panel: BasePanel): void {
    const id = panel.getId();
    if (this.panels.has(id)) {
      console.warn(`Panel with id "${id}" already registered. Overwriting.`);
    }
    this.panels.set(id, panel);
    console.log(`Panel registered: ${id}`);
  }

  unregister(id: string): void {
    this.panels.delete(id);
  }

  get(id: string): BasePanel | undefined {
    return this.panels.get(id);
  }

  getAll(): BasePanel[] {
    return Array.from(this.panels.values());
  }

  getPanelsForUserLevel(userLevel: UserLevel): BasePanel[] {
    return this.getAll().filter(panel =>
      panel.isVisibleForUserLevel(userLevel)
    );
  }

  getPanelsForWorkspace(workspace: string): BasePanel[] {
    return this.getAll().filter(panel =>
      panel.isVisibleForWorkspace(workspace)
    );
  }

  getPanelsByPosition(position: string): BasePanel[] {
    return this.getAll().filter(panel =>
      panel.getConfig().position === position
    );
  }

  clear(): void {
    this.panels.clear();
  }
}
```

**Testing:**
- Register multiple panels
- Test filtering by user level
- Test filtering by workspace
- Verify singleton pattern

---

#### **Task 1.3: Create Panel Types**
**File:** `src/ui/core/types.ts`

```typescript
export type PanelPosition = 'left' | 'right' | 'center' | 'top' | 'bottom' | 'floating';
export type WorkspaceType = 'modeling' | 'simulation' | 'analysis' | '*';

export interface LayoutConfig {
  workspace: WorkspaceType;
  panels: {
    left: string[];
    right: string[];
    center: string[];
    top: string[];
    bottom: string[];
  };
}
```

---

### **Day 2: Convert Inspector to BasePanel**

#### **Task 2.1: Create InspectorPanel**
**File:** `src/ui/panels/InspectorPanel.tsx`

```typescript
import { BasePanel, PanelConfig, PanelState } from '../core/BasePanel';
import { Inspector } from '../components/Inspector';

export class InspectorPanel extends BasePanel {
  constructor() {
    const config: PanelConfig = {
      id: 'inspector',
      name: 'Inspector',
      position: 'right',
      defaultSize: 20, // 20% width
      minSize: 15,
      maxSize: 35,
      resizable: true,
      collapsible: true,
      userLevels: ['essential', 'professional', 'expert'],
      workspaces: ['*'], // Available in all workspaces
      defaultCollapsed: false,
    };
    super(config);
  }

  render() {
    return <Inspector />;
  }

  getDefaultState(): PanelState {
    return {
      id: this.config.id,
      visible: true,
      collapsed: false,
      size: this.config.defaultSize || 20,
    };
  }
}
```

**Testing:**
- Instantiate InspectorPanel
- Verify render() returns Inspector component
- Test visibility for all user levels

---

#### **Task 2.2: Keep Existing Inspector.tsx**
**Strategy:** Keep the existing `Inspector.tsx` component unchanged. It's already working with UserLevel filtering. Just wrap it in the panel system.

**No changes needed to Inspector.tsx**

---

### **Day 3: Convert SceneTree and Toolbar**

#### **Task 3.1: Create SceneTreePanel**
**File:** `src/ui/panels/SceneTreePanel.tsx`

```typescript
import { BasePanel, PanelConfig, PanelState } from '../core/BasePanel';
import { SceneTree } from '../components/SceneTree';

export class SceneTreePanel extends BasePanel {
  constructor() {
    const config: PanelConfig = {
      id: 'sceneTree',
      name: 'Scene',
      position: 'left',
      defaultSize: 18,
      minSize: 12,
      maxSize: 30,
      resizable: true,
      collapsible: true,
      userLevels: ['essential', 'professional', 'expert'],
      workspaces: ['*'],
      defaultCollapsed: false,
    };
    super(config);
  }

  render() {
    return <SceneTree />;
  }

  getDefaultState(): PanelState {
    return {
      id: this.config.id,
      visible: true,
      collapsed: false,
      size: this.config.defaultSize || 18,
    };
  }
}
```

---

#### **Task 3.2: Create ToolbarPanel**
**File:** `src/ui/panels/ToolbarPanel.tsx`

```typescript
import { BasePanel, PanelConfig, PanelState } from '../core/BasePanel';
import { Toolbar } from '../components/Toolbar';

export class ToolbarPanel extends BasePanel {
  constructor() {
    const config: PanelConfig = {
      id: 'toolbar',
      name: 'Toolbar',
      position: 'top',
      defaultSize: 60, // pixels
      minSize: 60,
      resizable: false,
      collapsible: false, // Toolbar always visible
      userLevels: ['essential', 'professional', 'expert'],
      workspaces: ['*'],
      defaultCollapsed: false,
    };
    super(config);
  }

  render() {
    return <Toolbar onOpenKinematics={() => {/* TODO */}} />;
  }

  getDefaultState(): PanelState {
    return {
      id: this.config.id,
      visible: true,
      collapsed: false,
      size: this.config.defaultSize || 60,
    };
  }
}
```

---

### **Day 4: Header UI & Layout Manager**

#### **Task 4.1: Create Header Component**
**File:** `src/ui/components/Header.tsx`

```typescript
import { useUserLevel } from '../core/UserLevelContext';
import './Header.css';

export const Header: React.FC = () => {
  const { userLevel, setUserLevel } = useUserLevel();

  return (
    <header className="app-header">
      <div className="header-left">
        <h1>kinetiCORE</h1>
        <p>Web-based 3D Industrial Simulation Platform</p>
      </div>

      <div className="header-right">
        <div className="user-level-selector">
          <label>Experience Level:</label>
          <select
            value={userLevel}
            onChange={(e) => setUserLevel(e.target.value as any)}
            className="user-level-dropdown"
          >
            <option value="essential">Essential</option>
            <option value="professional">Professional</option>
            <option value="expert">Expert</option>
          </select>
        </div>
      </div>
    </header>
  );
};
```

---

#### **Task 4.2: Create LayoutManager**
**File:** `src/ui/core/LayoutManager.tsx`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PanelState } from './BasePanel';
import { UserLevel } from './UserLevelContext';

interface LayoutState {
  userLevel: UserLevel;
  currentWorkspace: string;
  panelStates: Record<string, PanelState>;

  // Actions
  setPanelState: (panelId: string, state: Partial<PanelState>) => void;
  togglePanelCollapse: (panelId: string) => void;
  setPanelSize: (panelId: string, size: number) => void;
  resetLayout: () => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      userLevel: 'essential',
      currentWorkspace: 'modeling',
      panelStates: {},

      setPanelState: (panelId, newState) =>
        set((state) => ({
          panelStates: {
            ...state.panelStates,
            [panelId]: {
              ...state.panelStates[panelId],
              ...newState,
            },
          },
        })),

      togglePanelCollapse: (panelId) =>
        set((state) => ({
          panelStates: {
            ...state.panelStates,
            [panelId]: {
              ...state.panelStates[panelId],
              collapsed: !state.panelStates[panelId]?.collapsed,
            },
          },
        })),

      setPanelSize: (panelId, size) =>
        set((state) => ({
          panelStates: {
            ...state.panelStates,
            [panelId]: {
              ...state.panelStates[panelId],
              size,
            },
          },
        })),

      resetLayout: () =>
        set({
          panelStates: {},
        }),
    }),
    {
      name: 'kineticore-layout', // localStorage key
    }
  )
);
```

---

### **Day 5: Integration & Testing**

#### **Task 5.1: Update App.tsx**
**Changes:**
1. Remove temporary UserLevelSwitcher
2. Add new Header component
3. Register panels in PanelRegistry
4. Use MainLayout component

```typescript
import { Header } from './ui/components/Header';
import { MainLayout } from './ui/layouts/MainLayout';
import { UserLevelProvider } from './ui/core/UserLevelContext';
import { InspectorPanel } from './ui/panels/InspectorPanel';
import { SceneTreePanel } from './ui/panels/SceneTreePanel';
import { ToolbarPanel } from './ui/panels/ToolbarPanel';
import { PanelRegistry } from './ui/core/PanelRegistry';
import { useEffect } from 'react';

function App() {
  // Register panels on mount
  useEffect(() => {
    const registry = PanelRegistry.getInstance();
    registry.register(new InspectorPanel());
    registry.register(new SceneTreePanel());
    registry.register(new ToolbarPanel());
  }, []);

  return (
    <UserLevelProvider defaultLevel="essential">
      <div className="app">
        <Header />
        <MainLayout />
      </div>
    </UserLevelProvider>
  );
}
```

---

#### **Task 5.2: Create MainLayout**
**File:** `src/ui/layouts/MainLayout.tsx`

```typescript
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { PanelRegistry } from '../core/PanelRegistry';
import { useUserLevel } from '../core/UserLevelContext';

export const MainLayout: React.FC = () => {
  const { userLevel } = useUserLevel();
  const registry = PanelRegistry.getInstance();

  // Get panels visible for current user level
  const visiblePanels = registry.getPanelsForUserLevel(userLevel);

  const leftPanels = visiblePanels.filter(p => p.getConfig().position === 'left');
  const rightPanels = visiblePanels.filter(p => p.getConfig().position === 'right');
  const centerPanels = visiblePanels.filter(p => p.getConfig().position === 'center');

  return (
    <div className="main-layout">
      {/* Toolbar - handled separately in header */}

      <PanelGroup direction="horizontal">
        {/* Left Sidebar */}
        {leftPanels.map(panel => (
          <Panel
            key={panel.getId()}
            defaultSize={panel.getConfig().defaultSize}
            minSize={panel.getConfig().minSize}
            maxSize={panel.getConfig().maxSize}
            collapsible={panel.getConfig().collapsible}
          >
            {panel.render()}
          </Panel>
        ))}

        {/* Center Viewport */}
        {centerPanels.map(panel => (
          <Panel key={panel.getId()} defaultSize={62} minSize={40}>
            {panel.render()}
          </Panel>
        ))}

        {/* Right Sidebar */}
        {rightPanels.map(panel => (
          <Panel
            key={panel.getId()}
            defaultSize={panel.getConfig().defaultSize}
            minSize={panel.getConfig().minSize}
            maxSize={panel.getConfig().maxSize}
            collapsible={panel.getConfig().collapsible}
          >
            {panel.render()}
          </Panel>
        ))}
      </PanelGroup>
    </div>
  );
};
```

---

## 📊 Success Criteria

### **Technical Requirements:**
- [ ] BasePanel abstract class created
- [ ] PanelRegistry singleton implemented
- [ ] All 3 existing components wrapped in BasePanel
- [ ] Header component created with user level selector
- [ ] Temporary UserLevelSwitcher removed
- [ ] LayoutManager with localStorage persistence
- [ ] All TypeScript compiles with 0 errors
- [ ] Build succeeds
- [ ] No regression in functionality

### **Functional Requirements:**
- [ ] User level selector in header works
- [ ] User level preference persists across sessions (localStorage)
- [ ] Panels visible/hidden based on user level
- [ ] All existing features still work
- [ ] Panel resizing still works
- [ ] Panel collapsing still works

### **Code Quality:**
- [ ] Follows existing architecture patterns
- [ ] Clean separation of concerns
- [ ] Reusable BasePanel class
- [ ] Well-documented code
- [ ] No console errors

---

## ⚠️ Risks & Mitigation

### **Risk 1: Breaking Existing Layout**
**Mitigation:**
- Implement MainLayout alongside current App.tsx
- Test both layouts before switching
- Keep rollback branch

### **Risk 2: localStorage Issues**
**Mitigation:**
- Add error handling for localStorage access
- Fallback to in-memory state if localStorage unavailable
- Test in incognito mode

### **Risk 3: Panel Registration Timing**
**Mitigation:**
- Register panels in useEffect to ensure registration happens after mount
- Add console logs to verify registration order
- Test with React.StrictMode

---

## 🧪 Testing Plan

### **Unit Tests (Optional but Recommended):**
```typescript
// BasePanel.test.ts
describe('BasePanel', () => {
  it('should throw error when render() not implemented');
  it('should check visibility for user level correctly');
  it('should return correct config');
});

// PanelRegistry.test.ts
describe('PanelRegistry', () => {
  it('should maintain singleton instance');
  it('should register and retrieve panels');
  it('should filter by user level');
  it('should filter by workspace');
});
```

### **Integration Tests:**
1. Register all panels
2. Switch user levels
3. Verify correct panels visible
4. Test localStorage persistence
5. Test panel state updates

---

## 📈 Timeline

| Day | Tasks | Hours | Status |
|-----|-------|-------|--------|
| 1 | BasePanel, PanelRegistry, types | 3h | Pending |
| 2 | InspectorPanel wrapper | 2h | Pending |
| 3 | SceneTreePanel, ToolbarPanel | 2h | Pending |
| 4 | Header, LayoutManager | 3h | Pending |
| 5 | Integration, testing, cleanup | 3h | Pending |

**Total:** 13 hours over 5 days

---

## 🚀 Next Steps After Week 2

**Week 3 Preview:**
- Feature placement fixes (move creation tools to ToolPalette)
- Workspace system implementation
- Context-sensitive UI

**Week 4 Preview:**
- Responsive breakpoints
- Mobile/tablet layouts
- Panel customization

---

## 📝 Notes

### **Design Decisions:**

**Why wrap instead of refactor components?**
- Keeps existing components working
- Minimal changes to tested code
- Separation of concerns (component logic vs panel metadata)

**Why singleton PanelRegistry?**
- Global access needed throughout app
- Single source of truth for panel configuration
- Easy to test in isolation

**Why abstract class instead of interface?**
- Can provide common functionality (getId, getName, etc.)
- Enforces implementation of critical methods
- Better for inheritance patterns

---

## ✅ Week 2 Completion Checklist

Before proceeding to Week 3:

- [ ] All files created as specified
- [ ] All components converted to BasePanel
- [ ] PanelRegistry working correctly
- [ ] Header component integrated
- [ ] UserLevelSwitcher removed
- [ ] localStorage persistence working
- [ ] All tests pass
- [ ] Build succeeds
- [ ] No console errors
- [ ] Documentation updated
- [ ] Screenshots captured
- [ ] Code reviewed
- [ ] Git commits clean and descriptive

---

**Estimated Completion Date:** [5 days from start]
**Dependencies:** Week 1 complete ✅
**Blocking:** Week 3 (depends on BasePanel system)
