import React, { useState } from 'react';
import { X, Save, Paperclip, FileText, Plus } from 'lucide-react';
import { Asset, AssetCategory, DocumentType, DocumentAttachment } from '../types/asset';

interface AddAssetModalProps {
  initialAsset?: Asset | null;
  onClose: () => void;
  onSave: (asset: Omit<Asset, 'id' | 'userId' | 'createdAt' | 'updatedAt'> | Asset) => void;
}

export const AddAssetModal: React.FC<AddAssetModalProps> = ({
  initialAsset,
  onClose,
  onSave,
}) => {
  const [assetName, setAssetName] = useState(initialAsset?.assetName || '');
  const [category, setCategory] = useState<AssetCategory>(initialAsset?.category || 'vehicular');
  const [docType, setDocType] = useState<DocumentType>(initialAsset?.docType || 'Vehicle Insurance');
  const [owner, setOwner] = useState(initialAsset?.owner || '');
  const [vendor, setVendor] = useState(initialAsset?.vendor || '');
  const [manufacturer, setManufacturer] = useState(initialAsset?.manufacturer || '');
  const [model, setModel] = useState(initialAsset?.model || '');
  const [purchasePrice, setPurchasePrice] = useState(initialAsset?.purchasePrice || '');
  const [purchaseDate, setPurchaseDate] = useState(initialAsset?.purchaseDate || '');
  const [expiryDate, setExpiryDate] = useState(initialAsset?.expiryDate || '');
  const [warrantyEnds, setWarrantyEnds] = useState(initialAsset?.warrantyEnds || '');
  const [warrantyType, setWarrantyType] = useState(initialAsset?.warrantyType || '');
  const [serialNumber, setSerialNumber] = useState(initialAsset?.serialNumber || '');
  const [invoice, setInvoice] = useState(initialAsset?.invoice || '');
  const [notes, setNotes] = useState(initialAsset?.notes || '');
  const [addOnsText, setAddOnsText] = useState(initialAsset?.addOns?.join(', ') || '');
  const [remindersText, setRemindersText] = useState(initialAsset?.reminders?.join(', ') || '');
  const [contactsText, setContactsText] = useState(initialAsset?.contacts?.join(', ') || '');

  // File attachment
  const [attachment, setAttachment] = useState<DocumentAttachment | undefined>(initialAsset?.attachment);
  const [attachedFileName, setAttachedFileName] = useState<string>(initialAsset?.attachment?.filename || '');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachedFileName(file.name);
    const reader = new FileReader();

    if (file.type.startsWith('image/')) {
      reader.onload = () => {
        const res = reader.result as string;
        setAttachment({
          id: `doc-${Date.now()}`,
          filename: file.name,
          mimeType: file.type,
          base64Data: res.split(',')[1] || '',
          uploadedAt: new Date().toISOString(),
        });
      };
      reader.readAsDataURL(file);
    } else if (file.type === 'text/plain') {
      reader.onload = () => {
        const txt = reader.result as string;
        setAttachment({
          id: `doc-${Date.now()}`,
          filename: file.name,
          mimeType: file.type,
          textData: txt,
          uploadedAt: new Date().toISOString(),
        });
      };
      reader.readAsText(file);
    } else {
      reader.onload = () => {
        const res = reader.result as string;
        setAttachment({
          id: `doc-${Date.now()}`,
          filename: file.name,
          mimeType: file.type || 'application/pdf',
          base64Data: res.split(',')[1] || '',
          uploadedAt: new Date().toISOString(),
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetName.trim()) {
      alert('Please enter an Asset Name.');
      return;
    }

    const addOns = addOnsText ? addOnsText.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const reminders = remindersText ? remindersText.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const contacts = contactsText ? contactsText.split(',').map((s) => s.trim()).filter(Boolean) : [];

    if (initialAsset) {
      onSave({
        ...initialAsset,
        assetName,
        category,
        docType,
        owner,
        vendor,
        manufacturer,
        model,
        purchasePrice,
        purchaseDate,
        expiryDate,
        warrantyEnds,
        warrantyType,
        serialNumber,
        invoice,
        notes,
        addOns,
        reminders,
        contacts,
        attachment,
        updatedAt: new Date().toISOString(),
      });
    } else {
      onSave({
        assetName,
        category,
        docType,
        owner,
        vendor,
        manufacturer,
        model,
        purchasePrice,
        purchaseDate,
        expiryDate,
        warrantyEnds,
        warrantyType,
        serialNumber,
        invoice,
        notes,
        addOns,
        reminders,
        contacts,
        attachment,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#080F0D]/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[#16261F] border border-[#2A3B33] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#1C2E26] border-b border-[#2A3B33] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#C9A15D]/15 text-[#E4C98A] border border-[#C9A15D]/30">
              <Plus size={18} />
            </div>
            <h2 className="text-lg font-serif font-medium text-[#EDEDE1]">
              {initialAsset ? 'Edit Asset Record' : 'Add New Asset to Vault'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8FA79B] hover:text-[#EDEDE1] hover:bg-[#2A3B33]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
                Asset Name / Title *
              </label>
              <input
                type="text"
                required
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                placeholder="e.g. Maruti Suzuki Celerio"
                className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] focus:border-[#C9A15D] outline-none"
              />
            </div>

            <div>
              <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AssetCategory)}
                className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] focus:border-[#C9A15D] outline-none"
              >
                <option value="vehicular">Vehicular</option>
                <option value="electronics">Electronics</option>
                <option value="camera">Camera & Optics</option>
                <option value="watch">Watches</option>
                <option value="appliances">Appliances</option>
                <option value="health">Health Insurance</option>
                <option value="identity">Identity & Documents</option>
                <option value="property">Property</option>
                <option value="finance">Finance</option>
                <option value="furniture">Furniture</option>
                <option value="jewellery">Jewellery</option>
                <option value="machinery">Machinery</option>
                <option value="subscriptions">Subscriptions</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
                Document Type
              </label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as DocumentType)}
                className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] focus:border-[#C9A15D] outline-none"
              >
                <option value="Vehicle Insurance">Vehicle Insurance</option>
                <option value="Vehicle Registration Certificate (RC)">Vehicle Registration Certificate (RC)</option>
                <option value="Invoice">Invoice</option>
                <option value="Receipt">Receipt</option>
                <option value="Warranty Certificate">Warranty Certificate</option>
                <option value="Extended Warranty">Extended Warranty</option>
                <option value="Service Record">Service Record</option>
                <option value="User Manual">User Manual</option>
                <option value="Property Document">Property Document</option>
                <option value="Health Insurance">Health Insurance</option>
                <option value="Bank / Investment Statement">Bank / Investment Statement</option>
                <option value="Subscription / Membership">Subscription / Membership</option>
                <option value="Other Document">Other Document</option>
              </select>
            </div>

            <div>
              <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
                Owner / Account Holder Name
              </label>
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="e.g. Siddhant"
                className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] focus:border-[#C9A15D] outline-none"
              />
            </div>

            <div>
              <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
                Vendor / Seller / Insurer
              </label>
              <input
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g. Acko Insurance / Dell / Apple"
                className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] focus:border-[#C9A15D] outline-none"
              />
            </div>

            <div>
              <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
                Manufacturer / Brand
              </label>
              <input
                type="text"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="e.g. Maruti Suzuki / Dell"
                className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] focus:border-[#C9A15D] outline-none"
              />
            </div>

            <div>
              <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
                Model Name / Number
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. Celerio ZXI+"
                className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] focus:border-[#C9A15D] outline-none"
              />
            </div>

            <div>
              <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
                Serial / Policy Number
              </label>
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="e.g. ACK-MOT-948201"
                className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#E4C98A] font-mono focus:border-[#C9A15D] outline-none"
              />
            </div>

            <div>
              <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
                Purchase Price
              </label>
              <input
                type="text"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="e.g. ₹ 6,85,000 or $1,200"
                className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] focus:border-[#C9A15D] outline-none"
              />
            </div>

            <div>
              <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
                Purchase / Start Date (DD/MM/YYYY)
              </label>
              <input
                type="text"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                placeholder="15/04/2023"
                className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] font-mono focus:border-[#C9A15D] outline-none"
              />
            </div>

            <div>
              <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
                Expiry Date (DD/MM/YYYY)
              </label>
              <input
                type="text"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                placeholder="14/04/2027"
                className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] font-mono focus:border-[#C9A15D] outline-none"
              />
            </div>

            <div>
              <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
                Warranty Tier / Entitlement
              </label>
              <input
                type="text"
                value={warrantyType}
                onChange={(e) => setWarrantyType(e.target.value)}
                placeholder="e.g. 4 Year Extended Warranty"
                className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] focus:border-[#C9A15D] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
              Add-ons / Covers (comma separated)
            </label>
            <input
              type="text"
              value={addOnsText}
              onChange={(e) => setAddOnsText(e.target.value)}
              placeholder="Zero Depreciation, Roadside Assistance, Engine Protect"
              className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] focus:border-[#C9A15D] outline-none"
            />
          </div>

          <div>
            <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
              Support Helplines / Contacts (comma separated)
            </label>
            <input
              type="text"
              value={contactsText}
              onChange={(e) => setContactsText(e.target.value)}
              placeholder="Support Phone: 1800-266-2256, help@acko.com"
              className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] focus:border-[#C9A15D] outline-none"
            />
          </div>

          <div>
            <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
              Notes & Terms
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Important notes, coverage terms, or location..."
              className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] focus:border-[#C9A15D] outline-none resize-none"
            />
          </div>

          {/* Document attachment */}
          <div className="pt-2 border-t border-[#2A3B33]">
            <label className="block text-[#8FA79B] font-mono text-[11px] mb-1.5">
              Attach Document / Receipt (PDF, Image, Text)
            </label>
            <label className="flex items-center gap-2 p-3 bg-[#1C2E26] border border-[#2A3B33] hover:border-[#C9A15D] rounded-xl cursor-pointer text-xs text-[#EDEDE1]">
              <Paperclip size={16} className="text-[#C9A15D]" />
              <span className="truncate">
                {attachedFileName ? attachedFileName : 'Choose document file...'}
              </span>
              <input
                type="file"
                accept="image/*,application/pdf,.docx,text/plain"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {/* Save submit */}
          <button
            type="submit"
            className="w-full bg-[#C9A15D] hover:bg-[#E4C98A] text-[#14211B] font-bold py-3 rounded-xl transition-colors shadow-md mt-4 text-sm flex items-center justify-center gap-2"
          >
            <Save size={16} /> Save Asset to Vault
          </button>
        </form>
      </div>
    </div>
  );
};
