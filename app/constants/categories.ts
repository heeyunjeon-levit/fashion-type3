export interface Category {
  id: string
  label: string
  englishLabel: string
}

export const categories: Category[] = [
  { id: 'tops', label: '상의', englishLabel: 'tops' },
  { id: 'bottoms', label: '하의', englishLabel: 'bottoms' },
  { id: 'bag', label: '가방', englishLabel: 'bag' },
  { id: 'shoes', label: '신발', englishLabel: 'shoes' },
  { id: 'accessory', label: '악세사리', englishLabel: 'accessory' },
  { id: 'dress', label: '드레스', englishLabel: 'dress' },
]

