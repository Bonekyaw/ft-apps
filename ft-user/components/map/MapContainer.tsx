
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Alert } from 'react-native';
import * as Location from 'expo-location';
import { Region } from 'react-native-maps';
import { AppMapView, AppMapViewHandle } from './AppMapView';
import { ZoomControls } from './MapControls';

const DEFAULT_LOCATION = {
  latitude: 16.8409,
  longitude: 96.1735,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

// ... driver generator ...
const generateDummyDrivers = (loc: { latitude: number; longitude: number }) => {
  return [
    {
      id: '1',
      coordinate: {
        latitude: loc.latitude + 0.002,
        longitude: loc.longitude + 0.002,
      },
      title: 'Driver John',
      description: 'Toyota Corolla - 4.8★',
    },
    {
      id: '2',
      coordinate: {
        latitude: loc.latitude - 0.003,
        longitude: loc.longitude + 0.001,
      },
      title: 'Driver Sarah',
      description: 'Honda Civic - 4.9★',
    },
    {
      id: '3',
      coordinate: {
        latitude: loc.latitude + 0.001,
        longitude: loc.longitude - 0.003,
      },
      title: 'Driver Mike',
      description: 'Ford Focus - 4.7★',
    },
  ];
};

export const MapContainer: React.FC = () => {
  const mapRef = React.useRef<AppMapViewHandle>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_LOCATION);
  const [isFollowingUser, setIsFollowingUser] = useState(true);
  const isFollowingUserRef = React.useRef(isFollowingUser);
  React.useEffect(() => {
    isFollowingUserRef.current = isFollowingUser;
  }, [isFollowingUser]);

  const currentLocation = location
    ? { latitude: location.coords.latitude, longitude: location.coords.longitude }
    : { latitude: DEFAULT_LOCATION.latitude, longitude: DEFAULT_LOCATION.longitude };

  const markers = generateDummyDrivers(currentLocation);

  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  const handleCenter = () => {
    setIsFollowingUser(true);
    mapRef.current?.centerOnUser();
  };

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      // Use BestForNavigation for GPS-level accuracy (best for taxi apps)
      // This uses GPS + GLONASS when available, falls back to WiFi/Cell
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      setLocation(location);
      
      // Determine initial region
      const initialRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };
      setRegion(initialRegion);
      setIsFollowingUser(true);

      // Watch for real-time GPS updates
      // BestForNavigation: ~5m accuracy, updates frequently
      // timeInterval: minimum time between updates (ms)
      // distanceInterval: minimum distance change to trigger update (meters)
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000, // Update every 1 second minimum
          distanceInterval: 5, // Update if moved 5 meters
        },
        (newLocation) => {
          setLocation(newLocation);
          // Only update the region (and thus map center) when user has not panned away
          if (isFollowingUserRef.current) {
            setRegion({
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            });
          }
        }
      );

      return () => {
        subscription.remove();
      };
    })();
  }, []); // Run once on mount; ref keeps following state in sync

  return (
    <View style={styles.container}>
      <AppMapView
        ref={mapRef}
        region={region}
        userLocation={currentLocation}
        markers={markers}
        isFollowingUser={isFollowingUser}
        onRegionChangeComplete={(reg) => {
          // User panned the map — stop auto-centering on location
          setIsFollowingUser(false);
        }}
      />
      
      <ZoomControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onCenter={handleCenter}
      />

      {/* Overlay controls can go here */}
      {errorMsg && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  errorContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 8,
  },
  errorText: {
    color: '#fff',
    textAlign: 'center',
  },
});
