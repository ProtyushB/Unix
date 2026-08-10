import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { FileText, ImageIcon, Plus, X } from 'lucide-react-native';
import { useTheme } from '../../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../../theme/theme.types';
import {
  RECEIPT_ADD_CTA,
  RECEIPT_EMPTY,
  RECEIPT_PENDING_HINT,
  type ReceiptRow,
} from '../receipts';

/**
 * The receipt attachments on an expense — a compact file list, not a photo stage.
 *
 * Deliberately NOT `ImageStage`. That is a ~477pt 3:4 paging carousel built to frame a product
 * hero, where the photo IS the content and is judged at the size a customer will see it. A receipt
 * is evidence: the user needs to know one is attached, what it is called, and how to open it. It
 * also has to render a PDF, which `ImageStage` cannot — it draws an `<Image>` unconditionally.
 *
 * Not reusing it is also what keeps products and services out of this change entirely.
 *
 * Every string and every branch comes from `receipts.ts`, which is RN-free and tested; this file
 * only draws.
 */

interface Props {
  rows: ReceiptRow[];
  /** Read mode hides the add and remove affordances and leaves the rows tappable. */
  editable?: boolean;
  uploadProgress?: number;
  onAddPhoto?: () => void;
  onAddDocument?: () => void;
  onRemove?: (index: number) => void;
  onOpen?: (row: ReceiptRow) => void;
}

export function ReceiptStrip({
  rows,
  editable = false,
  uploadProgress = 0,
  onAddPhoto,
  onAddDocument,
  onRemove,
  onOpen,
}: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const uploading = uploadProgress > 0 && uploadProgress < 100;

  return (
    <View style={styles.wrap}>
      {rows.length === 0 && !editable ? <Text style={styles.empty}>{RECEIPT_EMPTY}</Text> : null}

      {rows.map((row, index) => (
        <View key={row.key} style={styles.row}>
          <View style={styles.thumb}>
            {/* A photo shows itself; anything else gets a glyph. `isDocument` is decided in
                receipts.ts, which treats "unknown" as a document — a file icon beside a correct
                filename still reads, a broken <Image> does not. */}
            {!row.isDocument && row.url ? (
              <Image source={{ uri: row.url }} style={styles.thumbImage} resizeMode="cover" />
            ) : row.isDocument ? (
              <FileText size={17} color={theme.colors.primary} />
            ) : (
              <ImageIcon size={17} color={theme.colors.primary} />
            )}
          </View>

          <Pressable
            style={styles.body}
            onPress={row.url && onOpen ? () => onOpen(row) : undefined}
            disabled={!row.url || !onOpen}
            accessibilityRole={row.url && onOpen ? 'button' : undefined}
            accessibilityLabel={row.url && onOpen ? `Open ${row.name}` : undefined}
          >
            <Text style={styles.name} numberOfLines={1}>
              {row.name}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {row.pending ? [row.meta, RECEIPT_PENDING_HINT].filter(Boolean).join(' · ') : row.meta}
            </Text>
          </Pressable>

          {editable && onRemove ? (
            <Pressable
              onPress={() => onRemove(index)}
              style={styles.remove}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${row.name}`}
            >
              <X size={15} color={theme.palette.muted} />
            </Pressable>
          ) : row.url && onOpen ? (
            <Pressable
              onPress={() => onOpen(row)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${row.name}`}
            >
              <Text style={styles.view}>View</Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      {uploading ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
        </View>
      ) : null}

      {editable ? (
        <View style={styles.addRow}>
          <Pressable
            onPress={onAddPhoto}
            style={styles.addButton}
            accessibilityRole="button"
            accessibilityLabel="Add a photo"
          >
            <Plus size={15} color={theme.colors.primary} />
            <Text style={styles.addLabel}>Photo</Text>
          </Pressable>
          <Pressable
            onPress={onAddDocument}
            style={styles.addButton}
            accessibilityRole="button"
            accessibilityLabel={RECEIPT_ADD_CTA}
          >
            <FileText size={15} color={theme.colors.primary} />
            <Text style={styles.addLabel}>PDF</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  const { colors, palette } = theme;
  return StyleSheet.create({
    wrap: { gap: 8 },
    empty: { fontSize: 12.5, color: palette.muted },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 10,
      borderRadius: 12,
      backgroundColor: palette.surfaceElevated,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    thumb: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: colors.softBg,
    },
    thumbImage: { width: '100%', height: '100%' },
    body: { flex: 1, gap: 2 },
    name: { fontSize: 13.5, fontWeight: '600', color: palette.onSurface },
    meta: { fontSize: 11.5, color: palette.muted },
    remove: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
    view: { fontSize: 13, fontWeight: '700', color: colors.primary },

    progressTrack: {
      height: 4,
      borderRadius: 2,
      overflow: 'hidden',
      backgroundColor: palette.surfaceElevated,
    },
    progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },

    addRow: { flexDirection: 'row', gap: 8 },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      flex: 1,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.softBg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addLabel: { fontSize: 13, fontWeight: '600', color: colors.primary },
  });
}
