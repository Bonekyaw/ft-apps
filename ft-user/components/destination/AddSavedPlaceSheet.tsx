import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useQueryClient } from "@tanstack/react-query";

import { useTranslation } from "@/lib/i18n";
import {
  placesAutocomplete,
  fetchPlaceCoordinates,
  createSavedPlace,
  getErrorMessage,
  type PlacesSuggestion,
} from "@/lib/api";
import {
  Brand,
  Colors,
  FontSize,
  Spacing,
  BorderRadius,
} from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

// ---------------------------------------------------------------------------
// Category presets
// ---------------------------------------------------------------------------

interface CategoryPreset {
  key: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  labelKey: string;
}

const CATEGORIES: CategoryPreset[] = [
  { key: "home", icon: "home", labelKey: "destination.catHome" },
  { key: "work", icon: "work", labelKey: "destination.catWork" },
  { key: "school", icon: "school", labelKey: "destination.catSchool" },
  { key: "gym", icon: "fitness-center", labelKey: "destination.catGym" },
  { key: "other", icon: "bookmark", labelKey: "destination.catOther" },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AddSavedPlaceSheetProps {
  visible: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddSavedPlaceSheet({
  visible,
  onClose,
}: AddSavedPlaceSheetProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const queryClient = useQueryClient();

  // State
  const [selectedCategory, setSelectedCategory] = useState("other");
  const [name, setName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlacesSuggestion[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<TextInput>(null);

  // Reset on close
  useEffect(() => {
    if (!visible) {
      setSelectedCategory("other");
      setName("");
      setSearchQuery("");
      setSuggestions([]);
      setSelectedAddress(null);
      setSelectedCoords(null);
      setError(null);
    }
  }, [visible]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsFetching(true);
    debounceRef.current = setTimeout(() => {
      void placesAutocomplete(trimmed).then(
        (results) => {
          setSuggestions(results);
          setIsFetching(false);
        },
        () => {
          setIsFetching(false);
        },
      );
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  // Select a category preset
  const handleSelectCategory = useCallback(
    (cat: CategoryPreset) => {
      setSelectedCategory(cat.key);
      // Pre-fill name with category label if name is empty or was a previous preset
      const currentPreset = CATEGORIES.find(
        (c) => c.key === selectedCategory,
      );
      if (!name || name === t(currentPreset?.labelKey ?? "")) {
        setName(t(cat.labelKey));
      }
    },
    [name, selectedCategory, t],
  );

  // Select a suggestion
  const handleSelectSuggestion = useCallback(
    async (item: PlacesSuggestion) => {
      Keyboard.dismiss();
      setSearchQuery(item.mainText);
      setSuggestions([]);
      setSelectedAddress(item.description);

      // Pre-fill name if still empty
      if (!name) {
        setName(item.mainText);
      }

      // Resolve coordinates
      if (item.placeId) {
        setIsResolving(true);
        try {
          const coords = await fetchPlaceCoordinates(item.placeId);
          if (coords.latitude != null && coords.longitude != null) {
            setSelectedCoords({
              latitude: coords.latitude,
              longitude: coords.longitude,
            });
            if (coords.address) {
              setSelectedAddress(coords.address);
            }
          }
        } catch {
          // Keep what we have
        } finally {
          setIsResolving(false);
        }
      }
    },
    [name],
  );

  // Save
  const handleSave = useCallback(async () => {
    if (!name.trim() || !selectedAddress || !selectedCoords) return;

    setIsSaving(true);
    setError(null);

    try {
      await createSavedPlace({
        name: name.trim(),
        address: selectedAddress,
        latitude: selectedCoords.latitude,
        longitude: selectedCoords.longitude,
        icon: selectedCategory,
      });
      // Invalidate the saved-places query to refresh the list
      void queryClient.invalidateQueries({ queryKey: ["saved-places"] });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }, [name, selectedAddress, selectedCoords, selectedCategory, queryClient, onClose]);

  const canSave = name.trim().length > 0 && selectedCoords !== null && !isSaving;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} hitSlop={8}>
            <MaterialIcons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t("destination.addSavedPlace")}
          </Text>
          <Pressable onPress={handleSave} disabled={!canSave} hitSlop={8}>
            {isSaving ? (
              <ActivityIndicator size="small" color={Brand.primary} />
            ) : (
              <Text
                style={[
                  styles.saveText,
                  { color: canSave ? Brand.primary : colors.textMuted },
                ]}
              >
                {t("destination.save")}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Category pills — flex-wrap so they flow to the next line */}
        <View style={styles.categoryRow}>
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.key;
            return (
              <Pressable
                key={cat.key}
                onPress={() => handleSelectCategory(cat)}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: isActive
                      ? Brand.primary
                      : colors.inputBackground,
                    borderColor: isActive ? Brand.primary : colors.border,
                  },
                ]}
              >
                <MaterialIcons
                  name={cat.icon}
                  size={16}
                  color={isActive ? Brand.secondary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.categoryText,
                    {
                      color: isActive
                        ? Brand.secondary
                        : colors.textSecondary,
                    },
                  ]}
                >
                  {t(cat.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Name input */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t("destination.placeName")}
          </Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: colors.inputBackground,
                color: colors.text,
                borderColor: colors.inputBorder,
              },
            ]}
            value={name}
            onChangeText={setName}
            placeholder={t("destination.placeNamePlaceholder")}
            placeholderTextColor={colors.inputPlaceholder}
            autoCapitalize="words"
          />
        </View>

        {/* Address search */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t("destination.address")}
          </Text>
          <View
            style={[
              styles.searchRow,
              {
                backgroundColor: colors.inputBackground,
                borderColor: selectedCoords
                  ? Brand.success
                  : colors.inputBorder,
              },
            ]}
          >
            <MaterialIcons
              name={selectedCoords ? "check-circle" : "search"}
              size={20}
              color={selectedCoords ? Brand.success : colors.icon}
            />
            <TextInput
              ref={searchInputRef}
              style={[styles.searchInput, { color: colors.text }]}
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                // Clear selected coords when user edits the search
                if (selectedCoords) {
                  setSelectedCoords(null);
                  setSelectedAddress(null);
                }
              }}
              placeholder={t("destination.searchPlaceholder")}
              placeholderTextColor={colors.inputPlaceholder}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {(isFetching || isResolving) && (
              <ActivityIndicator size="small" color={Brand.primary} />
            )}
          </View>
        </View>

        {/* Selected address preview */}
        {selectedAddress && selectedCoords && (
          <View
            style={[
              styles.selectedPreview,
              { backgroundColor: colors.backgroundSecondary },
            ]}
          >
            <MaterialIcons name="place" size={18} color={Brand.primary} />
            <Text
              style={[styles.selectedText, { color: colors.text }]}
              numberOfLines={2}
            >
              {selectedAddress}
            </Text>
          </View>
        )}

        {/* Error */}
        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        {/* Suggestions list */}
        {suggestions.length > 0 && (
          <FlatList
            data={suggestions}
            keyExtractor={(item, i) => item.placeId ?? `s-${i}`}
            keyboardShouldPersistTaps="handled"
            style={styles.suggestionList}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.suggestionRow,
                  { borderBottomColor: colors.border },
                ]}
                onPress={() => void handleSelectSuggestion(item)}
              >
                <MaterialIcons name="place" size={20} color={colors.icon} />
                <View style={styles.suggestionContent}>
                  <Text
                    style={[styles.suggestionMain, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {item.mainText}
                  </Text>
                  {item.secondaryText ? (
                    <Text
                      style={[
                        styles.suggestionSub,
                        { color: colors.textMuted },
                      ]}
                      numberOfLines={1}
                    >
                      {item.secondaryText}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            )}
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: "600",
  },
  saveText: {
    fontSize: FontSize.md,
    fontWeight: "700",
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: FontSize.xs,
    fontWeight: "600",
  },
  field: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  textInput: {
    height: 46,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm + 4,
    fontSize: FontSize.sm,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 46,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    paddingVertical: 0,
  },
  selectedPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  selectedText: {
    flex: 1,
    fontSize: FontSize.xs,
    lineHeight: 18,
  },
  errorText: {
    color: "#EF4444",
    fontSize: FontSize.xs,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  suggestionList: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionContent: {
    flex: 1,
    minWidth: 0,
  },
  suggestionMain: {
    fontSize: FontSize.sm,
    fontWeight: "500",
  },
  suggestionSub: {
    fontSize: FontSize.xs,
    marginTop: 1,
  },
});
