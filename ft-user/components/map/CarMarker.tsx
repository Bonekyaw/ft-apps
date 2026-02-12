import React, { memo } from "react";
import { Marker } from "react-native-maps";

// Use relative path so Android bundles the asset correctly for native Marker
const CAR_ICON = require("../../assets/images/car-icon.png");

interface CarMarkerProps {
  id: string;
  coordinate: { latitude: number; longitude: number };
  title?: string;
  description?: string;
  /** Heading in degrees (0 = north). Used to rotate the car icon. */
  rotation?: number;
}

export const CarMarker = memo(function CarMarker({
  id,
  coordinate,
  title,
  description,
  rotation,
}: CarMarkerProps) {
  return (
    <Marker
      identifier={id}
      coordinate={coordinate}
      title={title}
      description={description}
      image={CAR_ICON}
      anchor={{ x: 0.5, y: 0.5 }}
      flat
      rotation={rotation ?? 0}
      tracksViewChanges={false}
    />
  );
});
