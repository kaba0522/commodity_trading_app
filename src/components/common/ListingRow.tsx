import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

interface ListingRowProps {
  title: string;
  subtitle: string;
  price: string;
  /** Small solid tag above the title (e.g. seller category). */
  tag?: string;
  /** Small outline badge under the price (e.g. requirement status). */
  badge?: string;
  /** Accent block on the row's left edge (buyer browse quality label). */
  qualityBadge?: string;
  /** Accent pill under the subtitle (e.g. "Pays in 10-15 days"). */
  pill?: string;
  /** Muted caption under the price (e.g. "target"). */
  priceCaption?: string;
  onPress?: () => void;
}

/**
 * Shared commodity row — one component for buyer + seller
 * (parameterized, never duplicated per role).
 */
export function ListingRow({ title, subtitle, price, tag, badge, qualityBadge, pill, priceCaption, onPress }: ListingRowProps) {
  return (
    <Pressable
      style={[styles.card, qualityBadge ? styles.cardFlush : null]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
    >
      {qualityBadge ? (
        <View style={styles.qualityBlock}>
          <Text style={styles.qualityText} numberOfLines={2}>
            {qualityBadge}
          </Text>
        </View>
      ) : null}
      <View style={[styles.main, qualityBadge ? styles.mainPadded : null]}>
        {tag ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ) : null}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
        {pill ? (
          <View style={styles.pill}>
            <Text style={styles.pillText}>{pill}</Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.side, qualityBadge ? styles.sidePadded : null]}>
        <Text style={styles.price}>{price}</Text>
        {priceCaption ? <Text style={styles.priceCaption}>{priceCaption}</Text> : null}
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    overflow: "hidden",
  },
  /** Quality-badge rows are flush (badge block fills the left edge). */
  cardFlush: {
    padding: 0,
    gap: 0,
    alignItems: "stretch",
  },
  qualityBlock: {
    width: 88,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 10,
    backgroundColor: colors.primaryTint,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  qualityText: {
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    color: colors.primaryDark,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  mainPadded: {
    paddingVertical: spacing.md,
    paddingRight: 0,
    paddingLeft: spacing.md,
  },
  tag: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 2,
  },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: colors.primaryTint,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 1,
    marginTop: 3,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  side: {
    alignItems: "flex-end",
    flexShrink: 0,
  },
  sidePadded: {
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
  },
  price: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  priceCaption: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 2,
  },
  badge: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.muted,
  },
});
