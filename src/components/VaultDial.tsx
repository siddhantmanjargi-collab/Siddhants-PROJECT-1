import React from 'react';

interface VaultDialProps {
  unlocked?: boolean;
  size?: number;
}

export const VaultDial: React.FC<VaultDialProps> = ({ unlocked = false, size = 88 }) => {
  const ticks = Array.from({ length: 12 }).map((_, i) => {
    const angle = i * 30;
    const rad = (angle * Math.PI) / 180;
    const x1 = 44 + 32 * Math.sin(rad);
    const y1 = 44 - 32 * Math.cos(rad);
    const x2 = 44 + 38 * Math.sin(rad);
    const y2 = 44 - 38 * Math.cos(rad);
    return { angle, x1, y1, x2, y2, active: i % 3 === 0 };
  });

  return (
    <div className="relative flex justify-center items-center my-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 88 88" className="w-full h-full overflow-visible">
          <circle
            cx="44"
            cy="44"
            r="40"
            className="fill-none stroke-[#2A3B33] stroke-[1.5]"
          />
          {ticks.map((t, idx) => (
            <line
              key={idx}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              className={`stroke-[1.5] transition-colors duration-300 ${
                t.active ? 'stroke-[#C9A15D]' : 'stroke-[#8FA79B]/50'
              }`}
            />
          ))}
          <line
            x1="44"
            y1="44"
            x2="44"
            y2="14"
            className={`stroke-[#E4C98A] stroke-[2.5] stroke-linecap-round origin-[44px_44px] transition-transform duration-700 ease-out ${
              unlocked ? 'rotate-[145deg]' : 'rotate-0'
            }`}
          />
          <circle
            cx="44"
            cy="44"
            r="14"
            className="fill-[#1C2E26] stroke-[#C9A15D] stroke-[1.5]"
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg
            viewBox="0 0 30 30"
            className="w-7 h-7 overflow-visible transition-all duration-300"
          >
            <path
              d="M8 13 V9 a7 7 0 0 1 14 0 v4"
              className={`fill-none stroke-2 stroke-linecap-round origin-[15px_13px] transition-all duration-500 ${
                unlocked
                  ? 'stroke-[#6FA88C] -translate-y-1 -rotate-[18deg]'
                  : 'stroke-[#C9A15D]'
              }`}
            />
            <rect
              x="6"
              y="13"
              width="18"
              height="13"
              rx="3"
              className={`transition-colors duration-400 ${
                unlocked ? 'fill-[#6FA88C]' : 'fill-[#C9A15D]'
              }`}
            />
          </svg>
        </div>
      </div>
    </div>
  );
};
