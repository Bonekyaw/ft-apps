
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { CarMarker } from './CarMarker';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useTheme } from '@react-navigation/native';

// Define the ref handle type
export interface AppMapViewHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  centerOnUser: () => void;
}

interface MapViewProps {
  region: Region;
  userLocation: {
    latitude: number;
    longitude: number;
  };
  /** When true, map camera follows user location; when false, pan/zoom are left as-is */
  isFollowingUser?: boolean;
  onRegionChangeComplete?: (region: Region) => void;
  markers?: {
    id: string;
    coordinate: { latitude: number; longitude: number };
    title?: string;
    description?: string;
  }[];
}

export const AppMapView = React.forwardRef<AppMapViewHandle, MapViewProps>(({
  region,
  userLocation,
  isFollowingUser = true,
  onRegionChangeComplete,
  markers = [],
}, ref) => {
  const { colors } = useTheme();
  const mapRef = React.useRef<MapView>(null);

  React.useImperativeHandle(ref, () => ({
    zoomIn: () => {
      mapRef.current?.getCamera().then((camera) => {
        if (camera) {
            camera.zoom = (camera.zoom || 15) + 1;
            mapRef.current?.animateCamera(camera, { duration: 300 });
        }
      });
    },
    zoomOut: () => {
      mapRef.current?.getCamera().then((camera) => {
          if (camera) {
              camera.zoom = (camera.zoom || 15) - 1;
              mapRef.current?.animateCamera(camera, { duration: 300 });
          }
      });
    },
    centerOnUser: () => {
       mapRef.current?.animateCamera({
        center: {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        },
        pitch: 45,
        heading: 0,
        zoom: 17,
        altitude: 1000, 
      }, { duration: 1000 });
    }
  }));

  const [isUserInteracting, setIsUserInteracting] = React.useState(false);

  // Only recenter the map on region when we are in "follow user" mode (e.g. after center button or initial load).
  // When the user has panned away, isFollowingUser is false and we do not animate back to their location.
  React.useEffect(() => {
    if (!isFollowingUser || !mapRef.current || !region || isUserInteracting) return;
    mapRef.current.animateCamera({
      center: {
        latitude: region.latitude,
        longitude: region.longitude,
      },
    }, { duration: 500 });
  }, [region.latitude, region.longitude, isUserInteracting, isFollowingUser]);

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      style={styles.map}
      initialCamera={{
        center: {
          latitude: region.latitude,
          longitude: region.longitude,
        },
        pitch: 45,
        heading: 0,
        altitude: 1000,
        zoom: 17,
      }}
      showsUserLocation={true}
      showsMyLocationButton={true}
      pitchEnabled={true}
      loadingEnabled={true}
      zoomEnabled={true}
      scrollEnabled={true}
      rotateEnabled={true}
      zoomTapEnabled={true}
      onPanDrag={() => setIsUserInteracting(true)}
      onRegionChangeComplete={(reg) => {
        setIsUserInteracting(false);
        onRegionChangeComplete?.(reg);
      }}
    >
      {markers.map((marker) => (
        <CarMarker
          key={marker.id}
          id={marker.id}
          coordinate={marker.coordinate}
          title={marker.title}
          description={marker.description}
        />
      ))}
    </MapView>
  );
});

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});

AppMapView.displayName = 'AppMapView';
