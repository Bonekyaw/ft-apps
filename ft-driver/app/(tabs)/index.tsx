import React, { useEffect, useState } from "react";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import * as Location from "expo-location";
import OnlineToggle from "@/components/driver/OnlineToggle";
import { Brand } from "@/constants/theme";

const YANGON_FALLBACK = {
  latitude: 16.7808628,
  longitude: 96.1998973,
  latitudeDelta: 0.005,
  longitudeDelta: 0.005,
};

export default function DriverHomeScreen() {
  const [region, setRegion] = useState(YANGON_FALLBACK);
  const [locationReady, setLocationReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const initLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocationReady(true);
          return;
        }

        // Try last-known first for instant display
        const last = await Location.getLastKnownPositionAsync();
        if (!cancelled && last) {
          setRegion({
            latitude: last.coords.latitude,
            longitude: last.coords.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          });
          setLocationReady(true);
          return;
        }

        // Fall back to fresh GPS fix
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setRegion({
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          });
        }
      } finally {
        if (!cancelled) setLocationReady(true);
      }
    };

    void initLocation();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!locationReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Brand.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton
      />
      <OnlineToggle />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: "100%",
    height: "100%",
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
