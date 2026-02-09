import React from "react";
import { View, StyleSheet } from "react-native";
import { MapContainer } from "@/components/map";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <MapContainer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
