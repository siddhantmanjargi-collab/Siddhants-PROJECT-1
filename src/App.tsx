import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Plus,
  Search,
  LogOut,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Layers,
  FileText,
  UserCheck
} from 'lucide-react';
import { Asset, User } from './types/asset';
import {
  getStoredUser,
  setStoredUser,
  getStoredAssets,
  saveStoredAssets,
  getAssetStatus,
  calculateDaysRemaining
} from './utils/storage';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'safe' | 'warn' | 'danger'>('all');

  // Modals state
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  useEffect(() => {
    if (user) {
      const loaded = getStoredAssets();
      setAssets(loaded);
    }
  }, [user]);

  const handleSaveAssets = (newAssets: Asset[]) => {
    setAssets(newAssets);
    saveStoredAssets(newAssets);
  };

  const handleAddAsset = (assetData: Omit<Asset, 'id' | 'userId' | 'createdAt' | 'updatedAt'> | Asset) => {
    if ('id' in assetData && assetData.id) {
      // Edit existing
      const updated = assets.map((a) => (a.id === assetData.id ? (assetData as Asset) : a));
      handleSaveAssets(updated);
    } else {
      // Create new
      const newAsset: Asset = {
        ...(assetData as Omit<Asset, 'id' | 'userId' | 'createdAt' | 'updatedAt'>),
        id: `asset-${Date.now()}`,
        userId: user?.id || 'demo-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      handleSaveAssets([newAsset, ...assets]);
    }
  };

  const handleDeleteAsset = (id: string) => {
    const filtered = assets.filter((a) => a.id !== id);
    handleSaveAssets(filtered);
  };

  const handleLogout = () => {
    setStoredUser(null);
    setUser(null);
  };

  // Urgent alerts calculation
  const urgentAlerts = useMemo(() => {
    return assets.filter((a) => {
      const st = getAssetStatus(a.expiryDate);
      return st === 'danger' || st === 'warn';
    });
  }, [assets]);

  // Filtered Assets list
  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      // Category filter
      if (selectedCategory !== 'all' && a.category !== selectedCategory) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        const st = getAssetStatus(a.expiryDate);
        if (st !== statusFilter) return false;
      }

      // Search query filter
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

  // Group assets by category
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
      {/* Top Navbar */}
      <header className="bg-[#16261F]/90 backdrop-blur-md border-b border-[#2A3B33] sticky top-0 z-30 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#C9A15D]/20 border border-[#C9A15D]/40 flex items-center justify-center text-[#E4C98A] font-serif font-bold text-sm">
              AV
            </div>
            <div>
              <h1 className="font-serif font-medium text-base sm:text-lg text-[#EDEDE1] leading-tight">
                {user.name}'s Vault
              </h1>
              <p className="font-mono text-[10px] text-[#C9A15D] uppercase tracking-wider">
                Asset & Document Vault
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setIsScanOpen(true)}
              className="px-3 py-2 bg-[#C9A15D] hover:bg-[#E4C98A] text-[#14211B] font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5"
            >
              <Sparkles size={15} />
              <span className="hidden sm:inline">Scan Document</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingAsset(null);
                setIsAddOpen(true);
              }}
              className="px-3 py-2 bg-[#1C2E26] hover:bg-[#2A3B33] border border-[#2A3B33] hover:border-[#C9A15D] text-[#EDEDE1] font-medium text-xs rounded-xl transition-all flex items-center gap-1.5"
            >
              <Plus size={15} className="text-[#C9A15D]" />
              <span className="hidden sm:inline">Add Asset</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="p-2 text-[#8FA79B] hover:text-[#C97B6B] hover:bg-[#1C2E26] rounded-xl transition-colors"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-6">
        {/* Expiry Warning Banner */}
        {urgentAlerts.length > 0 && (
          <div className="bg-[#E0913F]/15 border border-[#E0913F]/40 rounded-2xl p-4 flex items-center justify-between gap-4 text-xs font-mono">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#E0913F]/20 text-[#E0913F] shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div>
                <span className="font-bold text-[#E4C98A]">
                  {urgentAlerts.length} Asset{urgentAlerts.length > 1 ? 's' : ''} Require Attention
                </span>
                <p className="text-[#8FA79B] text-[11px] mt-0.5">
                  Check expiring insurance policies, warranties, or documents in your vault.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStatusFilter('warn')}
              className="px-3 py-1.5 bg-[#E0913F] text-[#14211B] font-bold rounded-lg shrink-0 hover:bg-[#E4C98A] transition-colors"
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
              placeholder="Search assets by name, vendor, model, serial # or document type..."
              className="w-full bg-[#16261F] border border-[#2A3B33] rounded-xl pl-10 pr-4 py-3 text-sm text-[#EDEDE1] placeholder-[#8FA79B]/60 focus:outline-none focus:border-[#C9A15D] focus:ring-1 focus:ring-[#C9A15D] font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8FA79B] hover:text-[#EDEDE1]"
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

        {/* Assets List Grouped by Category */}
        <div className="space-y-8">
          {Object.keys(groupedAssets).length === 0 ? (
            <div className="bg-[#16261F] border border-[#2A3B33] rounded-2xl p-10 text-center space-y-4 my-8">
              <Layers size={40} className="mx-auto text-[#2A3B33]" />
              <h3 className="text-base font-semibold text-[#EDEDE1]">No matching assets found</h3>
              <p className="text-xs text-[#8FA79B] max-w-sm mx-auto">
                Try clearing your search filters or scan a new document to automatically add assets to your vault.
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsScanOpen(true)}
                  className="px-4 py-2.5 bg-[#C9A15D] text-[#14211B] font-bold text-xs rounded-xl hover:bg-[#E4C98A] transition-colors flex items-center gap-2"
                >
                  <Sparkles size={16} /> Scan Document with AI
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setStatusFilter('all');
                  }}
                  className="px-4 py-2.5 bg-[#1C2E26] border border-[#2A3B33] text-[#EDEDE1] font-semibold text-xs rounded-xl hover:border-[#C9A15D] transition-colors"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          ) : (
            Object.entries(groupedAssets).map(([catKey, catAssets]) => (
              <div key={catKey} className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#C9A15D]">
                    {catKey}
                  </span>
                  <span className="font-mono text-xs text-[#8FA79B]">
                    ({catAssets.length})
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
              </div>
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
          onSaveAsset={handleAddAsset}
        />
      )}

      {(isAddOpen || editingAsset) && (
        <AddAssetModal
          initialAsset={editingAsset}
          onClose={() => {
            setIsAddOpen(false);
            setEditingAsset(null);
          }}
          onSave={handleAddAsset}
        />
      )}
    </div>
  );
};
