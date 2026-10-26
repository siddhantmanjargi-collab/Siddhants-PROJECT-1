import React, { useState } from 'react';
import {
  X,
  FileText,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Phone,
  Mail,
  Edit2,
  Trash2,
  Paperclip,
  Eye,
  ShieldAlert,
  Tag,
  Share2
} from 'lucide-react';
import { Asset } from '../types/asset';
import { calculateDaysRemaining, formatDateDisplay, getAssetStatus } from '../utils/storage';
import { DocumentViewerModal } from './DocumentViewerModal';

interface AssetDetailModalProps {
  asset: Asset;
  onClose: () => void;
  onEdit: (asset: Asset) => void;
  onDelete: (id: string) => void;
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  asset,
  onClose,
  onEdit,
  onDelete,
}) => {
  const [showDocViewer, setShowDocViewer] = useState(false);
  const days = calculateDaysRemaining(asset.expiryDate);
  const status = getAssetStatus(asset.expiryDate);

  const handleDeleteConfirm = () => {
    if (confirm(`Are you sure you want to delete "${asset.assetName}" from your vault?`)) {
      onDelete(asset.id);
      onClose();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-[#080F0D]/80 backdrop-blur-sm animate-fade-in">
        <div className="bg-[#16261F] border border-[#2A3B33] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="p-5 bg-[#1C2E26] border-b border-[#2A3B33] flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider bg-[#C9A15D]/20 text-[#E4C98A] border border-[#C9A15D]/40 font-semibold">
                  {asset.category}
                </span>
                {asset.docType && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono text-[#8FA79B] border border-[#2A3B33] bg-[#16261F]">
                    {asset.docType}
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-serif font-medium text-[#EDEDE1]">
                {asset.assetName}
              </h2>
              {asset.owner && (
                <p className="text-xs text-[#8FA79B] font-mono mt-0.5">
                  Owner / Holder: {asset.owner}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onEdit(asset)}
                className="p-2 rounded-lg text-[#8FA79B] hover:text-[#C9A15D] hover:bg-[#2A3B33] transition-colors"
                title="Edit Asset"
              >
                <Edit2 size={18} />
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="p-2 rounded-lg text-[#8FA79B] hover:text-[#C97B6B] hover:bg-[#2A3B33] transition-colors"
                title="Delete Asset"
              >
                <Trash2 size={18} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-[#8FA79B] hover:text-[#EDEDE1] hover:bg-[#2A3B33] transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Modal Scroll Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
            {/* Expiry Banner */}
            {status === 'danger' && (
              <div className="bg-[#C97B6B]/15 border border-[#C97B6B]/40 rounded-xl p-4 flex items-start gap-3 text-[#C97B6B]">
                <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm">Asset Expiry Alert: Expired</h4>
                  <p className="text-xs text-[#EDEDE1]/80 mt-0.5">
                    This document or warranty expired on {formatDateDisplay(asset.expiryDate)}. Please renew or re-verify.
                  </p>
                </div>
              </div>
            )}

            {status === 'warn' && (
              <div className="bg-[#E0913F]/15 border border-[#E0913F]/40 rounded-xl p-4 flex items-start gap-3 text-[#E0913F]">
                <Clock size={20} className="shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm">Expiring Soon ({days} days remaining)</h4>
                  <p className="text-xs text-[#EDEDE1]/80 mt-0.5">
                    Expiry / renewal date is {formatDateDisplay(asset.expiryDate)}. Take action to extend coverage.
                  </p>
                </div>
              </div>
            )}

            {status === 'safe' && asset.expiryDate && (
              <div className="bg-[#6FA88C]/15 border border-[#6FA88C]/40 rounded-xl p-3.5 flex items-center justify-between text-[#6FA88C] font-mono text-xs">
                <span className="flex items-center gap-2">
                  <CheckCircle size={16} /> Valid & Active
                </span>
                <span>Expires: {formatDateDisplay(asset.expiryDate)} ({days} days left)</span>
              </div>
            )}

            {/* Document Card Access */}
            {asset.attachment && (
              <div className="bg-[#1C2E26] border border-[#C9A15D]/50 rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-lg bg-[#C9A15D]/15 text-[#E4C98A] border border-[#C9A15D]/30 shrink-0">
                    <Paperclip size={20} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-[#EDEDE1] truncate">
                      {asset.attachment.filename}
                    </h4>
                    <p className="text-xs text-[#8FA79B] font-mono">
                      {asset.attachment.mimeType} • Uploaded {formatDateDisplay(asset.attachment.uploadedAt)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDocViewer(true)}
                  className="px-3 py-2 bg-[#C9A15D] hover:bg-[#E4C98A] text-[#14211B] font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <Eye size={14} /> View Document
                </button>
              </div>
            )}

            {/* Spec Grid */}
            <div>
              <h3 className="font-mono text-xs uppercase tracking-wider text-[#C9A15D] mb-3">
                Key Details & Specifications
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#1C2E26] border border-[#2A3B33] rounded-xl p-4 text-xs font-mono">
                {asset.vendor && (
                  <div>
                    <span className="text-[#8FA79B] block">Vendor / Insurer:</span>
                    <span className="text-[#EDEDE1] font-semibold">{asset.vendor}</span>
                  </div>
                )}

                {asset.manufacturer && (
                  <div>
                    <span className="text-[#8FA79B] block">Manufacturer / Brand:</span>
                    <span className="text-[#EDEDE1] font-semibold">{asset.manufacturer}</span>
                  </div>
                )}

                {asset.model && (
                  <div>
                    <span className="text-[#8FA79B] block">Model:</span>
                    <span className="text-[#EDEDE1] font-semibold">{asset.model}</span>
                  </div>
                )}

                {asset.serialNumber && (
                  <div>
                    <span className="text-[#8FA79B] block">Serial / Policy Number:</span>
                    <span className="text-[#E4C98A] font-semibold">{asset.serialNumber}</span>
                  </div>
                )}

                {asset.purchasePrice && (
                  <div>
                    <span className="text-[#8FA79B] block">Purchase Price / Premium:</span>
                    <span className="text-[#EDEDE1] font-semibold">{asset.purchasePrice}</span>
                  </div>
                )}

                {asset.purchaseDate && (
                  <div>
                    <span className="text-[#8FA79B] block">Purchase / Issue Date:</span>
                    <span className="text-[#EDEDE1]">{formatDateDisplay(asset.purchaseDate)}</span>
                  </div>
                )}

                {asset.expiryDate && (
                  <div>
                    <span className="text-[#8FA79B] block">Expiry Date:</span>
                    <span className="text-[#EDEDE1]">{formatDateDisplay(asset.expiryDate)}</span>
                  </div>
                )}

                {asset.warrantyEnds && (
                  <div>
                    <span className="text-[#8FA79B] block">Warranty Expiration:</span>
                    <span className="text-[#EDEDE1]">{formatDateDisplay(asset.warrantyEnds)}</span>
                  </div>
                )}

                {asset.warrantyType && (
                  <div className="col-span-1 sm:col-span-2">
                    <span className="text-[#8FA79B] block">Warranty Tier:</span>
                    <span className="text-[#6FA88C] font-semibold">{asset.warrantyType}</span>
                  </div>
                )}

                {asset.invoice && (
                  <div>
                    <span className="text-[#8FA79B] block">Invoice Reference:</span>
                    <span className="text-[#EDEDE1]">{asset.invoice}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Category Specific Fields */}
            {asset.categoryFields && Object.keys(asset.categoryFields).length > 0 && (
              <div>
                <h3 className="font-mono text-xs uppercase tracking-wider text-[#C9A15D] mb-3">
                  Category Record Data
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#1C2E26] border border-[#2A3B33] rounded-xl p-4 text-xs font-mono">
                  {Object.entries(asset.categoryFields).map(([k, v]) => (
                    v ? (
                      <div key={k}>
                        <span className="text-[#8FA79B] block capitalize">
                          {k.replace(/([A-Z])/g, ' $1')}:
                        </span>
                        <span className="text-[#EDEDE1]">{v}</span>
                      </div>
                    ) : null
                  ))}
                </div>
              </div>
            )}

            {/* AddOns */}
            {asset.addOns && asset.addOns.length > 0 && (
              <div>
                <h3 className="font-mono text-xs uppercase tracking-wider text-[#C9A15D] mb-2">
                  Coverage Add-ons & Benefits
                </h3>
                <div className="flex flex-wrap gap-2">
                  {asset.addOns.map((addon, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-md text-xs bg-[#6FA88C]/15 text-[#6FA88C] border border-[#6FA88C]/30 flex items-center gap-1.5 font-medium"
                    >
                      <Tag size={12} /> {addon}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Reminders */}
            {asset.reminders && asset.reminders.length > 0 && (
              <div>
                <h3 className="font-mono text-xs uppercase tracking-wider text-[#C9A15D] mb-2">
                  Key Action Reminders
                </h3>
                <div className="space-y-2">
                  {asset.reminders.map((rem, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-[#E0913F]/10 border border-[#E0913F]/30 text-xs text-[#E4C98A] flex items-center gap-2"
                    >
                      <Clock size={14} className="shrink-0 text-[#E0913F]" />
                      <span>{rem}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Support Contacts */}
            {asset.contacts && asset.contacts.length > 0 && (
              <div>
                <h3 className="font-mono text-xs uppercase tracking-wider text-[#C9A15D] mb-2">
                  Helpline & Support Contacts
                </h3>
                <div className="space-y-2">
                  {asset.contacts.map((contact, idx) => {
                    const isPhone = contact.toLowerCase().includes('phone') || /\d{5,}/.test(contact);
                    const isEmail = contact.includes('@');
                    const cleanPhone = contact.replace(/[^0-9+]/g, '');

                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-[#1C2E26] border border-[#2A3B33] text-xs flex items-center justify-between gap-2"
                      >
                        <span className="text-[#EDEDE1] font-mono">{contact}</span>
                        {isPhone && cleanPhone && (
                          <a
                            href={`tel:${cleanPhone}`}
                            className="px-2.5 py-1 rounded bg-[#C9A15D]/20 text-[#E4C98A] hover:bg-[#C9A15D] hover:text-[#14211B] transition-colors font-mono font-bold flex items-center gap-1"
                          >
                            <Phone size={12} /> Call
                          </a>
                        )}
                        {isEmail && (
                          <a
                            href={`mailto:${contact.split(':').pop()?.trim()}`}
                            className="px-2.5 py-1 rounded bg-[#C9A15D]/20 text-[#E4C98A] hover:bg-[#C9A15D] hover:text-[#14211B] transition-colors font-mono font-bold flex items-center gap-1"
                          >
                            <Mail size={12} /> Email
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notes */}
            {asset.notes && (
              <div>
                <h3 className="font-mono text-xs uppercase tracking-wider text-[#C9A15D] mb-2">
                  Notes & Terms
                </h3>
                <div className="p-3.5 rounded-xl bg-[#1C2E26] border border-[#2A3B33] text-xs text-[#8FA79B] leading-relaxed">
                  {asset.notes}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showDocViewer && asset.attachment && (
        <DocumentViewerModal
          attachment={asset.attachment}
          assetName={asset.assetName}
          onClose={() => setShowDocViewer(false)}
        />
      )}
    </>
  );
};
