import React from 'react';
import { AlertTriangle, CheckCircle, Clock, Paperclip } from 'lucide-react';
import { Asset } from '../types/asset';
import { calculateDaysRemaining, getAssetStatus } from '../utils/storage';

interface AssetCardProps {
  asset: Asset;
  onClick: () => void;
}

export const AssetCard: React.FC<AssetCardProps> = ({ asset, onClick }) => {
  const days = calculateDaysRemaining(asset.expiryDate);
  const status = getAssetStatus(asset.expiryDate);

  const metaParts = [
    asset.docType,
    asset.vendor,
    asset.model,
    asset.serialNumber ? `SN ${asset.serialNumber}` : null,
  ].filter(Boolean);

  return (
    <div
      onClick={onClick}
      className={`group relative flex items-center justify-between gap-4 bg-[#1C2E26] border rounded-xl p-4 cursor-pointer transition-colors duration-150 ${
        status === 'danger'
          ? 'border-[#C97B6B]/45 bg-[#C97B6B]/10 hover:border-[#C97B6B]'
          : status === 'warn'
          ? 'border-[#E0913F]/45 bg-[#E0913F]/10 hover:border-[#E0913F]'
          : 'border-[#2A3B33] hover:border-[#C9A15D]'
      }`}
    >
      <div className="flex-1 min-w-0">
        <h3 className="text-[#EDEDE1] font-semibold text-sm sm:text-base truncate group-hover:text-[#E4C98A] transition-colors">
          {asset.assetName}
        </h3>

        {metaParts.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-[#8FA79B] mt-1 font-mono tabular-nums truncate">
            {metaParts.map((item, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span aria-hidden="true">·</span>}
                <span className="truncate">{item}</span>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0 font-mono text-xs tabular-nums">
        {asset.attachment && (
          <span className="text-[#C9A15D]" title="Document attached">
            <Paperclip size={14} />
          </span>
        )}

        {status === 'danger' && (
          <span className="text-[#C97B6B] font-semibold flex items-center gap-1 whitespace-nowrap">
            <AlertTriangle size={13} /> Expired
          </span>
        )}

        {status === 'warn' && (
          <span className="text-[#E0913F] font-semibold flex items-center gap-1 whitespace-nowrap">
            <Clock size={13} /> {days}d left
          </span>
        )}

        {status === 'safe' && (
          <span className="text-[#6FA88C] font-semibold flex items-center gap-1 whitespace-nowrap">
            <CheckCircle size={13} /> Safe
          </span>
        )}

        {status === 'unset' && (
          <span className="text-[#8FA79B] whitespace-nowrap">
            No Expiry
          </span>
        )}
      </div>
    </div>
  );
};
