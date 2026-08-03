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
  const toIso = (d?: Date) => {
    if (!d || isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  };
  return (
    <input
      type={props.mode === 'time' ? 'time' : 'date'}
      defaultValue={toIso(props.value)}
      style={{ margin: 8, padding: '8px 10px', fontSize: 14, borderRadius: 8 }}
      onChange={(e) => {
        const v = e.target.value ? new Date(e.target.value) : undefined;
        props.onChange?.({ type: 'set', nativeEvent: {} }, v);
      }}
    />
  );
}
