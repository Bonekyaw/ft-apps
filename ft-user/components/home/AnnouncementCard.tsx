import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  useWindowDimensions,
} from "react-native";

import type { Announcement } from "@/hooks/use-home-data";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "@/lib/i18n";
import {
  Colors,
  Brand,
  BorderRadius,
  FontSize,
  Spacing,
} from "@/constants/theme";

interface AnnouncementCardProps {
  announcement: Announcement;
  onPress?: (announcement: Announcement) => void;
}

export function AnnouncementCard({
  announcement,
  onPress,
}: AnnouncementCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { t, locale } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();

  // Responsive thumbnail: ~22% of screen width, clamped for very large screens
  const thumbSize = Math.min(Math.round(screenWidth * 0.22), 120);

  // Pick the correct language — fallback to English if Myanmar is empty
  const title =
    locale === "my" && announcement.titleMy
      ? announcement.titleMy
      : announcement.title;

  const body =
    locale === "my" && announcement.bodyMy
      ? announcement.bodyMy
      : announcement.body;

  const formattedDate = new Date(announcement.createdAt).toLocaleDateString(
    undefined,
    { month: "short", day: "numeric" },
  );

  return (
    <Pressable
      onPress={() => onPress?.(announcement)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      {announcement.imageUrl ? (
        <Image
          source={{ uri: announcement.imageUrl }}
          style={{ width: thumbSize, minHeight: thumbSize }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            styles.thumbnailPlaceholder,
            {
              width: thumbSize,
              minHeight: thumbSize,
              backgroundColor: Brand.primary + "18",
            },
          ]}
        >
          <Text style={styles.thumbnailIcon}>📢</Text>
        </View>
      )}

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>

        <Text
          style={[styles.body, { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          {body}
        </Text>

        <View style={styles.footer}>
          <Text style={[styles.date, { color: colors.textMuted }]}>
            {formattedDate}
          </Text>
          {announcement.linkUrl && (
            <Text style={[styles.readMore, { color: Brand.primary }]}>
              {t("home.readMore")}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// 1.6 rem — smooth for Myanmar script
const BODY_LINE_HEIGHT = Math.round(FontSize.xs * 1.6);
const TITLE_LINE_HEIGHT = Math.round(FontSize.sm * 2);

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: Spacing.sm,
  },
  thumbnailPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  thumbnailIcon: {
    fontSize: 28,
  },
  content: {
    flex: 1,
    padding: Spacing.sm,
    justifyContent: "center",
    gap: 2,
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    lineHeight: TITLE_LINE_HEIGHT,
    marginBottom: Spacing.xs,
  },
  body: {
    fontSize: FontSize.xs,
    lineHeight: BODY_LINE_HEIGHT,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  date: {
    fontSize: FontSize.xs - 1,
  },
  readMore: {
    fontSize: FontSize.xs,
    fontWeight: "600",
  },
});
