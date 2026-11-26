/** Working slots — the partner picks the daily windows they will work.
 *
 * While a selected slot is running the backend switches the partner online
 * (and keeps "go online" available); outside their slots they stay offline.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '@/api/client';
import type { RiderSlots } from '@/api/types';
import { ErrorState } from '@/components/ErrorState';
import { FeedbackBanner } from '@/components/FeedbackBanner';
import { useFeedback } from '@/components/FeedbackProvider';
import { Loading } from '@/components/Loading';
import { PartnerCard } from '@/components/partner';
import { Button } from '@/components/ui/Button';
import { FlowScreenHeader } from '@/components/ui/FlowScreenHeader';
import { Text } from '@/components/ui/Text';
import { slotTimingLabel } from '@/lib/slots';
import { colors, radius, spacing } from '@/theme';

export default function SlotsScreen() {
  const feedback = useFeedback();
  const [data, setData] = useState<RiderSlots | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const apply = (d: RiderSlots) => {
    setData(d);
    setSelected(new Set(d.slots.filter((s) => s.selected).map((s) => s.id)));
  };

  const load = useCallback(async () => {
    try {
      apply(await api.riderSlots());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load slots');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const dirty = !!data && (
    data.slots.some((s) => s.selected !== selected.has(s.id))
  );

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const d = await api.setRiderSlots([...selected]);
      apply(d);
      feedback.success(
        d.current_slot_id ? "Saved — you're in a slot now and online." : 'Saved — you will go online automatically when your slot starts.',
        'Slots updated',
      );
    } catch (err) {
      feedback.error(err instanceof ApiError ? err.message : 'Could not save slots', 'Not saved');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlowScreenHeader title="Working slots" />
      {!data && !error ? <Loading label="Loading slots…" /> : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.primary} />}
        >
          {error ? <ErrorState message={error} variant="inline" /> : null}
          {data ? (
            <>
              <Text variant="bodySmall" style={{ color: colors.textMuted, marginBottom: spacing.md }}>
                Pick the slots you want to work every day. During a selected slot you go online automatically and receive orders.
                When it ends you go offline (after finishing any delivery in progress).
              </Text>

              {!data.enforced ? (
                <FeedbackBanner severity="info" title="No slots required" message="You can go online any time right now." />
              ) : null}

              {data.slots.map((slot) => {
                const isOn = selected.has(slot.id);
                const blocked = slot.is_full && !isOn;
                return (
                  <Pressable
                    key={slot.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isOn, disabled: blocked }}
                    disabled={blocked || saving}
                    onPress={() => toggle(slot.id)}
                  >
                    <PartnerCard variant="lowest" style={StyleSheet.flatten([styles.slot, isOn && styles.slotOn, blocked && { opacity: 0.5 }])}>
                      <View style={[styles.check, isOn && styles.checkOn]}>
                        {isOn ? <Ionicons name="checkmark" size={18} color={colors.onSecondary} /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.slotTitleRow}>
                          <Text variant="label" style={{ fontWeight: '700' }}>{slot.name}</Text>
                          {slot.is_running ? (
                            <View style={styles.livePill}><Text variant="caption" style={styles.liveText}>NOW</Text></View>
                          ) : null}
                        </View>
                        <Text variant="h3" style={{ marginTop: 2 }}>{slot.label}</Text>
                        <Text variant="caption" style={{ color: colors.textMuted, marginTop: 2 }}>
                          {blocked ? 'Slot is full' : slotTimingLabel(slot)}
                        </Text>
                      </View>
                    </PartnerCard>
                  </Pressable>
                );
              })}

              {data.enforced && data.slots.length === 0 ? (
                <Text variant="bodySmall" style={{ color: colors.textMuted }}>No slots are open yet. Please check back later.</Text>
              ) : null}

              <Button title="Save slots" onPress={save} loading={saving} disabled={!dirty} style={{ marginTop: spacing.lg }} />
              {data.enforced && selected.size === 0 ? (
                <Text variant="caption" style={{ color: colors.warning, textAlign: 'center', marginTop: spacing.sm }}>
                  Select at least one slot to be able to go online.
                </Text>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
  },
  slotOn: { borderColor: colors.secondary, backgroundColor: colors.secondarySoft },
  check: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  slotTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  livePill: { backgroundColor: colors.secondary, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 1 },
  liveText: { color: colors.onSecondary, fontWeight: '800', fontSize: 10 },
});
