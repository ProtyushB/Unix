import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Image,
  FlatList,
  TouchableOpacity,
  Modal,
  Dimensions,
  StyleSheet,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface GalleryImage {
  uri: string;
}

interface ImageGalleryProps {
  images: GalleryImage[];
  onAddImage?: () => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMBNAIL_SIZE = SCREEN_WIDTH - 64;

// ─── Component ──────────────────────────────────────────────────────────────

export function ImageGallery({ images, onAddImage }: ImageGalleryProps) {
  const styles = useThemedStyles(createStyles);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / THUMBNAIL_SIZE);
      setActiveIndex(index);
    },
    [],
  );

  const openViewer = useCallback((index: number) => {
    setViewerIndex(index);
    setViewerVisible(true);
  }, []);

  const closeViewer = useCallback(() => {
    setViewerVisible(false);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: GalleryImage; index: number }) => (
      <TouchableOpacity
        onPress={() => openViewer(index)}
        activeOpacity={0.85}
      >
        <Image source={{ uri: item.uri }} style={styles.thumbnail} />
      </TouchableOpacity>
    ),
    [openViewer, styles.thumbnail],
  );

  const renderViewerItem = useCallback(
    ({ item }: { item: GalleryImage }) => (
      <View style={styles.viewerImageContainer}>
        <Image
          source={{ uri: item.uri }}
          style={styles.viewerImage}
          resizeMode="contain"
        />
      </View>
    ),
    [styles.viewerImageContainer, styles.viewerImage],
  );

  return (
    <View style={styles.container}>
      {/* Horizontal gallery */}
      <View style={styles.galleryRow}>
        <FlatList
          ref={flatListRef}
          data={images}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          snapToInterval={THUMBNAIL_SIZE}
          decelerationRate="fast"
          contentContainerStyle={styles.listContent}
        />

        {onAddImage ? (
          <TouchableOpacity
            onPress={onAddImage}
            style={styles.addBtn}
            activeOpacity={0.7}
          >
            <Plus size={22} color="#ffffff" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Dot indicators */}
      {images.length > 1 ? (
        <View style={styles.dots}>
          {images.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      ) : null}

      {/* Full-screen viewer */}
      <Modal
        visible={viewerVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeViewer}
      >
        <View style={styles.viewer}>
          <TouchableOpacity
            onPress={closeViewer}
            style={styles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={24} color="#ffffff" />
          </TouchableOpacity>

          <FlatList
            data={images}
            keyExtractor={(_, i) => `viewer-${i}`}
            renderItem={renderViewerItem}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={viewerIndex}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
          />
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      marginBottom: 16,
    },
    galleryRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    listContent: {
      gap: 0,
    },
    thumbnail: {
      width: THUMBNAIL_SIZE,
      height: THUMBNAIL_SIZE * 0.6,
      borderRadius: 14,
      backgroundColor: theme.palette.divider,
    },
    addBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 12,
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 10,
      gap: 6,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    dotActive: {
      backgroundColor: theme.colors.primary,
    },
    dotInactive: {
      backgroundColor: theme.palette.divider,
    },
    viewer: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      justifyContent: 'center',
    },
    closeBtn: {
      position: 'absolute',
      top: 50,
      right: 20,
      zIndex: 10,
      padding: 8,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      borderRadius: 20,
    },
    viewerImageContainer: {
      width: SCREEN_WIDTH,
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewerImage: {
      width: SCREEN_WIDTH,
      height: SCREEN_WIDTH,
    },
  });
}
