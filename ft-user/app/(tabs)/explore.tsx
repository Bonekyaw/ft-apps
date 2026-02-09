import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";

import { PlacesSearchBar } from "@/components/PlacesSearchBar";
import type { PlacesSuggestion } from "@/lib/api";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TabTwoScreen() {
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled || status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (cancelled) return;
      setLocation({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectPlace = (suggestion: PlacesSuggestion) => {
    console.log("Selected place:", suggestion.description, suggestion.placeId);
  };

  return (
    <SafeAreaView style={styles.page}>
      <PlacesSearchBar
        placeholder="Search for a place or address"
        onSelectPlace={handleSelectPlace}
        location={location ?? undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  headerImage: {
    color: "#808080",
    bottom: -90,
    left: -35,
    position: "absolute",
  },
  titleContainer: {
    flexDirection: "row",
    gap: 8,
  },
});
