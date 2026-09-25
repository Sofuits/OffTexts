import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, TextInput, View, type ViewStyle } from 'react-native';

import { AppText } from '@/presentation/components/common/AppText';
import { useTheme } from '@/presentation/hooks/useTheme';
import { ageOn } from '@/domain/usecases';

export type DateOfBirthFieldProps = {
  /** An ISO date (`YYYY-MM-DD`), or null while incomplete. */
  value: string | null;
  /** Called with a valid ISO date, or null the moment it stops being one. */
  onChange: (isoDate: string | null) => void;
  /** Refuse anything younger than this. */
  minimumAge: number;
  style?: ViewStyle;
};

/**
 * Day, month and year as three short boxes.
 *
 * WHY NOT A DATE PICKER
 * A spinner or a calendar starts at today and expects somebody born in 1994 to
 * scroll back three hundred and eighty months. Typing eight digits takes about
 * four seconds; the same on a wheel takes half a minute and is the step people
 * abandon. Every app that asks for a birthday rather than a date ends up here.
 *
 * WHAT IT REFUSES
 * Not just "is it eighteen years ago". It rejects a date that does not exist —
 * 31 February, 30 February in a leap year — by round-tripping through `Date`
 * and checking the parts came back unchanged. `new Date(2026, 1, 31)` silently
 * becomes 3 March, and without this check that is what would be stored.
 */
export function DateOfBirthField({
  value,
  onChange,
  minimumAge,
  style,
}: DateOfBirthFieldProps): React.JSX.Element {
  const theme = useTheme();

  const initial = useMemo(() => splitIso(value), [value]);
  const [day, setDay] = useState(initial.day);
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);

  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  // Which box has the caret. A phone draws no focus ring of its own, so without
  // this the member gets no feedback about which of three identical boxes their
  // keystrokes are going into — which matters most here, because the field
  // jumps between them on its own.
  const [focused, setFocused] = useState<'day' | 'month' | 'year' | null>(null);

  const parsed = useMemo(() => parse(day, month, year), [day, month, year]);
  const age = parsed ? ageOn(parsed, new Date()) : null;

  const emit = useCallback(
    (d: string, m: string, y: string) => {
      const date = parse(d, m, y);
      if (!date || ageOn(date, new Date()) < minimumAge) {
        onChange(null);
        return;
      }
      onChange(toIso(date));
    },
    [minimumAge, onChange],
  );

  const digitsOnly = (text: string, max: number): string =>
    text.replace(/[^0-9]/g, '').slice(0, max);

  const focusProps = (which: 'day' | 'month' | 'year') => ({
    focused: focused === which,
    onFocus: () => setFocused(which),
    onBlur: () => setFocused((current) => (current === which ? null : current)),
  });

  return (
    <View style={style}>
      <View style={[styles.row, { gap: theme.spacing[12] }]}>
        <DigitBox
          label="Day"
          value={day}
          onChangeText={(text) => {
            const next = digitsOnly(text, 2);
            setDay(next);
            emit(next, month, year);
            // Two digits means this box is finished. Jumping on is what makes
            // eight digits feel like one movement instead of three.
            if (next.length === 2) monthRef.current?.focus();
          }}
          placeholder="DD"
          maxLength={2}
          accessibilityLabel="Day of birth"
          testID="input-dob-day"
          {...focusProps('day')}
        />
        <DigitBox
          label="Month"
          inputRef={monthRef}
          value={month}
          onChangeText={(text) => {
            const next = digitsOnly(text, 2);
            setMonth(next);
            emit(day, next, year);
            if (next.length === 2) yearRef.current?.focus();
          }}
          placeholder="MM"
          maxLength={2}
          accessibilityLabel="Month of birth"
          testID="input-dob-month"
          {...focusProps('month')}
        />
        <DigitBox
          label="Year"
          inputRef={yearRef}
          value={year}
          onChangeText={(text) => {
            const next = digitsOnly(text, 4);
            setYear(next);
            emit(day, month, next);
          }}
          placeholder="YYYY"
          maxLength={4}
          accessibilityLabel="Year of birth"
          testID="input-dob-year"
          wide
          {...focusProps('year')}
        />
      </View>

      {/*
        Feedback only once all eight digits are in. Telling somebody their
        birthday is invalid while they are still typing the year is how a
        working form feels broken.
      */}
      {year.length === 4 && day.length > 0 && month.length > 0 ? (
        <AppText
          variant="caption"
          color={
            parsed === null
              ? 'danger'
              : age !== null && age < minimumAge
                ? 'danger'
                : 'textSecondary'
          }
          style={{ marginTop: theme.spacing[12] }}
          testID="dob-feedback"
        >
          {parsed === null
            ? 'That date does not exist. Check the day and month.'
            : age !== null && age < minimumAge
              ? `You need to be ${minimumAge} or older to use Offtexts.`
              : `You’ll show up as ${age}.`}
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * One of the three boxes. The same field as `TextField` — white, radius `lg`,
 * 52 tall, a hairline edge, and the raised band underneath while it has the
 * caret — so the birthday step does not look like a different form.
 */
function DigitBox({
  label,
  inputRef,
  focused,
  wide = false,
  ...input
}: {
  label: string;
  inputRef?: React.RefObject<TextInput | null>;
  focused: boolean;
  wide?: boolean;
  value: string;
  onChangeText: (text: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  placeholder: string;
  maxLength: number;
  accessibilityLabel: string;
  testID: string;
}): React.JSX.Element {
  const theme = useTheme();
  const band = theme.sizes.fieldFocusBand;

  return (
    <View style={wide ? styles.wide : styles.narrow}>
      <AppText variant="label">{label}</AppText>
      <View style={{ marginTop: theme.spacing[8], paddingBottom: band }}>
        {focused ? (
          <View
            pointerEvents="none"
            style={[
              styles.band,
              { top: band, borderRadius: theme.radii.lg, backgroundColor: theme.colors.border },
            ]}
          />
        ) : null}
        <TextInput
          ref={inputRef}
          keyboardType="number-pad"
          placeholderTextColor={theme.colors.placeholder}
          style={[
            styles.input,
            theme.typography.subheading,
            {
              height: theme.sizes.field,
              paddingHorizontal: theme.spacing[12],
              borderRadius: theme.radii.lg,
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.inset,
              color: theme.colors.textPrimary,
            },
          ]}
          {...input}
        />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ dates -- */

function splitIso(iso: string | null): { day: string; month: string; year: string } {
  if (!iso) return { day: '', month: '', year: '' };
  const [year = '', month = '', day = ''] = iso.split('-');
  return { day, month, year };
}

/**
 * Three strings into a real date, or null.
 *
 * The round-trip check is the part that matters: `new Date(2025, 1, 31)` does
 * not fail, it rolls forward to 3 March. Comparing the parts back out is the
 * only way to tell a date that exists from one that was quietly corrected.
 */
function parse(day: string, month: string, year: string): Date | null {
  if (day.length === 0 || month.length === 0 || year.length !== 4) return null;

  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  // Nobody using this app was born before 1900, and a typo like `0199` should
  // read as a mistake rather than as a 1,827-year-old member.
  if (y < 1900 || y > new Date().getFullYear()) return null;

  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  if (date.getTime() > Date.now()) return null;

  return date;
}

function toIso(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  narrow: { flex: 1 },
  wide: { flex: 1.6 },
  // Above the band on every platform; see TextField.
  input: { width: '100%', textAlign: 'center', position: 'relative', zIndex: 1 },
  band: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
