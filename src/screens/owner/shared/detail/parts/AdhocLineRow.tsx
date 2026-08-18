/**
 * One Quick Add (ad-hoc) line.
 *
 * Shared rather than local because it is drawn in two places and must not drift between them: the
 * QUICK ITEMS list inside the Add-items sheet, and the BILLED ITEMS list on the bill itself. Only
 * the meta string differs, and that is the caller's to pass.
 *
 * `editable` follows the same rule every sibling row uses — the ✕ appears on Add and Edit and is
 * absent on View, where nothing is removable.
 */

import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ImageIcon, X } from 'lucide-react-native';

import { useTheme } from '../../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../../hooks/useThemedStyles';
import { FileService } from '../../../../../backend/dms/service/file.service';

import type { AppTheme } from '../../../../../theme/theme.types';
import type { DmsFile, PendingFile } from '../pendingFiles';

/**
 * Built once and reused. Imported by DIRECT PATH rather than through `backend/dms/index.ts`, whose
 * barrel drags in `react-native-fs` via `useDmsImages` and breaks the web preview bundle.
 */
let serviceInstance: FileService | null = null;
function fileService(): FileService {
  if (!serviceInstance) serviceInstance = new FileService();
  return serviceInstance;
}

export interface AdhocLineItem {
  name: string;
  photos?: DmsFile[];
  photo?: PendingFile | null;
}

interface Props {
  item: AdhocLineItem;
  /** "Qty 2 · ₹450 · jar" in the picker, "Quick add · 2 × ₹450 · jar" on the bill. */
  meta: string;
  /** Already formatted — the caller owns the money helper. */
  amount: string;
  editable?: boolean;
  onRemove?: () => void;
}

/**
 * The thumbnail's uri, staged photo first.
 *
 * A freshly picked image has a local `uri` and no `dmsFileId` yet, so it must win: showing the
 * fallback icon for an image the user just chose reads as "it did not take".
 *
 * The saved case resolves through `getResourceUrl`, not the stored `photo.url` — that field holds a
 * folder PATH, which goes stale the moment the item is renamed and the backend moves the folder.
 * The DMS read path is public, so a bare `<Image>` loads it with no auth header; see
 * `useProductImages` for the verification note.
 */
export function adhocThumbUri(item: AdhocLineItem): string | null {
  if (item.photo?.uri) return item.photo.uri;
  const saved = item.photos?.[0]?.dmsFileId;
  return saved != null ? fileService().getResourceUrl(saved) : null;
}

export function AdhocLineRow({ item, meta, amount, editable = false, onRemove }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const uri = adhocThumbUri(item);

  return (
    <View style={styles.row}>
      <View style={styles.thumb}>
        {uri ? (
          <Image source={{ uri }} style={styles.thumbImage} resizeMode="cover" />
        ) : (
          <ImageIcon size={16} color={theme.palette.muted} />
        )}
      </View>

      <View style={styles.mid}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.pill}>
            <Text style={styles.pillLabel}>AD-HOC</Text>
          </View>
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      </View>

      <View style={styles.right}>
        <Text style={styles.amount}>{amount}</Text>
        {editable && onRemove ? (
          <Pressable
            onPress={onRemove}
            style={styles.remove}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.name}`}
          >
            <X size={14} color={theme.palette.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    thumb: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: theme.palette.surfaceElevated,
    },
    thumbImage: { width: '100%', height: '100%' },

    mid: { flex: 1, gap: 3 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    name: { flexShrink: 1, fontSize: 13, fontWeight: '600', color: theme.palette.onSurface },
    pill: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      // 12% of the accent — the same soft tint the summary chips use, spelled here because
      // `colors.softBg` is a flat token and this has to sit on `surface`, not on the background.
      backgroundColor: theme.colors.primary + '1F',
    },
    pillLabel: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.3,
      color: theme.colors.primary,
    },
    meta: { fontSize: 11.5, color: theme.palette.muted },

    right: { alignItems: 'flex-end', gap: 5 },
    amount: { fontSize: 14, fontWeight: '700', color: theme.colors.primary },
    remove: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  });
}
