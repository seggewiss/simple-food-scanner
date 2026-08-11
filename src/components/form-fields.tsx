/**
 * Native form controls, wrapped once so the rest of the app never has to think about
 * `@expo/ui`'s platform differences.
 *
 * These render real SwiftUI views on iOS and Jetpack Compose views on Android rather
 * than a hand-drawn approximation, which is the point: a date of birth belongs in the
 * OS date picker, not in a free-text field that has to explain its own format.
 */

import { Host, Picker, Slider } from '@expo/ui';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { SegmentedControl } from '@expo/ui/community/segmented-control';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { parseIsoDate, todayIso } from '@/lib/date';

/** Label, control and optional hint, stacked. The shared shape of every field below. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      {children}
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** A group of fields under a heading, with a line explaining what the group is for. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">{title.toUpperCase()}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {description}
      </ThemedText>
      {children}
    </View>
  );
}

/**
 * Native segmented control for a short, fixed set of options.
 *
 * The native view speaks in indices, so this maps a typed option array on and off it.
 */
export function SegmentedField<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
  labelFor,
}: {
  label: string;
  hint?: string;
  options: readonly T[];
  value: T;
  onChange: (option: T) => void;
  labelFor: (option: T) => string;
}) {
  const theme = useTheme();

  return (
    <Field label={label} hint={hint}>
      <SegmentedControl
        values={options.map(labelFor)}
        selectedIndex={options.indexOf(value)}
        tintColor={theme.accent}
        onChange={({ nativeEvent }) => {
          const next = options[nativeEvent.selectedSegmentIndex];
          if (next !== undefined) onChange(next);
        }}
        style={styles.segmented}
      />
    </Field>
  );
}

/** Native dropdown menu, for option sets too long to fit in a segmented control. */
export function PickerField<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
  labelFor,
}: {
  label: string;
  hint?: string;
  options: readonly T[];
  value: T;
  onChange: (option: T) => void;
  labelFor: (option: T) => string;
}) {
  return (
    <Field label={label} hint={hint}>
      <Host matchContents>
        <Picker
          selectedValue={value}
          appearance="menu"
          onValueChange={(next) => onChange(next as T)}>
          {options.map((option) => (
            <Picker.Item key={option} label={labelFor(option)} value={option} />
          ))}
        </Picker>
      </Host>
    </Field>
  );
}

/** Native slider for a continuous value, with the current value shown beside the label. */
export function SliderField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.sliderHeader}>
        <ThemedText type="smallBold">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {format(value)}
        </ThemedText>
      </View>
      <Host matchContents>
        <Slider value={value} min={min} max={max} step={step} onValueChange={onChange} />
      </Host>
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

/**
 * Native date picker, bridged to the `YYYY-MM-DD` strings the database stores.
 *
 * The platforms disagree about presentation, and the component is honest about it:
 * on Android `presentation="dialog"` opens the moment the picker mounts, so it is only
 * mounted while `open` is true and is torn down again on both confirm and cancel. iOS
 * ignores `presentation` entirely and always renders inline, so `display="compact"`
 * gives it the tappable pill that matches the rest of the form.
 */
export function DateField({
  label,
  hint,
  value,
  onChange,
  minimumDate,
  maximumDate,
}: {
  label: string;
  hint?: string;
  /** `YYYY-MM-DD`. */
  value: string;
  onChange: (iso: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const date = parseIsoDate(value);

  if (Platform.OS === 'ios') {
    return (
      <Field label={label} hint={hint}>
        <DateTimePicker
          value={date}
          mode="date"
          display="compact"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          accentColor={theme.accent}
          onValueChange={(_event, next) => onChange(todayIso(next))}
          style={styles.iosDatePicker}
        />
      </Field>
    );
  }

  return (
    <Field label={label} hint={hint}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={[
          styles.input,
          { borderColor: theme.border, backgroundColor: theme.backgroundElement },
        ]}>
        <ThemedText>{formatDate(date)}</ThemedText>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={date}
          mode="date"
          presentation="dialog"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          accentColor={theme.accent}
          onValueChange={(_event, next) => {
            setOpen(false);
            onChange(todayIso(next));
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </Field>
  );
}

/**
 * Numeric text entry with a unit suffix.
 *
 * Deliberately still a React Native `TextInput`: there is no native "number field" on
 * either platform, and `decimal-pad` already brings up the OS numeric keyboard.
 */
export function NumberField({
  label,
  hint,
  error,
  value,
  onChangeText,
  unit,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  value: string;
  onChangeText: (value: string) => void;
  unit: string;
}) {
  const theme = useTheme();

  return (
    <Field label={label} hint={hint} error={error}>
      <View
        style={[
          styles.input,
          styles.inputRow,
          {
            borderColor: error ? theme.danger : theme.border,
            backgroundColor: theme.backgroundElement,
          },
        ]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          inputMode="decimal"
          selectTextOnFocus
          style={[styles.inputText, { color: theme.text }]}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {unit}
        </ThemedText>
      </View>
    </Field>
  );
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  inputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    // Android's default input padding would make the row taller than the other fields.
    paddingVertical: 0,
  },
  iosDatePicker: {
    alignSelf: 'flex-start',
  },
  section: {
    gap: Spacing.two,
  },
  segmented: {
    minHeight: 36,
  },
  sliderHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
