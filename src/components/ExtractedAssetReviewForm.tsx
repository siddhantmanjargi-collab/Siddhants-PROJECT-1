import React, { useState } from 'react';
import {
  CheckCircle,
  FileText,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  AlertCircle
} from 'lucide-react';
import {
  Asset,
  AssetCategory,
  DocumentAttachment,
  DocumentType,
  ScanResultData
} from '../types/asset';

const CATEGORY_SPECIFIC_KEYS: Record<AssetCategory, { key: string; label: string }[]> = {
  vehicular: [
    { key: 'registrationNumber', label: 'Registration Number' },
    { key: 'engineNumber', label: 'Engine Number' },
    { key: 'chassisNumber', label: 'Chassis / VIN Number' },
    { key: 'vehicleType', label: 'Vehicle Type' },
    { key: 'fuelType', label: 'Fuel Type' },
    { key: 'cubicCapacity', label: 'Cubic Capacity (CC)' },
    { key: 'registrationYear', label: 'Registration Year' },
    { key: 'policyType', label: 'Policy Type' },
    { key: 'coverageType', label: 'Coverage Type' },
    { key: 'idv', label: 'Insured Declared Value (IDV)' },
    { key: 'ncbPercentage', label: 'NCB Percentage' },
  ],
  electronics: [
    { key: 'serviceTag', label: 'Service Tag' },
    { key: 'expressServiceCode', label: 'Express Service Code' },
    { key: 'assetId', label: 'Asset / System ID' },
    { key: 'storageOrSpecs', label: 'Processor / RAM / Storage Specs' },
    { key: 'imeiOrMac', label: 'IMEI / MAC Address' },
    { key: 'coverageDetails', label: 'Support Coverage Scope' },
  ],
  camera: [
    { key: 'lensDetails', label: 'Lens / Sensor Details' },
    { key: 'storageOrSpecs', label: 'Camera Specifications' },
    { key: 'assetId', label: 'Equipment Tag / ID' },
  ],
  watch: [
    { key: 'watchMovement', label: 'Movement / Case Material' },
    { key: 'imeiOrMac', label: 'Smartwatch IMEI / Serial' },
  ],
  appliances: [
    { key: 'applianceType', label: 'Appliance Type' },
    { key: 'capacity', label: 'Capacity / Tonnage' },
    { key: 'energyRating', label: 'Energy Star Rating' },
  ],
  health: [
    { key: 'policyType', label: 'Plan / Policy Type' },
    { key: 'coverageType', label: 'Hospitalization Coverage' },
    { key: 'idv', label: 'Sum Insured' },
  ],
  identity: [
    { key: 'assetId', label: 'Document / ID Number' },
    { key: 'coverageDetails', label: 'Issuing Authority / Place' },
  ],
  property: [
    { key: 'propertyAddress', label: 'Property Address' },
    { key: 'deedNumber', label: 'Deed / Registration Number' },
    { key: 'builtUpArea', label: 'Built-Up Area' },
  ],
  finance: [
    { key: 'institutionName', label: 'Bank / Financial Institution' },
    { key: 'accountOrFolioNumber', label: 'Account / Folio Number' },
    { key: 'idv', label: 'Maturity / Principal Value' },
  ],
  furniture: [
    { key: 'material', label: 'Material / Finish' },
  ],
  jewellery: [
    { key: 'jewelleryType', label: 'Jewellery Item Type' },
    { key: 'metalPurity', label: 'Metal Purity (e.g. 22K / 925)' },
    { key: 'grossWeightGrams', label: 'Gross Weight (Grams)' },
  ],
  machinery: [
    { key: 'capacity', label: 'Power / Capacity' },
    { key: 'assetId', label: 'Machine / Equipment Tag' },
  ],
  subscriptions: [
    { key: 'subscriptionPlan', label: 'Plan Tier' },
    { key: 'billingCycle', label: 'Billing Cycle' },
  ],
  other: [
    { key: 'assetId', label: 'Reference / Asset ID' },
    { key: 'coverageDetails', label: 'Additional Details' },
  ],
};

const ALL_EXTRACTED_EXTRA_KEYS = [
  'registrationNumber',
  'engineNumber',
  'chassisNumber',
  'vehicleType',
  'fuelType',
  'cubicCapacity',
  'registrationYear',
  'policyType',
  'coverageType',
  'idv',
  'ncbPercentage',
  'serviceTag',
  'expressServiceCode',
  'assetId',
  'coverageDetails',
  'storageOrSpecs',
  'imeiOrMac',
  'lensDetails',
  'watchMovement',
  'propertyAddress',
  'deedNumber',
  'builtUpArea',
  'institutionName',
  'accountOrFolioNumber',
  'applianceType',
  'capacity',
  'energyRating',
  'material',
  'jewelleryType',
  'metalPurity',
  'grossWeightGrams',
  'subscriptionPlan',
  'billingCycle',
] as const;

export interface ExtractedReviewFileMeta {
  filename: string;
  mimeType: string;
  base64Data: string;
  textData: string;
  previewUrl: string | null;
  sizeBytes: number;
}

interface ExtractedAssetReviewFormProps {
  extractedData: ScanResultData;
  fileMeta: ExtractedReviewFileMeta;
  defaultOwner?: string;
  submitLabel: string;
  isSubmitting?: boolean;
  onRescan: () => void;
  onCancelOrSkip?: () => void;
  cancelOrSkipLabel?: string;
  onConfirmSave: (assetPayload: Omit<Asset, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => void;
}

export const ExtractedAssetReviewForm: React.FC<ExtractedAssetReviewFormProps> = ({
  extractedData,
  fileMeta,
  defaultOwner = '',
  submitLabel,
  isSubmitting = false,
  onRescan,
  onCancelOrSkip,
  cancelOrSkipLabel,
  onConfirmSave,
}) => {
  const [category, setCategory] = useState<AssetCategory>(extractedData.category || 'other');
  const [docType, setDocType] = useState<DocumentType>(extractedData.docType || 'Other Document');
  const [assetName, setAssetName] = useState(
    extractedData.assetName || fileMeta.filename.replace(/\.[^/.]+$/, '') || 'Scanned Asset'
  );
  const [owner, setOwner] = useState(extractedData.owner || defaultOwner || '');
  const [vendor, setVendor] = useState(extractedData.vendor || '');
  const [manufacturer, setManufacturer] = useState(extractedData.manufacturer || '');
  const [model, setModel] = useState(extractedData.model || '');
  const [purchasePrice, setPurchasePrice] = useState(extractedData.purchasePrice || '');
  const [purchaseDate, setPurchaseDate] = useState(extractedData.purchaseDate || '');
  const [expiryDate, setExpiryDate] = useState(extractedData.expiryDate || '');
  const [renewalDate, setRenewalDate] = useState(extractedData.renewalDate || '');
  const [serialNumber, setSerialNumber] = useState(
    extractedData.serialNumber || extractedData.policyNumber || extractedData.serviceTag || ''
  );
  const [invoice, setInvoice] = useState(extractedData.invoice || '');
  const [warrantyType, setWarrantyType] = useState(extractedData.warrantyType || '');
  const [warrantyEnds, setWarrantyEnds] = useState(extractedData.warrantyEnds || '');
  const [verificationUrl, setVerificationUrl] = useState(extractedData.verificationUrl || '');
  const [notes, setNotes] = useState(extractedData.notes || '');
  const [rawText, setRawText] = useState(extractedData.rawText || fileMeta.textData || '');

  // Editable lists: Add-ons, Reminders, Contacts
  const [addOns, setAddOns] = useState<string[]>(
    Array.isArray(extractedData.addOns) ? extractedData.addOns : []
  );
  const [newAddOn, setNewAddOn] = useState('');

  const [reminders, setReminders] = useState<string[]>(
    Array.isArray(extractedData.reminders) ? extractedData.reminders : []
  );
  const [newReminder, setNewReminder] = useState('');

  const [contacts, setContacts] = useState<string[]>(
    Array.isArray(extractedData.contacts) ? extractedData.contacts : []
  );
  const [newContact, setNewContact] = useState('');

  // Category-specific & extra extracted attributes
  const [categoryFields, setCategoryFields] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const key of ALL_EXTRACTED_EXTRA_KEYS) {
      const val = (extractedData as any)[key];
      if (val && typeof val === 'string' && val.trim()) {
        initial[key] = val.trim();
      }
    }
    return initial;
  });

  const [showRawOcr, setShowRawOcr] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Merge active category's standard fields with any other non-empty extracted fields so ZERO extracted details are ever hidden!
  const visibleCategoryFieldDefs = React.useMemo(() => {
    const activeDefs = [...(CATEGORY_SPECIFIC_KEYS[category] || [])];
    const seen = new Set(activeDefs.map((d) => d.key));

    Object.keys(categoryFields).forEach((k) => {
      if (!seen.has(k) && categoryFields[k]) {
        seen.add(k);
        activeDefs.push({
          key: k,
          label: k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
        });
      }
    });

    return activeDefs;
  }, [category, categoryFields]);

  const updateCatField = (key: string, val: string) => {
    setCategoryFields((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetName.trim()) {
      setValidationError('Asset Name is required before storing.');
      return;
    }

    setValidationError(null);

    // Clean empty category fields and include renewalDate / verificationUrl if provided
    const cleanedCatFields: Record<string, string> = {};
    Object.entries(categoryFields).forEach(([k, v]) => {
      if (v && v.trim()) cleanedCatFields[k] = v.trim();
    });
    if (renewalDate.trim()) cleanedCatFields.renewalDate = renewalDate.trim();
    if (verificationUrl.trim()) cleanedCatFields.verificationUrl = verificationUrl.trim();

    const finalAddOns = [
      ...addOns.map((s) => s.trim()).filter(Boolean),
      ...(newAddOn.trim() ? [newAddOn.trim()] : []),
    ];
    const finalReminders = [
      ...reminders.map((s) => s.trim()).filter(Boolean),
      ...(newReminder.trim() ? [newReminder.trim()] : []),
    ];
    const finalContacts = [
      ...contacts.map((s) => s.trim()).filter(Boolean),
      ...(newContact.trim() ? [newContact.trim()] : []),
    ];

    const attachment: DocumentAttachment | undefined =
      fileMeta.base64Data || fileMeta.textData || rawText
        ? {
            id: `doc-${Date.now()}`,
            filename: fileMeta.filename || 'Scanned_Document.pdf',
            mimeType: fileMeta.mimeType || 'application/pdf',
            base64Data: fileMeta.base64Data || undefined,
            textData: rawText.trim() || fileMeta.textData || undefined,
            uploadedAt: new Date().toISOString(),
          }
        : undefined;

    onConfirmSave({
      assetName: assetName.trim(),
      category,
      docType,
      owner: owner.trim(),
      vendor: vendor.trim(),
      manufacturer: manufacturer.trim(),
      model: model.trim(),
      purchasePrice: purchasePrice.trim(),
      purchaseDate: purchaseDate.trim(),
      expiryDate: expiryDate.trim(),
      renewalDate: renewalDate.trim(),
      serialNumber: serialNumber.trim(),
      warrantyType: warrantyType.trim(),
      warrantyEnds: warrantyEnds.trim(),
      invoice: invoice.trim(),
      verificationUrl: verificationUrl.trim(),
      notes: notes.trim(),
      addOns: finalAddOns,
      reminders: finalReminders,
      contacts: finalContacts,
      categoryFields: cleanedCatFields,
      attachment,
    });
  };

  return (
    <form onSubmit={handleConfirm} className="space-y-5 text-xs">
      {/* Pending Confirmation Banner */}
      <div className="p-3.5 bg-[#6FA88C]/12 border border-[#6FA88C]/35 rounded-xl flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <CheckCircle size={16} className="text-[#6FA88C] shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-[#EDEDE1]">
              Extraction Complete · Review & Edit Before Storing
            </p>
            <p className="text-[#8FA79B] mt-0.5 leading-relaxed">
              Your file is not stored yet. Inspect or modify any extracted field below, then confirm to save it to your vault.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRescan}
          className="text-[#C9A15D] hover:text-[#E4C98A] underline shrink-0 whitespace-nowrap"
        >
          Change File
        </button>
      </div>

      {/* Document Preview Strip */}
      <div className="flex items-center gap-3 p-3 bg-[#1C2E26] border border-[#2A3B33] rounded-xl">
        {fileMeta.previewUrl ? (
          <img
            src={fileMeta.previewUrl}
            alt="Scanned preview"
            referrerPolicy="no-referrer"
            className="w-12 h-12 rounded-lg object-cover border border-[#2A3B33] shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-[#16261F] border border-[#2A3B33] flex items-center justify-center text-[#C9A15D] shrink-0">
            <FileText size={18} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[#EDEDE1] truncate">{fileMeta.filename}</p>
          <p className="text-[11px] text-[#8FA79B] font-mono tabular-nums">
            {fileMeta.mimeType} · {(fileMeta.sizeBytes / 1024).toFixed(1)} KB · Ready to store
          </p>
        </div>
      </div>

      {validationError && (
        <div className="p-3 rounded-lg bg-[#C97B6B]/15 border border-[#C97B6B]/40 text-[#C97B6B] flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* 1. Core Asset & Document Identity */}
      <div className="space-y-3">
        <h3 className="font-semibold text-xs text-[#C9A15D] border-b border-[#2A3B33] pb-1.5">
          1. Core Asset & Document Identity
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
              Asset Name / Title *
            </label>
            <input
              type="text"
              required
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              placeholder="e.g. Maruti Suzuki Celerio ZXI / Dell XPS 15"
              className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] focus:border-[#C9A15D] outline-none"
            />
          </div>

          <div>
            <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
              Asset Category
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
              Owner / Policyholder
            </label>
            <input
              type="text"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="Not detected — click to add"
              className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none"
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
              placeholder="Not detected — click to add"
              className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none"
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
              placeholder="Not detected — click to add"
              className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none"
            />
          </div>

          <div>
            <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
              Model / Variant
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Not detected — click to add"
              className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none"
            />
          </div>
        </div>
      </div>

      {/* 2. Dates, Pricing & Identifiers */}
      <div className="space-y-3">
        <h3 className="font-semibold text-xs text-[#C9A15D] border-b border-[#2A3B33] pb-1.5">
          2. Dates, Pricing & Identifiers
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
              Serial / Policy / Folio Number
            </label>
            <input
              type="text"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="Not detected — click to add"
              className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#E4C98A] font-mono tabular-nums placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none"
            />
          </div>

          <div>
            <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
              Invoice / Bill Number
            </label>
            <input
              type="text"
              value={invoice}
              onChange={(e) => setInvoice(e.target.value)}
              placeholder="Not detected — click to add"
              className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] font-mono tabular-nums placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none"
            />
          </div>

          <div>
            <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
              Purchase Price / Total Paid
            </label>
            <input
              type="text"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="e.g. ₹ 45,000 or $999"
              className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] tabular-nums placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none"
            />
          </div>

          <div>
            <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
              Purchase / Issue Date (DD/MM/YYYY)
            </label>
            <input
              type="text"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              placeholder="DD/MM/YYYY"
              className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] font-mono tabular-nums placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none"
            />
          </div>

          <div>
            <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
              Expiry / Validity End Date (DD/MM/YYYY)
            </label>
            <input
              type="text"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              placeholder="DD/MM/YYYY"
              className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] font-mono tabular-nums placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none"
            />
          </div>

          <div>
            <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
              Renewal Due Date (DD/MM/YYYY)
            </label>
            <input
              type="text"
              value={renewalDate}
              onChange={(e) => setRenewalDate(e.target.value)}
              placeholder="DD/MM/YYYY"
              className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] font-mono tabular-nums placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none"
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
              placeholder="e.g. 2 Years Comprehensive"
              className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none"
            />
          </div>

          <div>
            <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
              Warranty End Date (DD/MM/YYYY)
            </label>
            <input
              type="text"
              value={warrantyEnds}
              onChange={(e) => setWarrantyEnds(e.target.value)}
              placeholder="DD/MM/YYYY"
              className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] font-mono tabular-nums placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none"
            />
          </div>
        </div>
      </div>

      {/* 3. Category-Specific Extracted Details */}
      {visibleCategoryFieldDefs.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-xs text-[#C9A15D] border-b border-[#2A3B33] pb-1.5 capitalize">
            3. {category} Specific Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {visibleCategoryFieldDefs.map((field) => (
              <div key={field.key}>
                <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
                  {field.label}
                </label>
                <input
                  type="text"
                  value={categoryFields[field.key] || ''}
                  onChange={(e) => updateCatField(field.key, e.target.value)}
                  placeholder="Optional"
                  className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] font-mono tabular-nums placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Add-ons, Reminders, Contacts & Notes */}
      <div className="space-y-4">
        <h3 className="font-semibold text-xs text-[#C9A15D] border-b border-[#2A3B33] pb-1.5">
          4. Coverage Add-ons, Reminders & Contacts
        </h3>

        {/* Add-ons */}
        <div>
          <label className="block text-[#8FA79B] font-mono text-[11px] mb-1.5">
            Add-on Covers & Included Benefits
          </label>
          <div className="space-y-1.5">
            {addOns.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const next = [...addOns];
                    next[idx] = e.target.value;
                    setAddOns(next);
                  }}
                  className="flex-1 bg-[#1C2E26] border border-[#2A3B33] rounded-lg px-2.5 py-2 text-[#EDEDE1] focus:border-[#C9A15D] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setAddOns(addOns.filter((_, i) => i !== idx))}
                  className="p-2 text-[#8FA79B] hover:text-[#C97B6B]"
                  title="Remove item"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newAddOn}
                onChange={(e) => setNewAddOn(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newAddOn.trim()) {
                    e.preventDefault();
                    setAddOns([...addOns, newAddOn.trim()]);
                    setNewAddOn('');
                  }
                }}
                placeholder="Add a benefit or cover..."
                className="flex-1 bg-[#1C2E26] border border-[#2A3B33] rounded-lg px-2.5 py-2 text-[#EDEDE1] placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (newAddOn.trim()) {
                    setAddOns([...addOns, newAddOn.trim()]);
                    setNewAddOn('');
                  }
                }}
                className="px-2.5 py-2 bg-[#1C2E26] border border-[#2A3B33] hover:border-[#C9A15D] rounded-lg text-[#C9A15D] flex items-center gap-1 whitespace-nowrap"
              >
                <Plus size={13} /> Add
              </button>
            </div>
          </div>
        </div>

        {/* Reminders */}
        <div>
          <label className="block text-[#8FA79B] font-mono text-[11px] mb-1.5">
            Action Reminders
          </label>
          <div className="space-y-1.5">
            {reminders.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const next = [...reminders];
                    next[idx] = e.target.value;
                    setReminders(next);
                  }}
                  className="flex-1 bg-[#1C2E26] border border-[#2A3B33] rounded-lg px-2.5 py-2 text-[#EDEDE1] focus:border-[#C9A15D] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setReminders(reminders.filter((_, i) => i !== idx))}
                  className="p-2 text-[#8FA79B] hover:text-[#C97B6B]"
                  title="Remove reminder"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newReminder}
                onChange={(e) => setNewReminder(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newReminder.trim()) {
                    e.preventDefault();
                    setReminders([...reminders, newReminder.trim()]);
                    setNewReminder('');
                  }
                }}
                placeholder="Add a reminder (e.g. Renew 15 days before expiry)..."
                className="flex-1 bg-[#1C2E26] border border-[#2A3B33] rounded-lg px-2.5 py-2 text-[#EDEDE1] placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (newReminder.trim()) {
                    setReminders([...reminders, newReminder.trim()]);
                    setNewReminder('');
                  }
                }}
                className="px-2.5 py-2 bg-[#1C2E26] border border-[#2A3B33] hover:border-[#C9A15D] rounded-lg text-[#C9A15D] flex items-center gap-1 whitespace-nowrap"
              >
                <Plus size={13} /> Add
              </button>
            </div>
          </div>
        </div>

        {/* Support Contacts */}
        <div>
          <label className="block text-[#8FA79B] font-mono text-[11px] mb-1.5">
            Helpline & Support Contacts
          </label>
          <div className="space-y-1.5">
            {contacts.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const next = [...contacts];
                    next[idx] = e.target.value;
                    setContacts(next);
                  }}
                  className="flex-1 bg-[#1C2E26] border border-[#2A3B33] rounded-lg px-2.5 py-2 text-[#EDEDE1] font-mono focus:border-[#C9A15D] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setContacts(contacts.filter((_, i) => i !== idx))}
                  className="p-2 text-[#8FA79B] hover:text-[#C97B6B]"
                  title="Remove contact"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newContact}
                onChange={(e) => setNewContact(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newContact.trim()) {
                    e.preventDefault();
                    setContacts([...contacts, newContact.trim()]);
                    setNewContact('');
                  }
                }}
                placeholder="Add helpline phone or support email..."
                className="flex-1 bg-[#1C2E26] border border-[#2A3B33] rounded-lg px-2.5 py-2 text-[#EDEDE1] placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (newContact.trim()) {
                    setContacts([...contacts, newContact.trim()]);
                    setNewContact('');
                  }
                }}
                className="px-2.5 py-2 bg-[#1C2E26] border border-[#2A3B33] hover:border-[#C9A15D] rounded-lg text-[#C9A15D] flex items-center gap-1 whitespace-nowrap"
              >
                <Plus size={13} /> Add
              </button>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
            Notes, Terms & Key Highlights
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Important terms, warranty exclusions, or notes..."
            className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none resize-y"
          />
        </div>
      </div>

      {/* 5. Collapsible Raw OCR Text */}
      <div className="border-t border-[#2A3B33] pt-3">
        <button
          type="button"
          onClick={() => setShowRawOcr(!showRawOcr)}
          className="flex items-center gap-1.5 text-[#8FA79B] hover:text-[#EDEDE1] font-mono text-[11px]"
        >
          {showRawOcr ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          <span>{showRawOcr ? 'Hide Extracted Raw Text' : 'Inspect / Edit Extracted Raw OCR Text'}</span>
        </button>

        {showRawOcr && (
          <textarea
            rows={4}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Raw OCR text extracted from document..."
            className="w-full mt-2 bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] font-mono text-[11px] leading-relaxed focus:border-[#C9A15D] outline-none resize-y"
          />
        )}
      </div>

      {/* Confirm & Store Footer */}
      <div className="pt-2 space-y-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-[#C9A15D] hover:bg-[#E4C98A] disabled:opacity-50 text-[#14211B] font-bold py-3 rounded-xl transition-colors shadow-lg text-sm flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <span>{isSubmitting ? 'Storing Document...' : submitLabel}</span>
          <ArrowRight size={16} />
        </button>

        {onCancelOrSkip && cancelOrSkipLabel && (
          <button
            type="button"
            onClick={onCancelOrSkip}
            className="w-full py-1.5 text-xs text-[#8FA79B] hover:text-[#EDEDE1] transition-colors text-center"
          >
            {cancelOrSkipLabel}
          </button>
        )}
      </div>
    </form>
  );
};
