import React from 'react';
import { FileText, Shield, AlertTriangle, CheckCircle, Clock, Paperclip } from 'lucide-react';
import { Asset } from '../types/asset';
import { calculateDaysRemaining, formatDateDisplay, getAssetStatus } from '../utils/storage';

interface AssetCardProps {
  asset: Asset;
  onClick: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  vehicular: '#7FA3C9',
  electronics: '#A98BC9',
  camera: '#7FA3C9',
  watch: '#E4C98A',
  appliances: '#E09F67',
  health: '#E74C3C',
  identity: '#1ABC9C',
  property: '#6FB89A',
  finance: '#C9A15D',
  furniture: '#D9A17F',
  jewellery: '#F3C649',
  machinery: '#95A5A6',
  subscriptions: '#C98BAE',
  other: '#8FA79B',
};

export const AssetCard: React.FC<AssetCardProps> = ({ asset, onClick }) => {
  const days = calculateDaysRemaining(asset.expiryDate);
  const status = getAssetStatus(asset.expiryDate);

  const dotColor = CATEGORY_COLORS[asset.category] || '#8FA79B';

  return (
    <div
      onClick={onClick}
      className={`group relative flex items-center gap-3 bg-[#1C2E26] border rounded-xl p-3.5 sm:p-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${
        status === 'danger'
          ? 'border-[#C97B6B]/40 bg-[#C97B6B]/10 hover:border-[#C97B6B]'
          : status === 'warn'
          ? 'border-[#E0913F]/40 bg-[#E0913F]/10 hover:border-[#E0913F]'
          : 'border-[#2A3B33] hover:border-[#C9A15D]'
      }`}
    >
      {/* Category color dot */}
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
        style={{ backgroundColor: dotColor }}
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-[#EDEDE1] font-semibold text-sm sm:text-base truncate group-hover:text-[#E4C98A] transition-colors">
            {asset.assetName}
          </h3>
          {asset.docType && (
            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[#C9A15D]/15 text-[#E4C98A] border border-[#C9A15D]/30 shrink-0">
              {asset.docType}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-[#8FA79B] mt-1 font-mono flex-wrap">
          {asset.vendor && <span>{asset.vendor}</span>}
          {asset.model && <span>• {asset.model}</span>}
          {asset.serialNumber && <span>• SN: {asset.serialNumber}</span>}
        </div>
      </div>

      {/* Right status badge & attachment indicator */}
      <div className="flex items-center gap-2 shrink-0">
        {asset.attachment && (
          <span className="p-1 rounded bg-[#2A3B33] text-[#C9A15D] text-xs flex items-center gap-1" title="Document attached">
            <Paperclip size={13} />
          </span>
        )}

        {status === 'danger' && (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider uppercase bg-[#C97B6B]/20 text-[#C97B6B] border border-[#C97B6B]/30 flex items-center gap-1">
            <AlertTriangle size={12} /> Expired
          </span>
        )}

        {status === 'warn' && (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider uppercase bg-[#E0913F]/20 text-[#E0913F] border border-[#E0913F]/30 flex items-center gap-1">
            <Clock size={12} /> {days}d left
          </span>
        )}

        {status === 'safe' && (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider uppercase bg-[#6FA88C]/20 text-[#6FA88C] border border-[#6FA88C]/30 flex items-center gap-1">
            <CheckCircle size={12} /> Safe
          </span>
        )}

        {status === 'unset' && (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-mono text-[#8FA79B] bg-[#16261F]">
            No Expiry
          </span>
        )}
      </div>
    </div>
  );
};
