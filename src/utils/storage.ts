import { Asset, User } from '../types/asset';

const STORAGE_KEYS = {
  USER: 'asset_wallet_user',
  ASSETS: 'asset_wallet_assets',
};

// Helper date calculator
export function parseDate(dateStr?: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const s = dateStr.trim();
  if (!s) return null;

  // DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/').map(Number);
    return new Date(y, m - 1, d);
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  const timestamp = Date.parse(s);
  return isNaN(timestamp) ? null : new Date(timestamp);
}

export function calculateDaysRemaining(dateStr?: string): number | null {
  const targetDate = parseDate(dateStr);
  if (!targetDate) return null;

  const now = new Date();
  // reset hours
  now.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);

  const diffMs = targetDate.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function getAssetStatus(expiryDate?: string): 'safe' | 'warn' | 'danger' | 'unset' {
  const days = calculateDaysRemaining(expiryDate);
  if (days === null) return 'unset';
  if (days < 0) return 'danger';
  if (days <= 30) return 'warn';
  return 'safe';
}

export function formatDateDisplay(dateStr?: string): string {
  const parsed = parseDate(dateStr);
  if (!parsed) return dateStr || 'N/A';
  return parsed.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Initial Sample Assets for first time open
export const SAMPLE_ASSETS: Asset[] = [
  {
    id: 'sample-1',
    userId: 'demo-user',
    assetName: 'Maruti Suzuki Celerio ZXI+',
    category: 'vehicular',
    docType: 'Vehicle Insurance',
    owner: 'Siddhant Manjargi',
    vendor: 'Acko General Insurance',
    manufacturer: 'Maruti Suzuki',
    model: 'Celerio ZXI+ AMT',
    purchasePrice: '₹ 6,85,000',
    purchaseDate: '15/04/2023',
    expiryDate: '14/04/2027',
    renewalDate: '01/04/2027',
    warrantyEnds: '14/04/2026',
    warrantyType: '4 Year Extended Warranty',
    serialNumber: 'ACK-MOT-948201',
    policyNumber: 'ACK-MOT-948201',
    notes: 'Comprehensive 0-Depreciation policy with Roadside Assistance & Engine Protect.',
    addOns: ['Zero Depreciation', 'Engine Protect', '24x7 Roadside Assistance', 'Key Replace Cover'],
    reminders: ['Renew policy 14 days before expiry', 'Annual vehicle service due March 2027'],
    contacts: ['Support Phone: 1800-266-2256', 'Support Email: help@acko.com'],
    categoryFields: {
      registrationNumber: 'KA-01-MJ-4029',
      engineNumber: 'K10C982310',
      chassisNumber: 'MBHC3819203912',
      policyType: 'Comprehensive 0-Dep',
      idv: '₹ 5,20,000',
      ncbPercentage: '35%',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sample-2',
    userId: 'demo-user',
    assetName: 'Dell XPS 15 9530 Laptop',
    category: 'electronics',
    docType: 'Warranty Certificate',
    owner: 'Siddhant Manjargi',
    vendor: 'Dell Official Store',
    manufacturer: 'Dell',
    model: 'XPS 15 9530 (i9 32GB 1TB)',
    purchasePrice: '$2,499.00',
    purchaseDate: '10/11/2024',
    expiryDate: '10/11/2026',
    renewalDate: '01/11/2026',
    warrantyEnds: '10/11/2026',
    warrantyType: 'Dell Premium Support Plus',
    serialNumber: 'DX9530A1-SERV',
    invoice: 'INV-DELL-882019',
    notes: 'Includes Onsite Repair, Accidental Damage Protection, and Hardware Diagnostics.',
    addOns: ['Onsite Repair', 'Accidental Damage', '24/7 Priority Support'],
    reminders: ['Check battery health before warranty expires', 'Backup system image'],
    contacts: ['Support Phone: 1-800-624-9896', 'Support Email: support@dell.com'],
    categoryFields: {
      serviceTag: 'DX9530A1',
      expressServiceCode: '39201920391',
      storageOrSpecs: 'Intel Core i9-13900H, 32GB DDR5, 1TB NVMe, RTX 4060',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sample-3',
    userId: 'demo-user',
    assetName: 'Apple Watch Series 9 GPS+Cellular',
    category: 'watch',
    docType: 'Receipt',
    owner: 'Siddhant Manjargi',
    vendor: 'Apple Store BKC',
    manufacturer: 'Apple',
    model: 'Series 9 45mm Graphite Stainless Steel',
    purchasePrice: '₹ 79,900',
    purchaseDate: '28/09/2024',
    expiryDate: '27/09/2026',
    warrantyEnds: '27/09/2026',
    warrantyType: 'AppleCare+ for Apple Watch',
    serialNumber: 'FJL9203819X',
    invoice: 'APL-BKC-99201',
    addOns: ['AppleCare+ Express Replacement', 'Unlimited Accidental Damage'],
    reminders: ['AppleCare+ renewal check in Sept 2026'],
    contacts: ['Support Phone: 000800 100 9001', 'Support Email: customercare@apple.com'],
    categoryFields: {
      watchMovement: 'Apple S9 SiP Smartwatch',
      imeiOrMac: '35920192830192',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sample-4',
    userId: 'demo-user',
    assetName: 'Star Health Optima Mediclaim Policy',
    category: 'health',
    docType: 'Health Insurance',
    owner: 'Siddhant Manjargi',
    vendor: 'Star Health & Allied Insurance',
    manufacturer: 'Star Health',
    purchasePrice: '₹ 22,400 / yr',
    purchaseDate: '01/12/2024',
    expiryDate: '30/11/2026',
    renewalDate: '15/11/2026',
    serialNumber: 'SH-OPT-9920182',
    policyNumber: 'SH-OPT-9920182',
    notes: '₹ 10,00,000 Sum Insured with Cashless Hospitalization at 14,000+ network hospitals.',
    addOns: ['Restoration Benefit', 'No Claim Bonus +50%', 'Cumulative Bonus'],
    reminders: ['Submit health checkup receipts for wellness discount', 'Pay renewal premium before Nov 30'],
    contacts: ['Toll-Free Helpline: 1800-425-2255', 'Claims Email: support@starhealth.in'],
    categoryFields: {
      coverageType: 'Cashless Hospitalization + Pre/Post ICU',
      idv: '₹ 10,00,000',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sample-5',
    userId: 'demo-user',
    assetName: 'Greenwood Heights Apartment 402',
    category: 'property',
    docType: 'Property Document',
    owner: 'Siddhant Manjargi',
    vendor: 'Sub-Registrar Office Bengaluru',
    purchasePrice: '₹ 1.25 Cr',
    purchaseDate: '10/06/2022',
    serialNumber: 'REG-BLR-2022-88190',
    notes: 'Registered Sale Deed for 3BHK Apartment (1,450 sq ft) with Dedicated Car Parking.',
    addOns: ['Occupancy Certificate (OC)', 'Khata A Certificate', 'Encumbrance Certificate (EC)'],
    reminders: ['Property Tax Payment due annually in April'],
    contacts: ['Association Manager: +91 98765 43210'],
    categoryFields: {
      propertyAddress: 'Flat 402, Greenwood Heights, Indiranagar, Bengaluru - 560038',
      deedNumber: 'REG-BLR-2022-88190',
      builtUpArea: '1,450 sq ft',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User | null): void {
  if (user) {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEYS.USER);
  }
}

export function getStoredAssets(): Asset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ASSETS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.ASSETS, JSON.stringify(SAMPLE_ASSETS));
      return SAMPLE_ASSETS;
    }
    return JSON.parse(raw);
  } catch {
    return SAMPLE_ASSETS;
  }
}

export function saveStoredAssets(assets: Asset[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ASSETS, JSON.stringify(assets));
  } catch (err) {
    console.error('Failed to save assets to localStorage:', err);
  }
}
