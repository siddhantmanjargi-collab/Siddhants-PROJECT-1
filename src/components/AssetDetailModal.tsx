import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle,
  Clock,
  Phone,
  Mail,
  Edit2,
  Trash2,
  Paperclip,
  Eye
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const days = calculateDaysRemaining(asset.expiryDate);
  const status = getAssetStatus(asset.expiryDate);

  const handleConfirmDelete = () => {
    onDelete(asset.id);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-[#080F0D]/80 backdrop-blur-sm">
        <div className="bg-[#16261F] border border-[#2A3B33] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="p-5 bg-[#1C2E26] border-b border-[#2A3B33] flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-[#C9A15D] font-mono mb-1">
                <span className="capitalize">{asset.category}</span>
                {asset.docType && (
                  <>
                    <span aria-hidden="true" className="text-[#8FA79B]">·</span>
                    <span className="text-[#8FA79B]">{asset.docType}</span>
                  </>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-serif font-medium text-[#EDEDE1]">
                {asset.assetName}
              </h2>
              {asset.owner && (
                <p className="text-xs text-[#8FA79B] font-mono mt-0.5">
                  Owner: {asset.owner}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {confirmingDelete ? (
                <div className="flex items-center gap-1.5 bg-[#16261F] border border-[#C97B6B]/50 rounded-lg px-2 py-1">
                  <span className="text-xs text-[#C97B6B] font-medium whitespace-nowrap">Delete?</span>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    className="px-2 py-0.5 rounded bg-[#C97B6B] text-[#14211B] text-xs font-semibold whitespace-nowrap"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="px-2 py-0.5 rounded bg-[#2A3B33] text-[#EDEDE1] text-xs whitespace-nowrap"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
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
                    onClick={() => setConfirmingDelete(true)}
                    className="p-2 rounded-lg text-[#8FA79B] hover:text-[#C97B6B] hover:bg-[#2A3B33] transition-colors"
                    title="Delete Asset"
                  >
                    <Trash2 size={18} />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-[#8FA79B] hover:text-[#EDEDE1] hover:bg-[#2A3B33] transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Scroll Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
            {status === 'danger' && (
              <div className="bg-[#C97B6B]/15 border border-[#C97B6B]/40 rounded-xl p-4 flex items-start gap-3 text-[#C97B6B]">
                <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm">Expired</h4>
                  <p className="text-xs text-[#EDEDE1]/85 mt-0.5">
                    Expired on {formatDateDisplay(asset.expiryDate)}. Please renew or update this document.
                  </p>
                </div>
              </div>
            )}

            {status === 'warn' && (
              <div className="bg-[#E0913F]/15 border border-[#E0913F]/40 rounded-xl p-4 flex items-start gap-3 text-[#E0913F]">
                <Clock size={20} className="shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm tabular-nums">
                    Expiring Soon ({days} days remaining)
                  </h4>
                  <p className="text-xs text-[#EDEDE1]/85 mt-0.5">
                    Renewal due by {formatDateDisplay(asset.expiryDate)}.
                  </p>
                </div>
              </div>
            )}

            {status === 'safe' && asset.expiryDate && (
              <div className="bg-[#6FA88C]/15 border border-[#6FA88C]/40 rounded-xl p-3.5 flex items-center justify-between text-[#6FA88C] font-mono text-xs tabular-nums">
                <span className="flex items-center gap-2">
                  <CheckCircle size={16} /> Active Coverage
                </span>
                <span>Expires {formatDateDisplay(asset.expiryDate)} · {days}d left</span>
              </div>
            )}

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
                      {asset.attachment.mimeType} · Uploaded {formatDateDisplay(asset.attachment.uploadedAt)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDocViewer(true)}
                  className="px-3.5 py-2 bg-[#C9A15D] hover:bg-[#E4C98A] text-[#14211B] font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                >
                  <Eye size={14} /> View Document
                </button>
              </div>
            )}

            {/* Key Specifications */}
            <div>
              <h3 className="font-semibold text-sm text-[#C9A15D] mb-3">
                Key Specifications
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-3 border-y border-[#2A3B33] text-xs font-mono tabular-nums">
                {asset.vendor && (
                  <div>
                    <span className="text-[#8FA79B] block">Vendor / Insurer</span>
                    <span className="text-[#EDEDE1] font-semibold">{asset.vendor}</span>
                  </div>
                )}

                {asset.manufacturer && (
                  <div>
                    <span className="text-[#8FA79B] block">Manufacturer / Brand</span>
                    <span className="text-[#EDEDE1] font-semibold">{asset.manufacturer}</span>
                  </div>
                )}

                {asset.model && (
                  <div>
                    <span className="text-[#8FA79B] block">Model</span>
                    <span className="text-[#EDEDE1] font-semibold">{asset.model}</span>
                  </div>
                )}

                {asset.serialNumber && (
                  <div>
                    <span className="text-[#8FA79B] block">Serial / Policy Number</span>
                    <span className="text-[#E4C98A] font-semibold">{asset.serialNumber}</span>
                  </div>
                )}

                {asset.purchasePrice && (
                  <div>
                    <span className="text-[#8FA79B] block">Purchase Price / Amount</span>
                    <span className="text-[#EDEDE1] font-semibold">{asset.purchasePrice}</span>
                  </div>
                )}

                {asset.purchaseDate && (
                  <div>
                    <span className="text-[#8FA79B] block">Purchase / Issue Date</span>
                    <span className="text-[#EDEDE1]">{formatDateDisplay(asset.purchaseDate)}</span>
                  </div>
                )}

                {asset.expiryDate && (
                  <div>
                    <span className="text-[#8FA79B] block">Expiry Date</span>
                    <span className="text-[#EDEDE1]">{formatDateDisplay(asset.expiryDate)}</span>
                  </div>
                )}

                {asset.renewalDate && (
                  <div>
                    <span className="text-[#8FA79B] block">Renewal Due Date</span>
                    <span className="text-[#E4C98A]">{formatDateDisplay(asset.renewalDate)}</span>
                  </div>
                )}

                {asset.warrantyEnds && (
                  <div>
                    <span className="text-[#8FA79B] block">Warranty Expiration</span>
                    <span className="text-[#EDEDE1]">{formatDateDisplay(asset.warrantyEnds)}</span>
                  </div>
                )}

                {asset.warrantyType && (
                  <div className="col-span-1 sm:col-span-2">
                    <span className="text-[#8FA79B] block">Warranty Tier</span>
                    <span className="text-[#6FA88C] font-semibold">{asset.warrantyType}</span>
                  </div>
                )}

                {asset.invoice && (
                  <div>
                    <span className="text-[#8FA79B] block">Invoice Reference</span>
                    <span className="text-[#EDEDE1]">{asset.invoice}</span>
                  </div>
                )}

                {asset.verificationUrl && (
                  <div className="col-span-1 sm:col-span-2">
                    <span className="text-[#8FA79B] block">Verification / Portal URL</span>
                    <span className="text-[#E4C98A] break-all">{asset.verificationUrl}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Line Items Table (if extracted from invoice/policy) */}
            {(() => {
              const rawItems = asset.categoryFields?.__lineItemsJson;
              if (!rawItems) return null;
              let parsedItems: {
                description: string;
                quantity?: string;
                unitPrice?: string;
                amount?: string;
              }[] = [];
              try {
                const candidate = JSON.parse(rawItems);
                if (Array.isArray(candidate)) parsedItems = candidate;
              } catch {
                return null;
              }
              if (parsedItems.length === 0) return null;

              return (
                <div>
                  <h3 className="font-semibold text-sm text-[#C9A15D] mb-2.5">
                    Itemized Breakdown
                  </h3>
                  <div className="bg-[#1C2E26] border border-[#2A3B33] rounded-xl overflow-hidden divide-y divide-[#2A3B33] text-xs font-mono">
                    {parsedItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="px-3.5 py-2.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <span className="text-[#EDEDE1] block break-words">
                            {item.description}
                          </span>
                          {(item.quantity || item.unitPrice) && (
                            <span className="text-[11px] text-[#8FA79B]">
                              {item.quantity ? `Qty: ${item.quantity}` : ''}
                              {item.quantity && item.unitPrice ? ' · ' : ''}
                              {item.unitPrice ? `Unit: ${item.unitPrice}` : ''}
                            </span>
                          )}
                        </div>
                        {item.amount && (
                          <span className="text-[#E4C98A] font-semibold tabular-nums shrink-0">
                            {item.amount}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Category & Document Specific Fields */}
            {asset.categoryFields &&
              Object.entries(asset.categoryFields).some(
                ([k, v]) =>
                  Boolean(v) &&
                  k !== '__lineItemsJson' &&
                  k !== 'renewalDate' &&
                  k !== 'verificationUrl'
              ) && (
                <div>
                  <h3 className="font-semibold text-sm text-[#C9A15D] mb-3">
                    Extracted Document Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-3 border-b border-[#2A3B33] text-xs font-mono tabular-nums">
                    {Object.entries(asset.categoryFields).map(([k, v]) => {
                      if (
                        !v ||
                        k === '__lineItemsJson' ||
                        k === 'renewalDate' ||
                        k === 'verificationUrl'
                      ) {
                        return null;
                      }
                      const cleanLabel = k.startsWith('detail__')
                        ? k.slice('detail__'.length)
                        : k.replace(/([A-Z])/g, ' $1');
                      return (
                        <div key={k} className="break-words">
                          <span className="text-[#8FA79B] block capitalize">{cleanLabel}</span>
                          <span className="text-[#EDEDE1]">{v}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* AddOns */}
            {asset.addOns && asset.addOns.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm text-[#C9A15D] mb-1.5">
                  Coverage Add-ons & Benefits
                </h3>
                <p className="text-xs text-[#EDEDE1] leading-relaxed">
                  {asset.addOns.join(' · ')}
                </p>
              </div>
            )}

            {/* Reminders */}
            {asset.reminders && asset.reminders.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm text-[#C9A15D] mb-2">
                  Action Reminders
                </h3>
                <ul className="space-y-2">
                  {asset.reminders.map((rem, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-[#E4C98A] flex items-center gap-2"
                    >
                      <Clock size={14} className="shrink-0 text-[#E0913F]" />
                      <span>{rem}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Contacts */}
            {asset.contacts && asset.contacts.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm text-[#C9A15D] mb-2">
                  Support & Helpline Contacts
                </h3>
                <div className="divide-y divide-[#2A3B33] border-y border-[#2A3B33]">
                  {asset.contacts.map((contact, idx) => {
                    const isPhone = contact.toLowerCase().includes('phone') || /\d{5,}/.test(contact);
                    const isEmail = contact.includes('@');
                    const cleanPhone = contact.replace(/[^0-9+]/g, '');

                    return (
                      <div
                        key={idx}
                        className="py-2.5 text-xs flex items-center justify-between gap-2"
                      >
                        <span className="text-[#EDEDE1] font-mono tabular-nums">{contact}</span>
                        {isPhone && cleanPhone && (
                          <a
                            href={`tel:${cleanPhone}`}
                            className="px-2.5 py-1 rounded bg-[#1C2E26] border border-[#2A3B33] text-[#E4C98A] hover:border-[#C9A15D] transition-colors font-mono font-semibold flex items-center gap-1 whitespace-nowrap"
                          >
                            <Phone size={12} /> Call
                          </a>
                        )}
                        {isEmail && (
                          <a
                            href={`mailto:${contact.split(':').pop()?.trim()}`}
                            className="px-2.5 py-1 rounded bg-[#1C2E26] border border-[#2A3B33] text-[#E4C98A] hover:border-[#C9A15D] transition-colors font-mono font-semibold flex items-center gap-1 whitespace-nowrap"
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

            {asset.notes && (
              <div>
                <h3 className="font-semibold text-sm text-[#C9A15D] mb-1.5">
                  Notes & Terms
                </h3>
                <p className="text-xs text-[#8FA79B] leading-relaxed">
                  {asset.notes}
                </p>
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
