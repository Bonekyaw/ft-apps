import React from "react";
import { Marker } from "react-native-maps";

// Use relative path so Android bundles the asset correctly for native Marker
const CAR_ICON = require("../../assets/images/car-icon.png");

interface CarMarkerProps {
  id: string;
  coordinate: { latitude: number; longitude: number };
  title?: string;
  description?: string;
}

export const CarMarker: React.FC<CarMarkerProps> = ({
  id,
  coordinate,
  title,
  description,
}) => {
  return (
    <Marker
      identifier={id}
      coordinate={coordinate}
      title={title}
      description={description}
      image={CAR_ICON}
      anchor={{ x: 0.5, y: 0.5 }}
      flat={true}
    />
  );
};
