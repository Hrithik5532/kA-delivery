export interface Category {
  id: string;
  label: string;
  icon: string;
  keywords: string[];
}

export const CATEGORIES: Category[] = [
  { id: 'thali', label: 'Thali', icon: 'restaurant', keywords: ['thali', 'meals', 'combo'] },
  { id: 'healthy', label: 'Healthy', icon: 'leaf', keywords: ['salad', 'healthy', 'curd'] },
  { id: 'north', label: 'North Indian', icon: 'flame', keywords: ['paneer', 'naan', 'dal'] },
  { id: 'south', label: 'South Indian', icon: 'cafe', keywords: ['rice', 'curd', 'south'] },
  { id: 'home', label: 'Home Food', icon: 'home', keywords: ['home', 'homestyle', 'comfort'] },
  { id: 'veg', label: 'Veg', icon: 'nutrition', keywords: ['veg', 'paneer', 'dal'] },
];
