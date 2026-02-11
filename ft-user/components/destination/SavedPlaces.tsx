import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useTranslation } from "@/lib/i18n";
import { Brand, Colors, FontSize, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useSavedPlaces } from "@/hooks/use-destination-data";

const ICON_MAP: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  home: "home",
  work: "work",
  school: "school",
  gym: "fitness-center",
  default: "bookmark",
};

function getIcon(icon: string | null): keyof typeof MaterialIcons.glyphMap {
  if (!icon) return "bookmark";
  return ICON_MAP[icon.toLowerCase()] ?? "bookmark";
}

interface SavedPlacesProps {
  onSelect: (item: {
    address: string;
    latitude: number;
    longitude: number;
    mainText: string;
  }) => void;
}

export function SavedPlaces({ onSelect }: SavedPlacesProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const { data: places, isLoading } = useSavedPlaces();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Brand.primary} size="small" />
      </View>
    );
  }

  if (!places || places.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          {t("destination.noSaved")}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {places.map((place) => (
        <Pressable
          key={place.id}
          style={[styles.row, { borderBottomColor: colors.border }]}
          onPress={() =>
            onSelect({
              address: place.address,
              latitude: place.latitude,
              longitude: place.longitude,
              mainText: place.name,
            })
          }
        >
          <MaterialIcons
            name={getIcon(place.icon)}
            size={20}
            color={Brand.primary}
          />
          <View style={styles.rowContent}>
            <Text
              style={[styles.rowTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {place.name}
            </Text>
            <Text
              style={[styles.rowSub, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              {place.address}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    paddingVertical: Spacing.lg,
    alignItems: "center",
  },
  emptyText: {
    fontSize: FontSize.sm,
  },
  list: {},
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: FontSize.sm,
    fontWeight: "500",
  },
  rowSub: {
    fontSize: FontSize.xs,
    marginTop: 1,
  },
});
