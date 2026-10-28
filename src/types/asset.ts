export type AssetCategory =
  | 'vehicular'
  | 'electronics'
  | 'camera'
  | 'watch'
  | 'appliances'
  | 'health'
  | 'identity'
  | 'property'
  | 'finance'
  | 'furniture'
  | 'jewellery'
  | 'machinery'
  | 'subscriptions'
  | 'other';

export type DocumentType =
  | 'Vehicle Insurance'
  | 'Vehicle Registration Certificate (RC)'
  | 'Invoice'
  | 'Receipt'
  | 'Warranty Certificate'
  | 'Extended Warranty'
  | 'Service Record'
  | 'User Manual'
  | 'Property Document'
  | 'Health Insurance'
  | 'Bank / Investment Statement'
  | 'Subscription / Membership'
  | 'Other Document';

export interface DocumentAttachment {
  id: string;
  filename: string;
  mimeType: string;
  base64Data?: string;
  textData?: string;
  uploadedAt: string;
  pagesProcessed?: number;
}

export interface Asset {
  id: string;
  userId: string;
  assetName: string;
  category: AssetCategory;
  docType: DocumentType;
  owner?: string;
  vendor?: string;
  manufacturer?: string;
  model?: string;
  purchasePrice?: string;
  purchaseDate?: string; // DD/MM/YYYY or YYYY-MM-DD
  expiryDate?: string;   // DD/MM/YYYY or YYYY-MM-DD
  renewalDate?: string;
  warrantyEnds?: string;
  warrantyType?: string;
  serialNumber?: string;
  policyNumber?: string;
  invoice?: string;
  verificationUrl?: string;
  notes?: string;
  addOns?: string[];
  reminders?: string[];
  contacts?: string[];
  categoryFields?: Record<string, string>;
  attachment?: DocumentAttachment;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  isGuest: boolean;
}

export interface ExtractedLineItem {
  description: string;
  quantity?: string;
  unitPrice?: string;
  amount?: string;
}

export interface ExtractedKeyValue {
  label: string;
  value: string;
}

export interface ScanResultData {
  category: AssetCategory;
  docType: DocumentType;
  assetName: string;
  owner?: string;
  vendor?: string;
  manufacturer?: string;
  model?: string;
  purchasePrice?: string;
  purchaseDate?: string;
  expiryDate?: string;
  renewalDate?: string;
  warrantyEnds?: string;
  warrantyType?: string;
  warrantyStartDate?: string;
  serialNumber?: string;
  policyNumber?: string;
  invoice?: string;
  orderNumber?: string;
  verificationUrl?: string;
  notes?: string;
  addOns?: string[];
  reminders?: string[];
  contacts?: string[];
  lineItems?: ExtractedLineItem[];
  additionalDetails?: ExtractedKeyValue[];
  customerAddress?: string;
  vendorAddress?: string;
  vendorTaxId?: string;
  customerTaxId?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  subtotalAmount?: string;
  taxAmount?: string;
  discountAmount?: string;
  nomineeName?: string;
  tpaName?: string;
  deductibleAmount?: string;
  hypothecation?: string;
  pucExpiryDate?: string;
  odometerReading?: string;
  vehicleColor?: string;
  seatingCapacity?: string;
  rtoLocation?: string;
  ifscOrBranch?: string;
  registrationNumber?: string;
  engineNumber?: string;
  chassisNumber?: string;
  vehicleType?: string;
  fuelType?: string;
  cubicCapacity?: string;
  registrationYear?: string;
  policyType?: string;
  coverageType?: string;
  idv?: string;
  ncbPercentage?: string;
  serviceTag?: string;
  expressServiceCode?: string;
  assetId?: string;
  supportPhone?: string;
  supportEmail?: string;
  coverageDetails?: string;
  storageOrSpecs?: string;
  imeiOrMac?: string;
  lensDetails?: string;
  watchMovement?: string;
  propertyAddress?: string;
  deedNumber?: string;
  builtUpArea?: string;
  institutionName?: string;
  accountOrFolioNumber?: string;
  applianceType?: string;
  capacity?: string;
  energyRating?: string;
  material?: string;
  jewelleryType?: string;
  metalPurity?: string;
  grossWeightGrams?: string;
  subscriptionPlan?: string;
  billingCycle?: string;
  rawText?: string;
  pagesProcessed?: number;
}
