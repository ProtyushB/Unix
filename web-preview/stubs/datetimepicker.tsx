import React from 'react';

// Web stub for `@react-native-community/datetimepicker` — a native-only module
// that ships untranspiled Flow source (breaks web bundling) and has no browser
// build. We render a real <input type="date"> so date fields stay usable in the
// preview, mapping its change back to the native onChange(event, date) shape.
export type DateTimePickerEvent = {
  type: string;
  nativeEvent: { timestamp?: number };
};

export default function DateTimePicker(props: any) {
  /**
   * Local calendar fields, NOT `toISOString()`.
   *
   * `toISOString` converts to UTC first, so a local-midnight 8 Aug becomes `2026-08-07T18:30:00Z`
   * for an IST user and the input renders the PREVIOUS day. This stub used to do exactly that,
   * which made the preview show a date the app had never set and made any date bound look broken.
   */
  const toYmd = (d?: Date) => {
    if (!d || isNaN(d.getTime())) return '';
    const m = d.getMonth() + 1;
    const day = d.getDate();
    return `${d.getFullYear()}-${m < 10 ? `0${m}` : m}-${day < 10 ? `0${day}` : day}`;
  };
  return (
    <input
      type={props.mode === 'time' ? 'time' : 'date'}
      defaultValue={toYmd(props.value)}
      // Forwarded so the preview enforces the same range the native picker does. Without these the
      // browser happily offers dates the app would then reject, and the bounds cannot be verified
      // anywhere but on a device.
      min={props.minimumDate ? toYmd(props.minimumDate) : undefined}
      max={props.maximumDate ? toYmd(props.maximumDate) : undefined}
      style={{ margin: 8, padding: '8px 10px', fontSize: 14, borderRadius: 8 }}
      onChange={(e) => {
        // Parsed from parts — `new Date('2026-08-08')` parses as UTC and lands a day early.
        const [y, mo, d] = (e.target.value || '').split('-').map(Number);
        const v = e.target.value ? new Date(y, mo - 1, d) : undefined;
        props.onChange?.({ type: 'set', nativeEvent: {} }, v);
      }}
    />
  );
}
