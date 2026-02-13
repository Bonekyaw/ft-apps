import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useTranslation } from "@/lib/i18n";
import { Brand, Colors, FontSize, Spacing, BorderRadius } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useSavedPlaces } from "@/hooks/use-destination-data";
import { AddSavedPlaceSheet } from "./AddSavedPlaceSheet";

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

/**
 * Horizontal scrollable row of saved-place chips.
 * First chip is always "+ Add Place". Each chip selects the place as destination.
 */
export function SavedPlaces({ onSelect }: SavedPlacesProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const { data: places, isLoading } = useSavedPlaces();
  const [sheetVisible, setSheetVisible] = useState(false);

  return (
    <View style={styles.container}>
      {/* Section label */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
        {t("destination.savedPlaces")}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* "+ Add Place" chip — always first */}
        <Pressable
          style={[styles.chip, styles.addChip, { borderColor: Brand.primary }]}
          onPress={() => setSheetVisible(true)}
        >
          <MaterialIcons name="add" size={16} color={Brand.primary} />
          <Text style={[styles.chipText, { color: Brand.primary }]}>
            {t("destination.addPlace")}
          </Text>
        </Pressable>

        {isLoading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={Brand.primary} size="small" />
          </View>
        )}

        {places?.map((place) => (
          <Pressable
            key={place.id}
            style={[styles.chip, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
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
              size={16}
              color={Brand.primary}
            />
            <Text
              style={[styles.chipText, { color: colors.text }]}
              numberOfLines={1}
            >
              {place.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Add Saved Place modal */}
      <AddSavedPlaceSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: Spacing.sm,
  },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  addChip: {
    backgroundColor: "transparent",
    borderStyle: "dashed",
  },
  chipText: {
    fontSize: FontSize.sm,
    fontWeight: "500",
    maxWidth: 120,
  },
  loadingWrap: {
    paddingHorizontal: Spacing.md,
    justifyContent: "center",
  },
});
