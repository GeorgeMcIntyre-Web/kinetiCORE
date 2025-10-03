import React from 'react';
import { CheckCircle, Circle, AlertCircle } from 'lucide-react';

const UXImprovementPlan = () => {
  const sections = [
    {
      title: "1. Quick Actions & Keyboard Shortcuts",
      status: "high-priority",
      items: [
        "Add keyboard shortcuts overlay (? key)",
        "G/R/S keys for transform modes (already in toolbar)",
        "Delete key for selected objects",
        "Ctrl+Z/Y for undo/redo",
        "F key to frame/zoom selected object",
        "H key to hide/show selected",
        "Escape to cancel operations",
        "Space to toggle play/pause physics"
      ]
    },
    {
      title: "2. Context Menus (Right-Click)",
      status: "high-priority",
      items: [
        "Right-click on objects for quick actions",
        "Right-click in scene tree for node operations",
        "Right-click in viewport for add object menu",
        "Context-aware options based on selection"
      ]
    },
    {
      title: "3. Inspector Improvements",
      status: "medium-priority",
      items: [
        "Add unit labels (mm, degrees) inline",
        "Drag to scrub numeric values",
        "Color-coded axis inputs (X=red, Y=green, Z=blue)",
        "Quick presets for common transforms",
        "Copy/paste transform values",
        "Lock individual axes during transform"
      ]
    },
    {
      title: "4. Viewport Enhancements",
      status: "high-priority",
      items: [
        "Gizmo size auto-scales with zoom",
        "Snap to grid visual feedback",
        "Measurement tool (distance between points)",
        "Quick camera views (Top/Front/Side buttons)",
        "Viewport shading modes (wireframe/solid/textured)",
        "Multi-selection box (drag to select)"
      ]
    },
    {
      title: "5. Scene Tree Improvements",
      status: "medium-priority",
      items: [
        "Filter/search by name or type",
        "Bulk operations (multi-select + action)",
        "Quick duplicate (Ctrl+D on selected)",
        "Drag to reorder within same parent",
        "Show/hide all children toggle",
        "Color tags for organization"
      ]
    },
    {
      title: "6. Toolbar Optimization",
      status: "high-priority",
      items: [
        "Floating tool palette (moveable)",
        "Recently used objects quick add",
        "Favorite tools customization",
        "Compact mode for small screens",
        "Tool tips with keyboard shortcuts shown"
      ]
    },
    {
      title: "7. Quick Add Menu",
      status: "high-priority",
      items: [
        "Shift+A to open add menu at cursor",
        "Hierarchical menu: Primitives/Lights/Cameras",
        "Search filter in add menu",
        "Add at cursor position or origin"
      ]
    },
    {
      title: "8. Transform Workflow",
      status: "critical",
      items: [
        "Click-drag anywhere to move (no gizmo needed)",
        "Alt+drag for duplicate & move",
        "Shift to snap to grid (customizable increment)",
        "Ctrl to snap to other objects",
        "Numeric input during transform (type value)"
      ]
    },
    {
      title: "9. Visual Feedback",
      status: "medium-priority",
      items: [
        "Highlight on hover (before selection)",
        "Selection outline glow effect",
        "Ghost preview when duplicating",
        "Undo/redo visual flash",
        "Success/error toast notifications",
        "Progress bar for file operations"
      ]
    },
    {
      title: "10. Workspace Layouts",
      status: "low-priority",
      items: [
        "Preset layouts: Modeling/Animation/Simulation",
        "Save custom layouts",
        "Collapsible panels",
        "Full-screen viewport mode (Ctrl+Space)",
        "Picture-in-picture for reference images"
      ]
    }
  ];

  const getStatusColor = (status) => {
    switch(status) {
      case 'critical': return 'text-red-500';
      case 'high-priority': return 'text-orange-500';
      case 'medium-priority': return 'text-yellow-500';
      default: return 'text-blue-500';
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'critical') return <AlertCircle className="w-5 h-5" />;
    return <Circle className="w-5 h-5" />;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-blue-400">
            kinetiCORE UX Improvement Plan
          </h1>
          <p className="text-gray-400 text-lg">
            Comprehensive roadmap to create an intuitive, fast, and professional CAD experience
          </p>
        </header>

        <div className="grid gap-6 mb-8">
          {sections.map((section, idx) => (
            <div key={idx} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center gap-3 mb-4">
                <span className={getStatusColor(section.status)}>
                  {getStatusIcon(section.status)}
                </span>
                <h2 className="text-2xl font-semibold">{section.title}</h2>
                <span className={`text-xs px-2 py-1 rounded ${getStatusColor(section.status)} bg-gray-900`}>
                  {section.status.replace('-', ' ').toUpperCase()}
                </span>
              </div>
              <ul className="space-y-2">
                {section.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="flex items-start gap-2">
                    <Circle className="w-4 h-4 mt-1 text-gray-500 flex-shrink-0" />
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="bg-blue-900 border border-blue-700 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
            <CheckCircle className="w-6 h-6" />
            Implementation Priority Order
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li><strong>Keyboard Shortcuts System</strong> - Foundation for speed</li>
            <li><strong>Context Menus</strong> - Reduce toolbar clicking</li>
            <li><strong>Quick Add Menu (Shift+A)</strong> - Fastest object creation</li>
            <li><strong>Enhanced Transform Workflow</strong> - Core interaction improvement</li>
            <li><strong>Viewport Camera Shortcuts</strong> - Navigation speed</li>
            <li><strong>Inspector Drag-to-Scrub</strong> - Precision editing</li>
            <li><strong>Visual Feedback System</strong> - User confidence</li>
            <li><strong>Scene Tree Filter/Search</strong> - Large project management</li>
            <li><strong>Multi-Selection Box</strong> - Bulk operations</li>
            <li><strong>Workspace Layouts</strong> - Professional workflow</li>
          </ol>
        </div>

        <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-xl font-semibold mb-3">Interaction Philosophy</h3>
          <div className="grid md:grid-cols-2 gap-4 text-gray-300">
            <div>
              <h4 className="font-semibold text-blue-400 mb-2">✓ DO</h4>
              <ul className="space-y-1 text-sm">
                <li>• Provide multiple ways to do same action</li>
                <li>• Make common actions 1-2 clicks max</li>
                <li>• Show keyboard shortcuts in tooltips</li>
                <li>• Give instant visual feedback</li>
                <li>• Allow undo for everything</li>
                <li>• Smart defaults that "just work"</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-red-400 mb-2">✗ DON'T</h4>
              <ul className="space-y-1 text-sm">
                <li>• Hide common features in nested menus</li>
                <li>• Require mode switching for basic tasks</li>
                <li>• Use generic button labels ("OK", "Apply")</li>
                <li>• Block workflow with confirmation dialogs</li>
                <li>• Make users guess what will happen</li>
                <li>• Forget about keyboard-only users</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UXImprovementPlan;