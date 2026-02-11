import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Switch,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useTranslation } from "@/lib/i18n";
import { Brand, Colors, FontSize, Spacing, BorderRadius } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  useRideBookingStore,
  type VehicleFilter,
  type FuelFilter,
} from "@/store/ride-booking";

// ---------------------------------------------------------------------------
// Chip component
// ---------------------------------------------------------------------------

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function Chip({ label, selected, onPress }: ChipProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: Brand.primary, borderColor: Brand.primary }
          : { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: selected ? Brand.secondary : colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// FilterChips
// ---------------------------------------------------------------------------

export function FilterChips() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const vehicleType = useRideBookingStore((s) => s.vehicleType);
  const petFriendly = useRideBookingStore((s) => s.petFriendly);
  const fuelPreference = useRideBookingStore((s) => s.fuelPreference);
  const setVehicleType = useRideBookingStore((s) => s.setVehicleType);
  const togglePetFriendly = useRideBookingStore((s) => s.togglePetFriendly);
  const setFuelPreference = useRideBookingStore((s) => s.setFuelPreference);

  const vehicleOptions: { key: VehicleFilter; label: string }[] = [
    { key: "ANY", label: t("destination.vehicleAny") },
    { key: "STANDARD", label: t("destination.vehicleStandard") },
    { key: "PLUS", label: t("destination.vehiclePlus") },
  ];

  const fuelOptions: { key: FuelFilter; label: string }[] = [
    { key: "ANY", label: t("destination.fuelAny") },
    { key: "CNG", label: t("destination.fuelCNG") },
    { key: "PETROL", label: t("destination.fuelPetrol") },
  ];

  return (
    <View style={styles.container}>
      {/* Section title */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        <MaterialIcons name="tune" size={14} color={colors.textSecondary} />{" "}
        {t("destination.filters")}
      </Text>

      {/* Vehicle type */}
      <Text style={[styles.label, { color: colors.text }]}>
        {t("destination.vehicleType")}
      </Text>
      <View style={styles.chipRow}>
        {vehicleOptions.map((opt) => (
          <Chip
            key={opt.key}
            label={opt.label}
            selected={vehicleType === opt.key}
            onPress={() => setVehicleType(opt.key)}
          />
        ))}
      </View>

      {/* Fuel preference */}
      <Text style={[styles.label, { color: colors.text }]}>
        {t("destination.fuelPreference")}
      </Text>
      <View style={styles.chipRow}>
        {fuelOptions.map((opt) => (
          <Chip
            key={opt.key}
            label={opt.label}
            selected={fuelPreference === opt.key}
            onPress={() => setFuelPreference(opt.key)}
          />
        ))}
      </View>

      {/* Pet friendly toggle */}
      <View style={styles.toggleRow}>
        <MaterialIcons name="pets" size={18} color={colors.icon} />
        <Text style={[styles.toggleLabel, { color: colors.text }]}>
          {t("destination.petFriendly")}
        </Text>
        <Switch
          value={petFriendly}
          onValueChange={togglePetFriendly}
          trackColor={{ false: colors.border, true: Brand.primary }}
          thumbColor="#fff"
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: "500",
    marginTop: Spacing.xs,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: FontSize.xs,
    fontWeight: "500",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  toggleLabel: {
    flex: 1,
    fontSize: FontSize.sm,
  },
});
