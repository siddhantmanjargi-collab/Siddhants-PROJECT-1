import React from 'react';
import { Asset } from '../types/asset';
import { getAssetStatus } from '../utils/storage';

interface StatsBarProps {
  assets: Asset[];
  activeFilter: 'all' | 'safe' | 'warn' | 'danger';
  onSelectFilter: (filter: 'all' | 'safe' | 'warn' | 'danger') => void;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  assets,
  activeFilter,
  onSelectFilter,
}) => {
  const total = assets.length;
  let safeCount = 0;
  let warnCount = 0;
  let dangerCount = 0;

  assets.forEach((a) => {
    const st = getAssetStatus(a.expiryDate);
    if (st === 'safe') safeCount++;
    else if (st === 'warn') warnCount++;
    else if (st === 'danger') dangerCount++;
  });

  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-6">
      <button
        type="button"
        onClick={() => onSelectFilter(activeFilter === 'all' ? 'all' : 'all')}
        className={`bg-[#1C2E26] border rounded-xl p-2.5 sm:p-3 text-center transition-all ${
          activeFilter === 'all'
            ? 'border-[#C9A15D] ring-1 ring-[#C9A15D]'
            : 'border-[#2A3B33] hover:border-[#C9A15D]/50'
        }`}
      >
        <span className="block font-mono text-lg sm:text-2xl font-bold text-[#EDEDE1]">
          {total}
        </span>
        <span className="block text-[11px] sm:text-xs text-[#8FA79B] mt-0.5">
          Total Assets
        </span>
      </button>

      <button
        type="button"
        onClick={() => onSelectFilter(activeFilter === 'safe' ? 'all' : 'safe')}
        className={`bg-[#1C2E26] border rounded-xl p-2.5 sm:p-3 text-center transition-all ${
          activeFilter === 'safe'
            ? 'border-[#6FA88C] ring-1 ring-[#6FA88C]'
            : 'border-[#2A3B33] hover:border-[#6FA88C]/50'
        }`}
      >
        <span className="block font-mono text-lg sm:text-2xl font-bold text-[#6FA88C]">
          {safeCount}
        </span>
        <span className="block text-[11px] sm:text-xs text-[#8FA79B] mt-0.5">
          Safe
        </span>
      </button>

      <button
        type="button"
        onClick={() => onSelectFilter(activeFilter === 'warn' ? 'all' : 'warn')}
        className={`bg-[#1C2E26] border rounded-xl p-2.5 sm:p-3 text-center transition-all ${
          activeFilter === 'warn'
            ? 'border-[#E0913F] ring-1 ring-[#E0913F]'
            : 'border-[#2A3B33] hover:border-[#E0913F]/50'
        }`}
      >
        <span className="block font-mono text-lg sm:text-2xl font-bold text-[#E0913F]">
          {warnCount}
        </span>
        <span className="block text-[11px] sm:text-xs text-[#8FA79B] mt-0.5">
          Expiring Soon
        </span>
      </button>

      <button
        type="button"
        onClick={() => onSelectFilter(activeFilter === 'danger' ? 'all' : 'danger')}
        className={`bg-[#1C2E26] border rounded-xl p-2.5 sm:p-3 text-center transition-all ${
          activeFilter === 'danger'
            ? 'border-[#C97B6B] ring-1 ring-[#C97B6B]'
            : 'border-[#2A3B33] hover:border-[#C97B6B]/50'
        }`}
      >
        <span className="block font-mono text-lg sm:text-2xl font-bold text-[#C97B6B]">
          {dangerCount}
        </span>
        <span className="block text-[11px] sm:text-xs text-[#8FA79B] mt-0.5">
          Expired
        </span>
      </button>
    </div>
  );
};
