import type { EarningsResponse } from '@/api/types';

export type DayBucket = {
  key: string;
  label: string;
  short: string;
  amountCents: number;
  trips: number;
  isToday: boolean;
};

export type DailyEarningRow = {
  key: string;
  title: string;
  subtitle: string;
  amountCents: number;
  trips: number;
  icon: 'today' | 'weekend' | 'weekday';
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function inRange(iso: string | null, start: Date, end: Date) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t < end.getTime();
}

const DAY_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function weekRangeLabel(start: Date) {
  const end = addDays(start, 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function nextTuesdayLabel(from = new Date()) {
  const d = new Date(from);
  const day = d.getDay();
  const daysUntil = ((2 - day + 7) % 7) || 7;
  d.setDate(d.getDate() + daysUntil);
  return d.toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' });
}

export function buildWeeklyView(data: EarningsResponse) {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);
  const prevStart = addDays(weekStart, -7);
  const prevEnd = weekStart;

  const weekLines = data.lines.filter((l) => inRange(l.delivered_at, weekStart, weekEnd));
  const prevLines = data.lines.filter((l) => inRange(l.delivered_at, prevStart, prevEnd));

  const weekTotal = weekLines.reduce((s, l) => s + l.amount_cents, 0);
  const prevTotal = prevLines.reduce((s, l) => s + l.amount_cents, 0);
  const pctChange = prevTotal > 0 ? ((weekTotal - prevTotal) / prevTotal) * 100 : weekTotal > 0 ? 100 : 0;

  const buckets: DayBucket[] = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i);
    const next = addDays(day, 1);
    const lines = weekLines.filter((l) => inRange(l.delivered_at, day, next));
    const amount = lines.reduce((s, l) => s + l.amount_cents, 0);
    return {
      key: day.toISOString(),
      label: day.toLocaleDateString('en-IN', { weekday: 'long' }),
      short: DAY_SHORT[i],
      amountCents: amount,
      trips: lines.length,
      isToday: startOfDay(day).getTime() === startOfDay(now).getTime(),
    };
  });

  const peak = [...buckets].sort((a, b) => b.amountCents - a.amountCents)[0];
  const trips = weekLines.length;
  const avgPerDelivery = trips > 0 ? Math.round(weekTotal / trips) : 0;
  const onlineMinutes = trips * 42 + (trips > 0 ? 90 : 0);
  const onlineHours = Math.floor(onlineMinutes / 60);
  const onlineMins = onlineMinutes % 60;

  return {
    weekStart,
    weekTotal,
    trips,
    pctChange,
    avgPerDelivery,
    onlineLabel: trips > 0 ? `${onlineHours}h ${onlineMins}m` : '—',
    buckets,
    peak,
    rangeLabel: weekRangeLabel(weekStart),
  };
}

export function buildDailyRows(data: EarningsResponse): DailyEarningRow[] {
  const map = new Map<string, DailyEarningRow>();
  const today = startOfDay(new Date());

  for (const line of data.lines) {
    if (!line.delivered_at) continue;
    const day = startOfDay(new Date(line.delivered_at));
    const key = day.toISOString();
    if (!map.has(key)) {
      const isToday = day.getTime() === today.getTime();
      const dayOfWeek = day.getDay();
      const icon = isToday ? 'today' : dayOfWeek === 0 || dayOfWeek === 6 ? 'weekend' : 'weekday';
      let title = day.toLocaleDateString('en-IN', { weekday: 'long' });
      if (isToday) title = 'Today';
      map.set(key, {
        key,
        title,
        subtitle: isToday ? 'Current shift' : day.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        amountCents: 0,
        trips: 0,
        icon,
      });
    }
  }

  return [...map.values()]
    .map((row) => {
      const lines = data.lines.filter(
        (l) => l.delivered_at && startOfDay(new Date(l.delivered_at)).toISOString() === row.key,
      );
      const amountCents = lines.reduce((s, l) => s + l.amount_cents, 0);
      const trips = lines.length;
      const day = new Date(row.key);
      const isToday = startOfDay(day).getTime() === today.getTime();
      const isPeakSat = day.getDay() === 6 && amountCents >= 15000;
      return {
        ...row,
        title: isToday ? 'Today' : isPeakSat ? 'Peak Saturday' : row.title,
        amountCents,
        trips,
        subtitle: isToday
          ? 'Current shift'
          : `${trips} deliveries · ${day.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`,
      };
    })
    .sort((a, b) => new Date(b.key).getTime() - new Date(a.key).getTime())
    .slice(0, 5);
}

export function formatK(cents: number) {
  const rupees = cents / 100;
  if (rupees >= 1000) return `${(rupees / 1000).toFixed(1)}k`;
  return `${Math.round(rupees)}`;
}
