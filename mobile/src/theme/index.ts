export { colors } from './colors';
export { spacing } from './spacing';
export { radius } from './radius';
export { shadow, shadowMd, shadowLg } from './shadows';
export { typography, fontFamily } from './typography';
export { authThemes, type AuthTheme } from './auth';
import { colors } from './colors';
export const orderStatusMeta: Record<string, { label: string; color: string }> = {
  placed: { label: 'Placed', color: colors.textMuted },
  accepted: { label: 'Accepted', color: colors.primary },
  preparing: { label: 'Preparing', color: colors.warning },
  ready: { label: 'Ready', color: colors.secondary },
  assigned: { label: 'Rider assigned', color: colors.primary },
  picked_up: { label: 'Picked up', color: colors.primary },
  out_for_delivery: { label: 'On the way', color: colors.secondary },
  delivered: { label: 'Delivered', color: colors.success },
  cancelled: { label: 'Cancelled', color: colors.danger },
};
export const batchStatusMeta: Record<string, { label: string; color: string }> = {
  open: { label: 'Awaiting rider', color: colors.textMuted },
  offered: { label: 'Offer sent', color: colors.warning },
  assigned: { label: 'Head to pickup', color: colors.primary },
  picked_up: { label: 'Out for delivery', color: colors.secondary },
  completed: { label: 'Completed', color: colors.success },
  cancelled: { label: 'Cancelled', color: colors.danger },
};

export function formatStatus(status: string | undefined | null): string {
  if (!status) return 'Unknown';
  const key = status.toLowerCase();
  return orderStatusMeta[key]?.label ?? batchStatusMeta[key]?.label ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function statusColor(status: string | undefined | null): string {
  if (!status) return colors.textMuted;
  const key = status.toLowerCase();
  return orderStatusMeta[key]?.color ?? batchStatusMeta[key]?.color ?? colors.textMuted;
}

export function money(cents: number): string {
  const rupees = cents / 100;
  if (rupees % 1 === 0) return `₹${rupees.toFixed(0)}`;
  return `₹${rupees.toFixed(2)}`;
}
export function estimateDeliveryMins(distanceKm: number | null): string {
  if (distanceKm == null) return '25–35 min';
  const mins = Math.round(15 + distanceKm * 8);
  return `${Math.max(15, mins - 5)}–${mins + 10} min`;
}
export function priceRangeLabel(minCents: number, maxCents: number): string {
  const max = maxCents / 100;
  if (max <= 150) return '₹';
  if (max <= 300) return '₹₹';
  return '₹₹₹';
}

export * from './feedback';
