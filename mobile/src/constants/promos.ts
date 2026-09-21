export interface Promo {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  gradient: [string, string];
}

export const PROMOS: Promo[] = [
  { id: '1', title: 'MONTHLY MEAL PLANS', subtitle: 'Save more on everyday meals', cta: 'Explore Plans →', gradient: ['#5B3DF5', '#7C5CFF'] },
  { id: '2', title: 'NEW MESS NEAR YOU', subtitle: "Discover today's best meals", cta: 'Explore →', gradient: ['#19C6A5', '#2DD4BF'] },
  { id: '3', title: 'FREE DELIVERY', subtitle: 'On your first 3 orders', cta: 'Order Now →', gradient: ['#FFC857', '#FFB020'] },
];
