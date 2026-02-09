
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenter: () => void;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({ onZoomIn, onZoomOut, onCenter }) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={onZoomIn}>
        <Ionicons name="add" size={24} color="#333" />
      </TouchableOpacity>
      <View style={styles.divider} />
      <TouchableOpacity style={styles.button} onPress={onZoomOut}>
        <Ionicons name="remove" size={24} color="#333" />
      </TouchableOpacity>
      
      <View style={styles.spacer} />

      <TouchableOpacity style={[styles.button, styles.centerButton]} onPress={onCenter}>
        <Ionicons name="navigate" size={24} color="#007AFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 120, // Check tab bar height
    right: 16,
    flexDirection: 'column',
    alignItems: 'center',
  },
  button: {
    width: 44,
    height: 44,
    backgroundColor: '#fff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  divider: {
    height: 1,
    width: '80%',
    backgroundColor: '#eee',
  },
  spacer: {
    height: 12,
  },
  centerButton: {
    borderRadius: 22, // Circle
  },
});
