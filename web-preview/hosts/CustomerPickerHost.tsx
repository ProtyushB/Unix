import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CustomerPickerSheet } from '../../src/screens/owner/shared/customer/CustomerPickerSheet';
import type { CustomerOption } from '../../src/screens/owner/shared/customer/customerPicker.model';
import { getSelectedBusinessId } from '../../src/backend/modules/shared/hook/useModuleService';

/**
 * A preview harness for `CustomerPickerSheet`, which is a Modal and therefore has nothing to mount
 * onto in the gallery.
 *
 * Lives in web-preview rather than src because it exists only for the gallery — the three detail
 * screens are the real callers, and each mounts the sheet itself. It resolves the selected business
 * the same way a real screen does, so the list it shows is the live one.
 */
export function CustomerPickerHost() {
  const [open, setOpen] = useState(true);
  const [businessId, setBusinessId] = useState<number | null>(null);
  const [picked, setPicked] = useState<CustomerOption | null>(null);

  useEffect(() => {
    let alive = true;
    void getSelectedBusinessId().then((id) => {
      if (alive) setBusinessId(id);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Customer picker harness</Text>
      <Text style={styles.line}>businessId: {businessId ?? 'resolving…'}</Text>
      <Text style={styles.line}>
        picked: {picked ? `#${picked.id} ${picked.name} (${picked.phone || 'no phone'})` : '—'}
      </Text>
      <Pressable style={styles.button} onPress={() => setOpen(true)}>
        <Text style={styles.buttonText}>Open picker</Text>
      </Pressable>

      <CustomerPickerSheet
        visible={open}
        businessId={businessId}
        onClose={() => setOpen(false)}
        onSelect={setPicked}
      />
    </View>
  );
}

export default CustomerPickerHost;

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, gap: 10, justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#111' },
  line: { fontSize: 13, color: '#555' },
  button: {
    marginTop: 12,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
  },
  buttonText: { color: '#fff', fontWeight: '700' },
});
