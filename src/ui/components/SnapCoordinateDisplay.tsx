import React from 'react';
import { Clipboard, Eye, EyeOff } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';

const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '0.000';
  }

  return value.toFixed(3);
};

export const SnapCoordinateDisplay: React.FC = () => {
  const lastSnapResult = useEditorStore((state) => state.lastSnapResult);
  const snapCoordinateDisplayEnabled = useEditorStore((state) => state.snapCoordinateDisplayEnabled);
  const toggleSnapCoordinateDisplay = useEditorStore((state) => state.toggleSnapCoordinateDisplay);

  if (!snapCoordinateDisplayEnabled) {
    return (
      <button
        type="button"
        onClick={toggleSnapCoordinateDisplay}
        className="fixed bottom-4 right-4 z-[1200] px-2 py-1 rounded-md bg-slate-800/80 border border-slate-600 text-xs text-slate-300 hover:bg-slate-700/90 flex items-center gap-1"
      >
        <Eye size={14} />
        Show snap coordinates
      </button>
    );
  }

  if (!lastSnapResult) {
    return null;
  }

  const { world, local, type, targetName } = lastSnapResult;

  const handleCopy = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }

    const worldText = `world: (${formatNumber(world.x)}, ${formatNumber(world.y)}, ${formatNumber(world.z)})`;
    const localText = local
      ? `local: (${formatNumber(local.x)}, ${formatNumber(local.y)}, ${formatNumber(local.z)})`
      : null;

    const typeText = `type: ${type}`;
    const targetText = targetName ? `target: ${targetName}` : null;

    const parts = [typeText, targetText, worldText, localText].filter(Boolean) as string[];
    const text = parts.join(' | ');

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Ignore clipboard errors in non-secure contexts
    }
  };

  const labelParts: string[] = [];
  labelParts.push(type);
  if (targetName) {
    labelParts.push(`– ${targetName}`);
  }

  return (
    <div className="fixed bottom-4 right-4 z-[1200] flex flex-col items-end gap-1">
      <div className="bg-slate-900/90 border border-slate-600 rounded-md px-3 py-2 shadow-lg text-xs text-slate-100 min-w-[220px] max-w-[320px]">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="font-semibold text-sky-300 truncate">
            {labelParts.join(' ')}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 rounded hover:bg-slate-700 text-slate-200"
              title="Copy snap coordinates"
            >
              <Clipboard size={14} />
            </button>
            <button
              type="button"
              onClick={toggleSnapCoordinateDisplay}
              className="p-1 rounded hover:bg-slate-700 text-slate-400"
              title="Hide snap coordinates"
            >
              <EyeOff size={14} />
            </button>
          </div>
        </div>
        <div className="space-y-0.5">
          <div className="text-slate-300">
            <span className="text-slate-400 mr-1">World</span>
            <span>
              ({formatNumber(world.x)}, {formatNumber(world.y)}, {formatNumber(world.z)})
            </span>
          </div>
          {local && (
            <div className="text-slate-300">
              <span className="text-slate-400 mr-1">Local</span>
              <span>
                ({formatNumber(local.x)}, {formatNumber(local.y)}, {formatNumber(local.z)})
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

