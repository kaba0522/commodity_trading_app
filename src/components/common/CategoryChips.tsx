import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ChevronIcon } from "@/components/common/ChevronIcon";
import { colors } from "@/theme/colors";

interface CategoryChipsProps<T extends string> {
  values: readonly T[];
  value: T;
  onChange: (value: T) => void;
}

/** Horizontal category chips (All + CATEGORIES), ported from both prototypes. */
export function CategoryChips<T extends string>({ values, value, onChange }: CategoryChipsProps<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const [scrollMetrics, setScrollMetrics] = useState({
    contentWidth: 0,
    viewportWidth: 0,
    offset: 0,
  });
  const updateScrollOffset = () => {
    setScrollMetrics((metrics) => ({
      ...metrics,
      offset: scrollOffset.current,
    }));
  };
  const canScrollMore =
    scrollMetrics.contentWidth - 36 > scrollMetrics.viewportWidth - 32 &&
    scrollMetrics.offset <
      scrollMetrics.contentWidth - scrollMetrics.viewportWidth - 1;

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.row}
        onLayout={(event) =>
          setScrollMetrics((metrics) => ({
            ...metrics,
            viewportWidth: event.nativeEvent.layout.width,
          }))
        }
        onContentSizeChange={(contentWidth) =>
          setScrollMetrics((metrics) => ({ ...metrics, contentWidth }))
        }
        onScroll={(event) => {
          scrollOffset.current = event.nativeEvent.contentOffset.x;
        }}
        onScrollEndDrag={updateScrollOffset}
        onMomentumScrollEnd={updateScrollOffset}
        scrollEventThrottle={16}
      >
        {values.map((c) => {
          const active = c === value;
          return (
            <Pressable
              key={c}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onChange(c)}
              accessibilityRole="button"
              accessibilityLabel={c}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.text, active && styles.textActive]}>{c}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {canScrollMore ? (
        <Pressable
          style={styles.moreButton}
          onPress={() =>
            scrollRef.current?.scrollTo({
              x: Math.min(
                scrollMetrics.offset + scrollMetrics.viewportWidth * 0.7,
                scrollMetrics.contentWidth - scrollMetrics.viewportWidth,
              ),
              animated: true,
            })
          }
          accessibilityRole="button"
          accessibilityLabel="Scroll right to see more categories"
        >
          <ChevronIcon color={colors.primary} size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingBottom: 4,
    paddingRight: 36,
  },
  moreButton: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 4,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  chip: {
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.primaryTint,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
    backgroundColor: colors.primaryTint,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
  },
  textActive: {
    color: colors.onPrimary,
  },
});
