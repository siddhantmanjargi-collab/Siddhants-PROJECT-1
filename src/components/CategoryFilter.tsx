import React from 'react';
import { AssetCategory } from '../types/asset';

interface CategoryFilterProps {
  selectedCategory: string; // 'all' or AssetCategory
  onSelectCategory: (category: string) => void;
}

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'all', label: 'All Categories' },
  { id: 'vehicular', label: 'Vehicular' },
  { id: 'electronics', label: 'Electronics' },
  { id: 'camera', label: 'Cameras & Optics' },
  { id: 'watch', label: 'Watches' },
  { id: 'appliances', label: 'Appliances' },
  { id: 'health', label: 'Health' },
  { id: 'identity', label: 'IDs & Documents' },
  { id: 'property', label: 'Property' },
  { id: 'finance', label: 'Finance' },
  { id: 'furniture', label: 'Furniture' },
  { id: 'jewellery', label: 'Jewellery' },
  { id: 'machinery', label: 'Machinery' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'other', label: 'Other' },
];

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none scroll-smooth">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => onSelectCategory(cat.id)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
            selectedCategory === cat.id
              ? 'bg-[#C9A15D] text-[#14211B] border-[#C9A15D] font-semibold shadow-sm'
              : 'bg-transparent text-[#8FA79B] border-[#2A3B33] hover:border-[#C9A15D] hover:text-[#EDEDE1]'
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
};
