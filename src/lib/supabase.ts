import { createClient } from '@supabase/supabase-js';
import { Asset, User } from '../types/asset';

const supabaseUrl =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  (import.meta as any).env?.SUPABASE_URL ||
  '';

const supabaseAnonKey =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  (import.meta as any).env?.SUPABASE_ANON_KEY ||
  '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getLocalDisplayName(userId: string, username: string): string | null {
  try {
    const raw = localStorage.getItem('vault_display_names');
    if (!raw) return null;
    const map: Record<string, string> = JSON.parse(raw);
    return map[userId] || map[username] || null;
  } catch {
    return null;
  }
}

function saveLocalDisplayName(userId: string, username: string, displayName: string): void {
  try {
    const raw = localStorage.getItem('vault_display_names');
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    map[userId] = displayName;
    if (username) map[username] = displayName;
    localStorage.setItem('vault_display_names', JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

export async function updateUserDisplayName(
  userId: string,
  username: string,
  displayName: string
): Promise<void> {
  const cleanName = displayName.trim();
  if (!cleanName) return;

  const cleanUsername = username.trim().toLowerCase();
  saveLocalDisplayName(userId, cleanUsername, cleanName);

  // Also update local user registry if stored locally
  try {
    const rawUsers = localStorage.getItem('vault_registered_users');
    if (rawUsers) {
      const userMap = JSON.parse(rawUsers);
      if (userMap[cleanUsername]) {
        userMap[cleanUsername].displayName = cleanName;
        localStorage.setItem('vault_registered_users', JSON.stringify(userMap));
      }
    }
  } catch {
    // Ignore
  }

  if (supabase) {
    try {
      const { error } = await supabase
        .from('users')
        .update({ display_name: cleanName })
        .eq('id', userId);
      if (error) {
        // Gracefully ignore if custom Supabase users table lacks display_name column
        console.warn('Supabase display_name update note:', error.message);
      }
    } catch (err) {
      console.warn('Supabase display_name update skipped:', err);
    }
  }
}

// ----------------------------------------------------
// USER AUTHENTICATION HANDLERS
// ----------------------------------------------------

export async function signUpUser(
  username: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername) return { success: false, error: 'Username is required' };
  if (!password || password.length < 4) {
    return { success: false, error: 'Password must be at least 4 characters' };
  }

  const passwordHash = await hashPassword(password);

  if (supabase) {
    try {
      const { data: existingUser, error: queryErr } = await supabase
        .from('users')
        .select('*')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (queryErr && queryErr.code !== 'PGRST116') {
        console.warn('Supabase query error checking user:', queryErr);
      }

      if (existingUser) {
        return { success: false, error: 'Username already exists. Please sign in instead.' };
      }

      const newUserId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const { data: inserted, error: insertErr } = await supabase
        .from('users')
        .insert({
          id: newUserId,
          username: cleanUsername,
          password_hash: passwordHash,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertErr) {
        console.warn('Supabase users table error, using local fallback:', insertErr);
        return registerLocalUser(cleanUsername, passwordHash);
      }

      const defaultName = cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1);
      const userObj: User = {
        id: inserted.id || newUserId,
        email: cleanUsername,
        name: defaultName,
        isGuest: false,
      };

      return { success: true, user: userObj };
    } catch (err) {
      console.warn('Supabase signup exception, falling back to local credentials:', err);
      return registerLocalUser(cleanUsername, passwordHash);
    }
  }

  return registerLocalUser(cleanUsername, passwordHash);
}

function registerLocalUser(
  username: string,
  passwordHash: string
): { success: boolean; user?: User; error?: string } {
  try {
    const rawUsers = localStorage.getItem('vault_registered_users');
    const userMap: Record<
      string,
      { id: string; username: string; passwordHash: string; displayName?: string }
    > = rawUsers ? JSON.parse(rawUsers) : {};

    if (userMap[username]) {
      return { success: false, error: 'Username already exists. Please sign in instead.' };
    }

    const newId = `usr_${Date.now()}`;
    const defaultName = username.charAt(0).toUpperCase() + username.slice(1);
    userMap[username] = { id: newId, username, passwordHash, displayName: defaultName };
    localStorage.setItem('vault_registered_users', JSON.stringify(userMap));

    const userObj: User = {
      id: newId,
      email: username,
      name: defaultName,
      isGuest: false,
    };

    return { success: true, user: userObj };
  } catch {
    return { success: false, error: 'Failed to create user credentials.' };
  }
}

export async function signInUser(
  username: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername || !password) {
    return { success: false, error: 'Username and password are required' };
  }

  const passwordHash = await hashPassword(password);

  if (supabase) {
    try {
      const { data: foundUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (!error && foundUser) {
        if (foundUser.password_hash === passwordHash) {
          const resolvedName =
            foundUser.display_name ||
            getLocalDisplayName(foundUser.id, cleanUsername) ||
            cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1);

          const userObj: User = {
            id: foundUser.id,
            email: cleanUsername,
            name: resolvedName,
            isGuest: false,
          };
          return { success: true, user: userObj };
        } else {
          return { success: false, error: 'Incorrect password' };
        }
      }
    } catch (err) {
      console.warn('Supabase signin check failed, trying local store:', err);
    }
  }

  try {
    const rawUsers = localStorage.getItem('vault_registered_users');
    const userMap: Record<
      string,
      { id: string; username: string; passwordHash: string; displayName?: string }
    > = rawUsers ? JSON.parse(rawUsers) : {};

    const localUser = userMap[cleanUsername];
    if (!localUser) {
      return { success: false, error: 'User not found. Please create an account first.' };
    }

    if (localUser.passwordHash !== passwordHash) {
      return { success: false, error: 'Incorrect password' };
    }

    const resolvedName =
      localUser.displayName ||
      getLocalDisplayName(localUser.id, cleanUsername) ||
      cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1);

    const userObj: User = {
      id: localUser.id,
      email: cleanUsername,
      name: resolvedName,
      isGuest: false,
    };

    return { success: true, user: userObj };
  } catch {
    return { success: false, error: 'Authentication failed.' };
  }
}

// ----------------------------------------------------
// ASSET PERSISTENCE HANDLERS (STRICT PER-USER ZERO STATE)
// ----------------------------------------------------

export async function fetchUserAssetsFromCloud(userId: string): Promise<Asset[]> {
  if (!userId) return [];

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return data.map(mapRowToAsset);
      }
    } catch (err) {
      console.warn('Failed to fetch assets from Supabase:', err);
    }
  }

  try {
    const raw = localStorage.getItem(`user_assets_${userId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore
  }

  return [];
}

export async function saveUserAssetToCloud(asset: Asset): Promise<boolean> {
  if (supabase) {
    try {
      const dbRow = mapAssetToRow(asset);
      const { error } = await supabase.from('assets').upsert(dbRow);
      if (!error) {
        // Also mirror locally for instant load resilience
        mirrorLocalAsset(asset);
        return true;
      }
      console.warn('Supabase upsert asset error:', error);
    } catch (err) {
      console.warn('Supabase save exception:', err);
    }
  }

  return mirrorLocalAsset(asset);
}

function mirrorLocalAsset(asset: Asset): boolean {
  try {
    const raw = localStorage.getItem(`user_assets_${asset.userId}`) || '[]';
    const current: Asset[] = JSON.parse(raw);
    const updated = [asset, ...current.filter((a) => a.id !== asset.id)];
    localStorage.setItem(`user_assets_${asset.userId}`, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

export async function deleteUserAssetFromCloud(assetId: string, userId: string): Promise<boolean> {
  if (supabase) {
    try {
      const { error } = await supabase.from('assets').delete().eq('id', assetId);
      if (error) {
        console.warn('Supabase delete asset warning:', error);
      }
    } catch (err) {
      console.warn('Supabase delete exception:', err);
    }
  }

  try {
    const raw = localStorage.getItem(`user_assets_${userId}`) || '[]';
    const current: Asset[] = JSON.parse(raw);
    const updated = current.filter((a) => a.id !== assetId);
    localStorage.setItem(`user_assets_${userId}`, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

function mapAssetToRow(a: Asset) {
  return {
    id: a.id,
    user_id: a.userId,
    asset_name: a.assetName,
    category: a.category,
    doc_type: a.docType,
    owner: a.owner || null,
    vendor: a.vendor || null,
    manufacturer: a.manufacturer || null,
    model: a.model || null,
    purchase_price: a.purchasePrice || null,
    purchase_date: a.purchaseDate || null,
    expiry_date: a.expiryDate || null,
    warranty_ends: a.warrantyEnds || null,
    warranty_type: a.warrantyType || null,
    serial_number: a.serialNumber || null,
    invoice: a.invoice || null,
    notes: a.notes || null,
    add_ons: a.addOns || [],
    reminders: a.reminders || [],
    contacts: a.contacts || [],
    category_fields: a.categoryFields || {},
    attachment: a.attachment || null,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
  };
}

function mapRowToAsset(r: any): Asset {
  const catFields = r.category_fields || {};
  return {
    id: r.id,
    userId: r.user_id,
    assetName: r.asset_name,
    category: r.category,
    docType: r.doc_type,
    owner: r.owner || '',
    vendor: r.vendor || '',
    manufacturer: r.manufacturer || '',
    model: r.model || '',
    purchasePrice: r.purchase_price || '',
    purchaseDate: r.purchase_date || '',
    expiryDate: r.expiry_date || '',
    renewalDate: r.renewal_date || catFields.renewalDate || '',
    warrantyEnds: r.warranty_ends || '',
    warrantyType: r.warranty_type || '',
    serialNumber: r.serial_number || '',
    invoice: r.invoice || '',
    verificationUrl: r.verification_url || catFields.verificationUrl || '',
    notes: r.notes || '',
    addOns: Array.isArray(r.add_ons) ? r.add_ons : [],
    reminders: Array.isArray(r.reminders) ? r.reminders : [],
    contacts: Array.isArray(r.contacts) ? r.contacts : [],
    categoryFields: catFields,
    attachment: r.attachment || undefined,
    createdAt: r.created_at || new Date().toISOString(),
    updatedAt: r.updated_at || new Date().toISOString(),
  };
}
