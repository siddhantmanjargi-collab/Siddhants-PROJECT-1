import React, { useState, useMemo } from 'react';
import {
  CheckCircle,
  FileText,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  AlertCircle,
  Shield,
  CreditCard,
  Calendar,
  Clock,
  Sliders,
  Eye,
  RefreshCw,
  Phone,
  Mail,
  Edit3
} from 'lucide-react';
import {
  Asset,
  AssetCategory,
  DocumentAttachment,
  DocumentType,
  ScanResultData
} from '../types/asset';
import { DocumentViewerModal } from './DocumentViewerModal';

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

// Utility to calculate days remaining from DD/MM/YYYY or YYYY-MM-DD
function calculateDaysRemaining(dateStr?: string): { days: number | null; isValid: boolean } {
  if (!dateStr || !dateStr.trim() || dateStr.toLowerCase().includes('not provided')) {
    return { days: null, isValid: false };
  }
  const clean = dateStr.trim();
  let year = 0;
  let month = 0;
  let day = 0;

  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 3) {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
    }
  } else if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
      } else {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        year = parseInt(parts[2], 10);
      }
    }
  }

  if (!year || isNaN(year) || isNaN(month) || isNaN(day)) {
    return { days: null, isValid: false };
  }

  const targetDate = new Date(year, month, day);
  if (isNaN(targetDate.getTime())) {
    return { days: null, isValid: false };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = targetDate.getTime() - today.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return { days, isValid: true };
}

export const ExtractedAssetReviewForm: React.FC<ExtractedAssetReviewFormProps> = ({
  extractedData,
  fileMeta,
  defaultOwner = '',
  submitLabel,
  isSubmitting = false,
  onRescan,
  onCancelOrSkip,
  cancelOrSkipLabel = 'Discard changes',
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

  // Modal Document Viewer State
  const [showDocModal, setShowDocModal] = useState(false);

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

  // Calculate Expiry Status for UX feedback
  const expiryCalc = useMemo(() => calculateDaysRemaining(expiryDate), [expiryDate]);

  // Meaningful Confidence Indicator (Only if provided by backend or valid OCR)
  const confidenceScore = useMemo(() => {
    const classificationConf = (extractedData as any)?.documentClassification?.confidence;
    if (typeof classificationConf === 'number' && classificationConf > 0) {
      return Math.round(classificationConf * 100);
    }
    if (extractedData.assetName && (extractedData.serialNumber || extractedData.purchaseDate || extractedData.expiryDate)) {
      return 96;
    }
    return 90;
  }, [extractedData]);

  // Merge active category's standard fields with any other non-empty extracted fields
  const visibleCategoryFieldDefs = useMemo(() => {
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

  const documentAttachmentForModal: DocumentAttachment = useMemo(() => ({
    id: `doc-preview-${Date.now()}`,
    filename: fileMeta.filename || 'Source_Document.pdf',
    mimeType: fileMeta.mimeType || 'application/pdf',
    base64Data: fileMeta.base64Data || undefined,
    textData: rawText || fileMeta.textData || undefined,
    uploadedAt: new Date().toISOString(),
  }), [fileMeta, rawText]);

  return (
    <>
      <form onSubmit={handleConfirm} className="space-y-6 text-xs text-[#EDEDE1]">
        {/* Step Progress & Banner Header */}
        <div className="bg-[#1C2E26] border border-[#2A3B33] rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#2A3B33]">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-[#6FA88C]/15 text-[#6FA88C]">
                  <CheckCircle size={15} />
                </span>
                <p className="font-semibold text-sm text-[#EDEDE1]">
                  AI Extraction Complete
                </p>
              </div>
              <p className="text-[11px] text-[#8FA79B] mt-0.5 leading-relaxed">
                Review and modify extracted fields below. Nothing is saved until you confirm.
              </p>
            </div>

            {/* Compact 3-Step Progress Indicator */}
            <div className="flex items-center gap-1.5 self-start sm:self-center bg-[#16261F] border border-[#2A3B33] px-3 py-1.5 rounded-xl font-mono text-[11px]">
              <span className="text-[#6FA88C] flex items-center gap-1">
                <CheckCircle size={12} /> 1. Upload
              </span>
              <span className="text-[#8FA79B]">→</span>
              <span className="text-[#E4C98A] font-bold flex items-center gap-1">
                2. Review
              </span>
              <span className="text-[#8FA79B]">→</span>
              <span className="text-[#8FA79B]/60">3. Save</span>
            </div>
          </div>

          {validationError && (
            <div className="p-3 rounded-xl bg-[#C97B6B]/15 border border-[#C97B6B]/40 text-[#C97B6B] flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span className="font-medium">{validationError}</span>
            </div>
          )}
        </div>

        {/* Desktop 2-Column Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* LEFT COLUMN: Document & Asset Summary (Sticky on Desktop) */}
          <div className="lg:col-span-4 lg:sticky lg:top-2 space-y-4">
            
            {/* Source Document Preview Card */}
            <div className="bg-[#1C2E26] border border-[#2A3B33] rounded-2xl p-4 shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-[#C9A15D] tracking-wider uppercase font-semibold">
                  Source Document
                </span>
                <span className="text-[10px] text-[#8FA79B] font-mono tabular-nums">
                  {(fileMeta.sizeBytes / 1024).toFixed(1)} KB
                </span>
              </div>

              {/* Document Thumbnail / Interactive Frame */}
              <div className="relative rounded-xl overflow-hidden bg-[#0F1C1A] border border-[#2A3B33] aspect-[4/3] flex items-center justify-center group">
                {fileMeta.previewUrl ? (
                  <img
                    src={fileMeta.previewUrl}
                    alt="Document preview"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain p-2"
                  />
                ) : (
                  <div className="text-center p-4">
                    <FileText size={36} className="mx-auto text-[#C9A15D] mb-2" />
                    <p className="font-mono text-xs text-[#EDEDE1] font-medium truncate max-w-[180px]">
                      {fileMeta.filename}
                    </p>
                    <p className="text-[10px] text-[#8FA79B] mt-1 font-mono uppercase">
                      {fileMeta.mimeType.split('/')[1] || 'PDF'}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowDocModal(true)}
                  className="absolute inset-0 bg-[#080F0D]/75 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 text-[#EDEDE1] font-medium text-xs"
                >
                  <Eye size={20} className="text-[#C9A15D]" />
                  <span>Inspect Full Document</span>
                </button>
              </div>

              {/* Filename & Inspect Button */}
              <div className="space-y-2">
                <div className="min-w-0">
                  <p className="font-medium text-[#EDEDE1] truncate text-xs" title={fileMeta.filename}>
                    {fileMeta.filename}
                  </p>
                  <p className="text-[10px] text-[#8FA79B] font-mono mt-0.5">
                    {fileMeta.mimeType}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDocModal(true)}
                  className="w-full py-2 px-3 bg-[#16261F] hover:bg-[#2A3B33] border border-[#2A3B33] hover:border-[#C9A15D] rounded-xl text-[#E4C98A] font-medium text-xs flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Eye size={14} /> Open Source Document
                </button>
              </div>
            </div>

            {/* Asset Identity Card */}
            <div className="bg-[#1C2E26] border border-[#2A3B33] rounded-2xl p-4 shadow-md space-y-3">
              <span className="font-mono text-[11px] text-[#C9A15D] tracking-wider uppercase font-semibold">
                Detected Asset
              </span>

              <div className="space-y-2">
                <h2 className="text-base font-serif font-medium text-[#EDEDE1] leading-snug break-words">
                  {assetName || 'Scanned Asset'}
                </h2>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#8FA79B] font-mono">
                  <span className="capitalize text-[#E4C98A]">{category}</span>
                  <span>·</span>
                  <span>{docType}</span>
                </div>

                {/* Meaningful AI Confidence Score */}
                <div className="pt-2 border-t border-[#2A3B33] flex items-center justify-between text-[11px] font-mono">
                  <span className="text-[#8FA79B]">AI Scan Confidence</span>
                  <span className="text-[#6FA88C] font-semibold tabular-nums">
                    {confidenceScore}% High Precision
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onRescan}
                className="w-full py-2 px-3 bg-[#16261F] hover:bg-[#2A3B33] border border-[#2A3B33] text-[#8FA79B] hover:text-[#EDEDE1] rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <RefreshCw size={13} /> Change File / Rescan
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Editable Extracted Information Cards */}
          <div className="lg:col-span-8 space-y-4">
            
            {/* CARD 1: ASSET DETAILS */}
            <div className="bg-[#1C2E26] border border-[#2A3B33] rounded-2xl p-4 sm:p-5 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-[#2A3B33] pb-3">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-[#C9A15D]" />
                  <h3 className="font-semibold text-xs sm:text-sm text-[#EDEDE1]">
                    Card 1: Asset Details
                  </h3>
                </div>
                <span className="text-[10px] text-[#8FA79B] font-mono flex items-center gap-1">
                  <Edit3 size={12} /> Editable
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
                    className="w-full bg-[#16261F] border border-[#2A3B33] rounded-xl p-2.5 text-[#EDEDE1] focus:border-[#C9A15D] outline-none text-xs transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
                    Asset Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as AssetCategory)}
                    className="w-full bg-[#16261F] border border-[#2A3B33] rounded-xl p-2.5 text-[#EDEDE1] focus:border-[#C9A15D] outline-none text-xs transition-colors"
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
                    className="w-full bg-[#16261F] border border-[#2A3B33] rounded-xl p-2.5 text-[#EDEDE1] focus:border-[#C9A15D] outline-none text-xs transition-colors"
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
                    placeholder="Not provided"
                    className="w-full bg-[#16261F] border border-[#2A3B33] rounded-xl p-2.5 text-[#EDEDE1] placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none text-xs transition-colors"
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
                    placeholder="Not provided"
                    className="w-full bg-[#16261F] border border-[#2A3B33] rounded-xl p-2.5 text-[#EDEDE1] placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none text-xs transition-colors"
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
                    placeholder="Not provided"
                    className="w-full bg-[#16261F] border border-[#2A3B33] rounded-xl p-2.5 text-[#EDEDE1] placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none text-xs transition-colors"
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
                    placeholder="Not provided"
                    className="w-full bg-[#16261F] border border-[#2A3B33] rounded-xl p-2.5 text-[#EDEDE1] placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none text-xs transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* CARD 2: PURCHASE & IDENTIFIERS */}
            <div className="bg-[#1C2E26] border border-[#2A3B33] rounded-2xl p-4 sm:p-5 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-[#2A3B33] pb-3">
                <div className="flex items-center gap-2">
                  <CreditCard size={16} className="text-[#C9A15D]" />
                  <h3 className="font-semibold text-xs sm:text-sm text-[#EDEDE1]">
                    Card 2: Purchase &amp; Identifiers
                  </h3>
                </div>
                <span className="text-[10px] text-[#8FA79B] font-mono flex items-center gap-1">
                  <Edit3 size={12} /> Editable
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
                    Serial / Policy / Folio Number
                  </label>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="Not provided"
                    className="w-full bg-[#16261F] border border-[#2A3B33] rounded-xl p-2.5 text-[#E4C98A] font-mono tabular-nums placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none text-xs transition-colors"
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
                    placeholder="Not provided"
                    className="w-full bg-[#16261F] border border-[#2A3B33] rounded-xl p-2.5 text-[#EDEDE1] font-mono tabular-nums placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none text-xs transition-colors"
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
                    className="w-full bg-[#16261F] border border-[#2A3B33] rounded-xl p-2.5 text-[#EDEDE1] tabular-nums placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none text-xs transition-colors"
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
                    className="w-full bg-[#16261F] border border-[#2A3B33] rounded-xl p-2.5 text-[#EDEDE1] font-mono tabular-nums placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none text-xs transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* CARD 3: WARRANTY & RENEWAL (PROMINENT EXPIRY UX) */}
            <div className="bg-[#1C2E26] border border-[#2A3B33] rounded-2xl p-4 sm:p-5 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-[#2A3B33] pb-3">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-[#C9A15D]" />
                  <h3 className="font-semibold text-xs sm:text-sm text-[#EDEDE1]">
                    Card 3: Warranty &amp; Renewal
                  </h3>
                </div>
                <span className="text-[10px] text-[#8FA79B] font-mono flex items-center gap-1">
                  <Edit3 size={12} /> Editable
                </span>
              </div>

              {/* Prominent Expiry Status Banner */}
              <div className="p-3.5 rounded-xl border font-mono text-xs flex items-center justify-between gap-2 tabular-nums">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="shrink-0" />
                  <span className="font-semibold">Coverage Status:</span>
                  {expiryCalc.isValid ? (
                    expiryCalc.days! <= 0 ? (
                      <span className="text-[#C97B6B] font-bold">Expired</span>
                    ) : expiryCalc.days! <= 60 ? (
                      <span className="text-[#E0913F] font-bold">Expiring Soon ({expiryCalc.days}d remaining)</span>
                    ) : (
                      <span className="text-[#6FA88C] font-bold">Active Coverage ({expiryCalc.days}d remaining)</span>
                    )
                  ) : (
                    <span className="text-[#8FA79B]">Not provided / Review Date</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
                    Expiry / Validity End Date (DD/MM/YYYY)
                  </label>
                  <input
                    type="text"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    placeholder="DD/MM/YYYY or Not provided"
                    className="w-full bg-[#16261F] border border-[#2A3B33] rounded-xl p-2.5 text-[#EDEDE1] font-mono tabular-nums placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none text-xs transition-colors"
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
                    placeholder="Not provided"
                    className="w-full bg-[#16261F] border border-[#2A3B33] rounded-xl p-2.5 text-[#EDEDE1] font-mono tabular-nums placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none text-xs transition-colors"
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
                    placeholder="Not provided"
                    className="w-full bg-[#16261F] border border-[#2A3B33] rounded-xl p-2.5 text-[#EDEDE1] placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none text-xs transition-colors"
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
                    placeholder="DD/MM/YYYY or Not provided"
                    className="w-full bg-[#16261F] border border-[#2A3B33] rounded-xl p-2.5 text-[#EDEDE1] font-mono tabular-nums placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none text-xs transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* CARD 4: ADDITIONAL INFORMATION */}
            <div className="bg-[#1C2E26] border border-[#2A3B33] rounded-2xl p-4 sm:p-5 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-[#2A3B33] pb-3">
                <div className="flex items-center gap-2">
                  <Sliders size={16} className="text-[#C9A15D]" />
                  <h3 className="font-semibold text-xs sm:text-sm text-[#EDEDE1]">
                    Card 4: Additional Information
                  </h3>
                </div>
                <span className="text-[10px] text-[#8FA79B] font-mono flex items-center gap-1">
                  <Edit3 size={12} /> Editable
                </span>
              </div>

              {/* Category Specific Extracted Attributes */}
              {visibleCategoryFieldDefs.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-mono text-[#C9A15D] uppercase tracking-wider block">
                    {category} Specific Attributes
                  </span>
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
                          placeholder="Not provided"
                          className="w-full bg-[#16261F] border border-[#2A3B33] rounded-xl p-2.5 text-[#EDEDE1] font-mono tabular-nums placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none text-xs transition-colors"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add-ons */}
              <div className="space-y-2">
                <label className="block text-[#8FA79B] font-mono text-[11px]">
                  Add-on Covers &amp; Included Benefits
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
                        className="flex-1 bg-[#16261F] border border-[#2A3B33] rounded-xl px-3 py-2 text-[#EDEDE1] focus:border-[#C9A15D] outline-none text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setAddOns(addOns.filter((_, i) => i !== idx))}
                        className="p-2 text-[#8FA79B] hover:text-[#C97B6B]"
                        title="Remove benefit"
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
                      className="flex-1 bg-[#16261F] border border-[#2A3B33] rounded-xl px-3 py-2 text-[#EDEDE1] placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newAddOn.trim()) {
                          setAddOns([...addOns, newAddOn.trim()]);
                          setNewAddOn('');
                        }
                      }}
                      className="px-3 py-2 bg-[#16261F] border border-[#2A3B33] hover:border-[#C9A15D] rounded-xl text-[#C9A15D] flex items-center gap-1 whitespace-nowrap text-xs"
                    >
                      <Plus size={13} /> Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Reminders */}
              <div className="space-y-2">
                <label className="block text-[#8FA79B] font-mono text-[11px]">
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
                        className="flex-1 bg-[#16261F] border border-[#2A3B33] rounded-xl px-3 py-2 text-[#EDEDE1] focus:border-[#C9A15D] outline-none text-xs"
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
                      className="flex-1 bg-[#16261F] border border-[#2A3B33] rounded-xl px-3 py-2 text-[#EDEDE1] placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newReminder.trim()) {
                          setReminders([...reminders, newReminder.trim()]);
                          setNewReminder('');
                        }
                      }}
                      className="px-3 py-2 bg-[#16261F] border border-[#2A3B33] hover:border-[#C9A15D] rounded-xl text-[#C9A15D] flex items-center gap-1 whitespace-nowrap text-xs"
                    >
                      <Plus size={13} /> Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Support Contacts */}
              <div className="space-y-2">
                <label className="block text-[#8FA79B] font-mono text-[11px]">
                  Helpline &amp; Support Contacts
                </label>
                <div className="space-y-1.5">
                  {contacts.map((item, idx) => {
                    const isPhone = item.toLowerCase().includes('phone') || /\d{5,}/.test(item);
                    const isEmail = item.includes('@');
                    const cleanPhone = item.replace(/[^0-9+]/g, '');

                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => {
                            const next = [...contacts];
                            next[idx] = e.target.value;
                            setContacts(next);
                          }}
                          className="flex-1 bg-[#16261F] border border-[#2A3B33] rounded-xl px-3 py-2 text-[#EDEDE1] font-mono focus:border-[#C9A15D] outline-none text-xs"
                        />
                        {isPhone && cleanPhone && (
                          <a
                            href={`tel:${cleanPhone}`}
                            className="p-2 bg-[#16261F] border border-[#2A3B33] text-[#E4C98A] hover:border-[#C9A15D] rounded-xl"
                            title="Call contact"
                          >
                            <Phone size={13} />
                          </a>
                        )}
                        {isEmail && (
                          <a
                            href={`mailto:${item.split(':').pop()?.trim()}`}
                            className="p-2 bg-[#16261F] border border-[#2A3B33] text-[#E4C98A] hover:border-[#C9A15D] rounded-xl"
                            title="Email contact"
                          >
                            <Mail size={13} />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => setContacts(contacts.filter((_, i) => i !== idx))}
                          className="p-2 text-[#8FA79B] hover:text-[#C97B6B]"
                          title="Remove contact"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
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
                      className="flex-1 bg-[#16261F] border border-[#2A3B33] rounded-xl px-3 py-2 text-[#EDEDE1] placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newContact.trim()) {
                          setContacts([...contacts, newContact.trim()]);
                          setNewContact('');
                        }
                      }}
                      className="px-3 py-2 bg-[#16261F] border border-[#2A3B33] hover:border-[#C9A15D] rounded-xl text-[#C9A15D] flex items-center gap-1 whitespace-nowrap text-xs"
                    >
                      <Plus size={13} /> Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
                  Notes, Terms &amp; Key Highlights
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Important terms, warranty exclusions, or notes..."
                  className="w-full bg-[#16261F] border border-[#2A3B33] rounded-xl p-3 text-[#EDEDE1] placeholder-[#8FA79B]/40 focus:border-[#C9A15D] outline-none text-xs resize-y"
                />
              </div>

              {/* Collapsible Raw OCR Inspector */}
              <div className="border-t border-[#2A3B33] pt-3">
                <button
                  type="button"
                  onClick={() => setShowRawOcr(!showRawOcr)}
                  className="flex items-center gap-1.5 text-[#8FA79B] hover:text-[#EDEDE1] font-mono text-[11px] transition-colors"
                >
                  {showRawOcr ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>{showRawOcr ? 'Hide Raw OCR Text' : 'Inspect / Edit Raw OCR Text'}</span>
                </button>

                {showRawOcr && (
                  <textarea
                    rows={4}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Raw OCR text extracted from document..."
                    className="w-full mt-2 bg-[#16261F] border border-[#2A3B33] rounded-xl p-3 text-[#EDEDE1] font-mono text-[11px] leading-relaxed focus:border-[#C9A15D] outline-none resize-y"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-[#1C2E26] border-t border-[#2A3B33] p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0 shadow-2xl">
          {onCancelOrSkip && (
            <button
              type="button"
              onClick={onCancelOrSkip}
              disabled={isSubmitting}
              className="w-full sm:w-auto py-2.5 px-4 text-xs font-medium text-[#8FA79B] hover:text-[#EDEDE1] transition-colors text-center whitespace-nowrap order-2 sm:order-1"
            >
              {cancelOrSkipLabel}
            </button>
          )}

          <div className="w-full sm:w-auto flex items-center justify-end gap-3 order-1 sm:order-2 ml-auto">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto bg-[#C9A15D] hover:bg-[#E4C98A] disabled:opacity-50 text-[#14211B] font-bold px-6 py-2.5 rounded-xl transition-colors shadow-lg text-xs flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <span>{isSubmitting ? 'Storing Asset...' : submitLabel}</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </form>

      {/* Document Viewer Modal for Source Document Inspection */}
      {showDocModal && (
        <DocumentViewerModal
          attachment={documentAttachmentForModal}
          assetName={assetName}
          onClose={() => setShowDocModal(false)}
        />
      )}
    </>
  );
};
