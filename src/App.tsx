import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Plus,
  Search,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { Asset, User } from './types/asset';
import {
  getStoredUser,
  setStoredUser,
  getAssetStatus
} from './utils/storage';
import {
  fetchUserAssetsFromCloud,
  saveUserAssetToCloud,
  deleteUserAssetFromCloud
} from './lib/supabase';
import { AuthScreen } from './components/AuthScreen';
import { StatsBar } from './components/StatsBar';
import { CategoryFilter } from './components/CategoryFilter';
import { AssetCard } from './components/AssetCard';
import { AssetDetailModal } from './components/AssetDetailModal';
import { ScanModal } from './components/ScanModal';
import { AddAssetModal } from './components/AddAssetModal';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'safe' | 'warn' | 'danger'>('all');

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  useEffect(() => {
    if (user) {
      setIsLoadingAssets(true);
      fetchUserAssetsFromCloud(user.id).then((cloudAssets) => {
        setAssets(cloudAssets);
        setIsLoadingAssets(false);
      });
    } else {
      setAssets([]);
    }
  }, [user]);

  const handleAddOrEditAsset = async (
    assetData: Omit<Asset, 'id' | 'userId' | 'createdAt' | 'updatedAt'> | Asset
  ) => {
    if (!user) return;

    let targetAsset: Asset;
    if ('id' in assetData && assetData.id) {
      targetAsset = {
        ...(assetData as Asset),
        updatedAt: new Date().toISOString(),
      };
    } else {
      targetAsset = {
        ...(assetData as Omit<Asset, 'id' | 'userId' | 'createdAt' | 'updatedAt'>),
        id: `ast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userId: user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    setAssets((prev) => {
      const exists = prev.some((a) => a.id === targetAsset.id);
      if (exists) {
        return prev.map((a) => (a.id === targetAsset.id ? targetAsset : a));
      }
      return [targetAsset, ...prev];
    });

    await saveUserAssetToCloud(targetAsset);
  };

  const handleDeleteAsset = async (id: string) => {
    if (!user) return;
    setAssets((prev) => prev.filter((a) => a.id !== id));
    await deleteUserAssetFromCloud(id, user.id);
  };

  const handleLogout = () => {
    setStoredUser(null);
    setUser(null);
  };

  const urgentAlerts = useMemo(() => {
    return assets.filter((a) => {
      const st = getAssetStatus(a.expiryDate);
      return st === 'danger' || st === 'warn';
    });
  }, [assets]);

  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      if (selectedCategory !== 'all' && a.category !== selectedCategory) {
        return false;
      }

      if (statusFilter !== 'all') {
        const st = getAssetStatus(a.expiryDate);
        if (st !== statusFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = a.assetName.toLowerCase().includes(q);
        const matchVendor = a.vendor?.toLowerCase().includes(q);
        const matchModel = a.model?.toLowerCase().includes(q);
        const matchSerial = a.serialNumber?.toLowerCase().includes(q);
        const matchDoc = a.docType.toLowerCase().includes(q);
        return matchName || matchVendor || matchModel || matchSerial || matchDoc;
      }

      return true;
    });
  }, [assets, selectedCategory, statusFilter, searchQuery]);

  const groupedAssets = useMemo(() => {
    const groups: Record<string, Asset[]> = {};
    filteredAssets.forEach((a) => {
      const cat = a.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(a);
    });
    return groups;
  }, [filteredAssets]);

  if (!user) {
    return <AuthScreen onLoginSuccess={setUser} />;
  }

  return (
    <div className="min-h-screen pb-16">
      {/* 3-Zone Top Bar */}
      <header className="bg-[#16261F]/95 backdrop-blur-md border-b border-[#2A3B33] sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <span className="font-serif font-semibold text-lg text-[#EDEDE1] whitespace-nowrap shrink-0">
            Asset Wallet
          </span>

          {/* Zone 2: Clean single-line text links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#8FA79B]">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setSelectedCategory('all');
              }}
              className={`hover:text-[#EDEDE1] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === 'all' && selectedCategory === 'all' ? 'text-[#EDEDE1]' : ''
              }`}
            >
              All Assets
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('warn')}
              className={`hover:text-[#EDEDE1] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === 'warn' ? 'text-[#E4C98A]' : ''
              }`}
            >
              Expiring Soon
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingAsset(null);
                setIsAddOpen(true);
              }}
              className="hover:text-[#EDEDE1] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Add Manually
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="hover:text-[#C97B6B] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Sign Out
            </button>
          </nav>

          {/* Zone 3: 1 Primary CTA */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setIsScanOpen(true)}
              className="px-4 py-2 bg-[#C9A15D] hover:bg-[#E4C98A] text-[#14211B] font-semibold text-xs rounded-lg transition-colors shadow-sm flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Sparkles size={14} />
              <span>Scan Document</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        {/* Personalized Vault Title & Mobile Actions */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-[#2A3B33]">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-medium text-[#EDEDE1]">
              {user.name}&apos;s Vault
            </h1>
            <p className="text-sm text-[#8FA79B] mt-1">
              Personal asset registry, document vault, and renewal alerts
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setEditingAsset(null);
                setIsAddOpen(true);
              }}
              className="px-4 py-2 bg-[#1C2E26] hover:bg-[#2A3B33] border border-[#2A3B33] hover:border-[#C9A15D] text-[#EDEDE1] font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus size={15} className="text-[#C9A15D]" />
              <span>Add Asset</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="md:hidden px-3 py-2 text-xs text-[#8FA79B] hover:text-[#C97B6B] whitespace-nowrap"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Urgent Expiry Warning Banner */}
        {urgentAlerts.length > 0 && (
          <div className="bg-[#E0913F]/15 border border-[#E0913F]/40 rounded-xl p-4 flex items-center justify-between gap-4 text-xs font-mono">
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className="text-[#E0913F] shrink-0" />
              <div>
                <span className="font-bold text-[#E4C98A] tabular-nums">
                  {urgentAlerts.length} Asset{urgentAlerts.length > 1 ? 's' : ''} Require Renewal Attention
                </span>
                <p className="text-[#8FA79B] text-[11px] mt-0.5">
                  Review expiring insurance policies, warranties, or documents in your vault.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStatusFilter('warn')}
              className="px-3.5 py-2 bg-[#E0913F] text-[#14211B] font-bold rounded-lg shrink-0 hover:bg-[#E4C98A] transition-colors whitespace-nowrap"
            >
              View Alerts
            </button>
          </div>
        )}

        {/* Stats Strip */}
        <StatsBar
          assets={assets}
          activeFilter={statusFilter}
          onSelectFilter={setStatusFilter}
        />

        {/* Search & Category Filter Row */}
        <div className="space-y-4">
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8FA79B]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assets by name, vendor, model, serial number, or document type..."
              className="w-full bg-[#16261F] border border-[#2A3B33] rounded-xl pl-10 pr-16 py-3 text-sm text-[#EDEDE1] placeholder-[#8FA79B]/60 focus:outline-none focus:border-[#C9A15D] focus:ring-1 focus:ring-[#C9A15D] font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#8FA79B] hover:text-[#EDEDE1]"
              >
                Clear
              </button>
            )}
          </div>

          <CategoryFilter
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        </div>

        {/* Assets List or Zero-State */}
        <div className="space-y-8">
          {isLoadingAssets ? (
            <div className="py-12 text-center text-[#8FA79B] font-mono text-xs">
              Loading vault records...
            </div>
          ) : Object.keys(groupedAssets).length === 0 ? (
            <div className="bg-[#16261F] border border-[#2A3B33] rounded-2xl p-10 text-center space-y-4 my-6">
              <div className="w-14 h-14 mx-auto rounded-xl bg-[#1C2E26] border border-[#2A3B33] flex items-center justify-center text-[#C9A15D]">
                <ShieldCheck size={28} />
              </div>
              <h2 className="text-xl font-serif text-[#EDEDE1] font-medium">
                {assets.length === 0 ? 'Your Vault is Empty' : 'No Matching Assets Found'}
              </h2>
              <p className="text-sm text-[#8FA79B] max-w-md mx-auto leading-relaxed">
                {assets.length === 0
                  ? 'Upload an invoice, insurance policy, or warranty certificate to extract details automatically, or add your first asset manually.'
                  : 'Try clearing your search or category filter to view all saved assets.'}
              </p>

              <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsScanOpen(true)}
                  className="px-5 py-2.5 bg-[#C9A15D] text-[#14211B] font-semibold text-sm rounded-lg hover:bg-[#E4C98A] transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Sparkles size={16} /> Scan Document
                </button>
                {assets.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAsset(null);
                      setIsAddOpen(true);
                    }}
                    className="px-5 py-2.5 bg-[#1C2E26] border border-[#2A3B33] text-[#EDEDE1] font-medium text-sm rounded-lg hover:border-[#C9A15D] transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <Plus size={16} className="text-[#C9A15D]" /> Add Asset Manually
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                      setStatusFilter('all');
                    }}
                    className="px-5 py-2.5 bg-[#1C2E26] border border-[#2A3B33] text-[#EDEDE1] font-medium text-sm rounded-lg hover:border-[#C9A15D] transition-colors whitespace-nowrap"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            Object.entries(groupedAssets).map(([catKey, catAssets]) => (
              <section key={catKey} className="space-y-3">
                <div className="flex items-center gap-3">
                  <h2 className="font-semibold text-sm capitalize text-[#C9A15D]">
                    {catKey}
                  </h2>
                  <span className="font-mono text-xs text-[#8FA79B] tabular-nums">
                    {catAssets.length}
                  </span>
                  <div className="flex-1 h-px bg-[#2A3B33]" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {catAssets.map((asset) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      onClick={() => setSelectedAsset(asset)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </main>

      {/* Modals */}
      {selectedAsset && (
        <AssetDetailModal
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
          onEdit={(asset) => {
            setSelectedAsset(null);
            setEditingAsset(asset);
            setIsAddOpen(true);
          }}
          onDelete={handleDeleteAsset}
        />
      )}

      {isScanOpen && (
        <ScanModal
          onClose={() => setIsScanOpen(false)}
          onSaveAsset={handleAddOrEditAsset}
        />
      )}

      {(isAddOpen || editingAsset) && (
        <AddAssetModal
          initialAsset={editingAsset}
          onClose={() => {
            setIsAddOpen(false);
            setEditingAsset(null);
          }}
          onSave={handleAddOrEditAsset}
        />
      )}
    </div>
  );
};
