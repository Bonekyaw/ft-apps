import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
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
  const { t } = useTranslation();

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
          style={styles.thumbnail}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.thumbnailPlaceholder, { backgroundColor: Brand.primary + "18" }]}>
          <Text style={styles.thumbnailIcon}>📢</Text>
        </View>
      )}

      <View style={styles.content}>
        <Text
          style={[styles.title, { color: colors.text }]}
          numberOfLines={1}
        >
          {announcement.title}
        </Text>

        <Text
          style={[styles.body, { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          {announcement.body}
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

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  thumbnail: {
    width: 88,
    height: 88,
  },
  thumbnailPlaceholder: {
    width: 88,
    height: 88,
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
  },
  body: {
    fontSize: FontSize.xs,
    lineHeight: 16,
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
