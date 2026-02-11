import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useTranslation } from "@/lib/i18n";
import { Brand, Colors, FontSize, Spacing, BorderRadius } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  useRideBookingStore,
  MAX_STOPS,
  type StopLocation,
} from "@/store/ride-booking";

interface StopListInputProps {
  /** Called when user taps a stop row to start searching. */
  onPressStop: (index: number) => void;
  /** Called when user taps the "Pin on map" icon for a stop. */
  onPinOnMap: (index: number) => void;
}

export function StopListInput({ onPressStop, onPinOnMap }: StopListInputProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const stops = useRideBookingStore((s) => s.stops);
  const activeStopIndex = useRideBookingStore((s) => s.activeStopIndex);
  const addStop = useRideBookingStore((s) => s.addStop);
  const removeStop = useRideBookingStore((s) => s.removeStop);

  const canAddMore = stops.length < MAX_STOPS;

  return (
    <View style={styles.container}>
      {/* Timeline rail on the left */}
      <View style={styles.rail}>
        {stops.map((_, i) => (
          <React.Fragment key={`dot-${i}`}>
            <View
              style={[
                styles.dot,
                i === 0 && styles.dotFirst,
                i === stops.length - 1 && styles.dotLast,
                { borderColor: i === 0 ? Brand.primary : colors.icon },
              ]}
            />
            {i < stops.length - 1 && (
              <View style={[styles.line, { backgroundColor: colors.border }]} />
            )}
          </React.Fragment>
        ))}
      </View>

      {/* Stop rows */}
      <View style={styles.rows}>
        {stops.map((stop, index) => {
          const isActive = index === activeStopIndex;
          const label =
            stops.length === 1
              ? t("destination.destination")
              : t("destination.stop", { number: String(index + 1) });

          return (
            <View key={`stop-${index}`} style={styles.rowWrapper}>
              <Pressable
                onPress={() => onPressStop(index)}
                style={[
                  styles.row,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: isActive ? Brand.primary : colors.inputBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.rowText,
                    stop
                      ? { color: colors.text }
                      : { color: colors.inputPlaceholder },
                  ]}
                  numberOfLines={1}
                >
                  {stop?.mainText ?? stop?.address ?? label}
                </Text>
              </Pressable>

              {/* Pin on map icon */}
              <Pressable
                onPress={() => onPinOnMap(index)}
                style={styles.pinBtn}
                hitSlop={8}
              >
                <MaterialIcons
                  name="pin-drop"
                  size={20}
                  color={colors.icon}
                />
              </Pressable>

              {/* Remove stop (only when > 1 stop) */}
              {stops.length > 1 && (
                <Pressable
                  onPress={() => removeStop(index)}
                  style={styles.removeBtn}
                  hitSlop={8}
                >
                  <MaterialIcons name="close" size={18} color={Brand.error} />
                </Pressable>
              )}
            </View>
          );
        })}

        {/* Add stop button */}
        {canAddMore && (
          <Pressable
            onPress={addStop}
            style={[styles.addBtn, { borderColor: colors.border }]}
          >
            <MaterialIcons name="add" size={18} color={Brand.primary} />
            <Text style={[styles.addText, { color: Brand.primary }]}>
              {t("destination.addStop")}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

const DOT_SIZE = 12;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
  },

  // Left rail
  rail: {
    width: 24,
    alignItems: "center",
    paddingTop: 18, // center on first row
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  dotFirst: {
    backgroundColor: Brand.primary,
    borderColor: Brand.primary,
  },
  dotLast: {},
  line: {
    width: 2,
    flex: 1,
    minHeight: 20,
  },

  // Right rows
  rows: {
    flex: 1,
    gap: Spacing.sm,
  },
  rowWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 46,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.sm,
  },
  rowText: {
    flex: 1,
    fontSize: FontSize.sm,
  },
  pinBtn: {
    padding: Spacing.xs,
  },
  removeBtn: {
    padding: Spacing.xs,
  },

  // Add stop
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: BorderRadius.sm,
  },
  addText: {
    fontSize: FontSize.sm,
    fontWeight: "500",
  },
});
