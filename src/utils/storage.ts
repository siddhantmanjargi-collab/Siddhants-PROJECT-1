import { Asset, User } from '../types/asset';

const STORAGE_KEYS = {
  USER: 'asset_wallet_user',
  ASSETS: 'asset_wallet_assets',
};

// Date helper
export function parseDate(dateStr?: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const s = dateStr.trim();
  if (!s) return null;

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/').map(Number);
    return new Date(y, m - 1, d);
  }

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

// Strict Zero-State Default: New users have 0 initial documents
export function getStoredAssets(userId?: string): Asset[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`user_assets_${userId}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore
  }
  return [];
}

export function saveStoredAssets(userId: string, assets: Asset[]): void {
  try {
    localStorage.setItem(`user_assets_${userId}`, JSON.stringify(assets));
  } catch (err) {
    console.error('Failed to save assets to local storage:', err);
  }
}
