
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import MapView, { PROVIDER_GOOGLE, Region, Marker, Polyline } from 'react-native-maps';
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

  React.useEffect(() => {
    if (mapRef.current && region && !isUserInteracting) {
      // Only update the center, preserving the user's zoom/pitch
      // WE MUST NOT pass zoom/pitch/heading here if we want to respect user interaction
      mapRef.current.animateCamera({
        center: {
          latitude: region.latitude,
          longitude: region.longitude,
        },
      }, { duration: 500 });
    }
  }, [region.latitude, region.longitude, isUserInteracting]);

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
        <Marker
          key={marker.id}
          coordinate={marker.coordinate}
          title={marker.title}
          description={marker.description}
          anchor={{ x: 0.5, y: 0.5 }}
          flat={true}
          tracksViewChanges={false}
        >
          <View style={styles.markerContainer}>
            <Image
              source={require('@/assets/images/car-icon.png')}
              style={styles.carIcon}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          </View>
        </Marker>
      ))}
    </MapView>
  );
});

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  markerContainer: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carIcon: {
    width: 48,
    height: 48,
  },
});

AppMapView.displayName = 'AppMapView';
