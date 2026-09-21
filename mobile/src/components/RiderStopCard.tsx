import { StyleSheet, View } from 'react-native';
import type { DeliveryStop } from '@/api/types';
import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/ui/Text';
import { colors, money, orderStatusMeta, spacing } from '@/theme';

export function RiderStopCard({ stop, dark = true }: { stop: DeliveryStop; dark?: boolean }) {
  const statusKey = stop.order_status ?? stop.status;
  const meta = orderStatusMeta[statusKey as keyof typeof orderStatusMeta];
  const text = dark ? colors.riderText : colors.text;
  const muted = dark ? colors.riderMuted : colors.textMuted;
  const payment = (stop.payment_method ?? 'cod').toUpperCase();
  const items = stop.items ?? [];

  return (
    <View style={[styles.card, dark && styles.cardDark]}>
      <View style={styles.row}>
        <Text variant="button" style={{ color: text }}>Order #{stop.order_id}</Text>
        <Pill text={meta?.label ?? statusKey ?? 'Order'} color={meta?.color ?? colors.textMuted} />
      </View>
      <Text variant="bodySmall" style={{ color: muted, marginTop: spacing.xs }}>{stop.customer_name}</Text>
      <Text variant="bodySmall" style={{ color: muted }}>{stop.address_text}</Text>
      <Text variant="caption" style={{ color: muted, marginTop: spacing.xs }}>
        {payment} · {money(stop.total_cents)}
      </Text>
      {items.length > 0 ? (
        <View style={styles.items}>
          {items.map((item, idx) => (
            <Text key={`${stop.order_id}-${idx}`} variant="bodySmall" style={{ color: text }}>
              {item.quantity} × {item.name}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, padding: spacing.md, marginTop: spacing.md, backgroundColor: colors.surface },
  cardDark: { backgroundColor: colors.riderBg, borderWidth: 1, borderColor: colors.riderBorder },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  items: { marginTop: spacing.sm, gap: 2 },
});
