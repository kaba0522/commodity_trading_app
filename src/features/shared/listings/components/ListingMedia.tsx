import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

interface ListingMediaProps {
  photoUrls?: string[];
  videoUrls?: string[];
}

function ListingVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);

  return (
    <VideoView
      style={styles.video}
      player={player}
      nativeControls
      contentFit="contain"
      fullscreenOptions={{ enable: true }}
    />
  );
}

export function ListingMedia({
  photoUrls = [],
  videoUrls = [],
}: ListingMediaProps) {
  const { width: screenWidth } = useWindowDimensions();
  const [activePhoto, setActivePhoto] = useState(0);
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);
  if (photoUrls.length === 0 && videoUrls.length === 0) return null;

  const photoWidth = Math.max(
    220,
    screenWidth - spacing.lg * 2 - spacing.md * 2,
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headingGroup}>
          <Text style={styles.title}>Product media</Text>
          <Text style={styles.subtitle}>Photos and sample video</Text>
        </View>
        {photoUrls.length > 0 ? (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>
              {activePhoto + 1} / {photoUrls.length}
            </Text>
          </View>
        ) : null}
      </View>

      {photoUrls.length > 0 ? (
        <>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoList}
            onMomentumScrollEnd={(event) => {
              const nextIndex = Math.round(
                event.nativeEvent.contentOffset.x / photoWidth,
              );
              setActivePhoto(
                Math.max(0, Math.min(nextIndex, photoUrls.length - 1)),
              );
            }}
          >
            {photoUrls.map((uri, index) => (
              <Pressable
                key={`${uri}-${index}`}
                onPress={() => setExpandedPhoto(uri)}
                accessibilityRole="button"
                accessibilityLabel={`View listing photo ${index + 1} full screen`}
              >
                <Image
                  source={{ uri }}
                  style={[styles.photo, { width: photoWidth }]}
                  contentFit="cover"
                  transition={180}
                  accessibilityLabel={`Listing photo ${index + 1}`}
                />
              </Pressable>
            ))}
          </ScrollView>
          {photoUrls.length > 1 ? (
            <View style={styles.pagination} accessibilityLabel="Photo pages">
              {photoUrls.map((uri, index) => (
                <View
                  key={`${uri}-dot-${index}`}
                  style={[
                    styles.dot,
                    index === activePhoto && styles.activeDot,
                  ]}
                />
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {videoUrls.map((uri, index) => (
        <View key={`${uri}-${index}`} style={styles.videoSection}>
          <View style={styles.videoHeading}>
            <View style={styles.videoBadge}>
              <Text style={styles.videoBadgeText}>VIDEO</Text>
            </View>
            <Text style={styles.videoCaption}>Sample of this product</Text>
          </View>
          <ListingVideo uri={uri} />
        </View>
      ))}

      <Modal
        visible={expandedPhoto !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setExpandedPhoto(null)}
        statusBarTranslucent
      >
        <View style={styles.lightbox}>
          <Pressable
            style={styles.closeButton}
            onPress={() => setExpandedPhoto(null)}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>
          {expandedPhoto ? (
            <Image
              source={{ uri: expandedPhoto }}
              style={styles.expandedPhoto}
              contentFit="contain"
              transition={150}
              accessibilityLabel="Expanded listing photo"
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    shadowColor: "#172033",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  headingGroup: {
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.muted,
  },
  countBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    backgroundColor: colors.primaryTint,
  },
  countText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  photoList: {
    alignItems: "center",
  },
  photo: {
    height: 230,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: -spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  activeDot: {
    width: 18,
    backgroundColor: colors.primary,
  },
  videoSection: {
    gap: spacing.sm,
  },
  videoHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  videoBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: colors.primaryTint,
  },
  videoBadgeText: {
    color: colors.primaryDark,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  videoCaption: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  video: {
    width: "100%",
    height: 210,
    borderRadius: 14,
    backgroundColor: "#000000",
    overflow: "hidden",
  },
  lightbox: {
    flex: 1,
    backgroundColor: "rgba(10, 13, 20, 0.96)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
  },
  expandedPhoto: {
    width: "100%",
    height: "82%",
  },
  closeButton: {
    position: "absolute",
    top: 54,
    right: spacing.lg,
    zIndex: 1,
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  closeText: {
    color: "#FFFFFF",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "400",
  },
});
