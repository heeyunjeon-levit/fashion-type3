export interface Category {
  id: string
  label: string
  englishLabel: string
}

export const categories: Category[] = [
  { id: 'tops', label: '상의', englishLabel: 'Top' },
  { id: 'bottoms', label: '하의', englishLabel: 'Bottom' },
  { id: 'bag', label: '가방', englishLabel: 'Bag' },
  { id: 'shoes', label: '신발', englishLabel: 'Shoes' },
  { id: 'accessory', label: '악세사리', englishLabel: 'Accessory' },
  { id: 'dress', label: '드레스', englishLabel: 'Dress' },
]

