import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { MacroTotals } from '@/nutrition/portion';

export type MacroTargets = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/**
 * Calories remaining plus a bar per macro. Bars are capped at 100% width but the
 * numeric label is not — going over target is information the user needs, not something
 * to hide behind a full bar.
 */
export function MacroSummary({
  totals,
  targets,
}: {
  totals: MacroTotals;
  targets: MacroTargets | null;
}) {
  const theme = useTheme();
  const remaining = targets ? Math.round(targets.kcal - totals.kcal) : null;

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.headline}>
        <ThemedText type="subtitle">{Math.round(totals.kcal)}</ThemedText>
        <ThemedText themeColor="textSecondary">
          {targets ? `of ${Math.round(targets.kcal)} kcal` : 'kcal logged'}
        </ThemedText>
      </View>

      {remaining !== null ? (
        <ThemedText type="small" themeColor={remaining < 0 ? 'danger' : 'textSecondary'}>
          {remaining >= 0 ? `${remaining} kcal left today` : `${Math.abs(remaining)} kcal over`}
        </ThemedText>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Set a goal in Settings to see how much you have left.
        </ThemedText>
      )}

      <View style={styles.bars}>
        <MacroBar label="Protein" value={totals.protein} target={targets?.proteinG} color={theme.protein} />
        <MacroBar label="Carbs" value={totals.carbs} target={targets?.carbsG} color={theme.carbs} />
        <MacroBar label="Fat" value={totals.fat} target={targets?.fatG} color={theme.fat} />
      </View>
    </View>
  );
}

function MacroBar({
  label,
  value,
  target,
  color,
}: {
  label: string;
  value: number;
  target?: number;
  color: string;
}) {
  const theme = useTheme();
  const percent = target && target > 0 ? Math.min(100, (value / target) * 100) : 0;

  return (
    <View style={styles.bar}>
      <View style={styles.barLabels}>
        <ThemedText type="small">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {Math.round(value)}
          {target ? ` / ${Math.round(target)}` : ''} g
        </ThemedText>
      </View>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.fill, { backgroundColor: color, width: `${percent}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    gap: Spacing.one,
  },
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bars: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  card: {
    borderRadius: 20,
    gap: Spacing.one,
    padding: Spacing.three,
  },
  fill: {
    borderRadius: 999,
    height: '100%',
  },
  headline: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  track: {
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
  },
});
