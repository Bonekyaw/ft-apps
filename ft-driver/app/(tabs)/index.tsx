import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import * as Location from "expo-location";
import OnlineToggle from "@/components/driver/OnlineToggle";
import RideRequestModal from "@/components/driver/RideRequestModal";
import ActiveRideCard from "@/components/driver/ActiveRideCard";
import { useRideStore } from "@/lib/ride-store";
import { useDriverStatusStore } from "@/lib/driver-status-store";
import { addLocationListener, type DriverCoords } from "@/lib/location-tracker";
import { Brand } from "@/constants/theme";

// Pre-require the car icon once (avoids re-resolve on every render)
const CAR_ICON = require("@/assets/images/car-icon.png") as number;
const CAR_SIZE = 56;

const YANGON_FALLBACK = {
  latitude: 16.7808628,
  longitude: 96.1998973,
  latitudeDelta: 0.005,
  longitudeDelta: 0.005,
};

// ── Car Marker (memoized — only re-renders when coords/heading change) ──
const CarMarker = memo(function CarMarker({
  latitude,
  longitude,
  heading,
}: DriverCoords) {
  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      flat
      rotation={heading ?? 0}
      tracksViewChanges={false}
    >
      <Image source={CAR_ICON} style={carStyles.icon} resizeMode="contain" />
    </Marker>
  );
});

// ── Pickup Marker (memoized — static position, never needs view changes) ──
const PickupMarker = memo(function PickupMarker({
  latitude,
  longitude,
  title,
}: {
  latitude: number;
  longitude: number;
  title: string;
}) {
  return (
    <Marker
      coordinate={{ latitude, longitude }}
      title={title}
      pinColor={Brand.success}
      tracksViewChanges={false}
    />
  );
});

export default function DriverHomeScreen() {
  const [region, setRegion] = useState(YANGON_FALLBACK);
  const [locationReady, setLocationReady] = useState(false);
  const [driverCoords, setDriverCoords] = useState<DriverCoords | null>(null);
  const incomingRequest = useRideStore((s) => s.incomingRequest);
  const activeRide = useRideStore((s) => s.activeRide);
  const isOnline = useDriverStatusStore((s) => s.isOnline);
  const mapRef = useRef<MapView>(null);

  // ── Initial location (fast — last known first) ──
  useEffect(() => {
    let cancelled = false;

    const initLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocationReady(true);
          return;
        }

        const last = await Location.getLastKnownPositionAsync();
        if (!cancelled && last) {
          const coords = {
            latitude: last.coords.latitude,
            longitude: last.coords.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          };
          setRegion(coords);
          setDriverCoords({
            latitude: last.coords.latitude,
            longitude: last.coords.longitude,
            heading: last.coords.heading ?? null,
          });
          setLocationReady(true);
          return;
        }

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
          setDriverCoords({
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
            heading: current.coords.heading ?? null,
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

  // ── When going online, immediately seed driverCoords if missing ──
  useEffect(() => {
    if (!isOnline || driverCoords) return;

    let cancelled = false;
    void (async () => {
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setDriverCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            heading: pos.coords.heading ?? null,
          });
        }
      } catch {
        // GPS unavailable — tracker will fill in when ready
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only trigger when isOnline changes, not on every driverCoords update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // ── Subscribe to live GPS from location tracker (zero extra subscriptions) ──
  useEffect(() => {
    if (!isOnline) return;

    const unsubscribe = addLocationListener(
      // Throttle UI updates to ~500ms to avoid excessive re-renders
      (() => {
        let lastUpdateTs = 0;
        return (coords: DriverCoords) => {
          const now = Date.now();
          if (now - lastUpdateTs < 500) return;
          lastUpdateTs = now;
          setDriverCoords(coords);
        };
      })(),
    );

    return unsubscribe;
  }, [isOnline]);

  // ── Stable callbacks ──
  const onRegionChangeComplete = useCallback(
    (newRegion: typeof region) => setRegion(newRegion),
    [],
  );

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
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={region}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton
        moveOnMarkerPress={false}
        loadingEnabled
      >
        {/* Car icon marker — shown when driver is online with GPS.
            The 56×56 car icon fully covers the native blue dot underneath. */}
        {isOnline && driverCoords ? (
          <CarMarker
            latitude={driverCoords.latitude}
            longitude={driverCoords.longitude}
            heading={driverCoords.heading}
          />
        ) : null}

        {/* Pickup marker — shown when an active ride is set */}
        {activeRide ? (
          <PickupMarker
            latitude={activeRide.pickupLat}
            longitude={activeRide.pickupLng}
            title={activeRide.pickupAddress}
          />
        ) : null}
      </MapView>

      {/* Online toggle — hidden during active ride */}
      {!activeRide ? <OnlineToggle /> : null}

      {/* Active ride bottom card */}
      {activeRide ? <ActiveRideCard ride={activeRide} /> : null}

      {/* Ride request modal overlays everything */}
      {incomingRequest ? (
        <RideRequestModal key={incomingRequest.rideId} request={incomingRequest} />
      ) : null}
    </View>
  );
}

const carStyles = StyleSheet.create({
  icon: {
    width: CAR_SIZE,
    height: CAR_SIZE,
  },
});

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
