import React from "react";
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Spacing } from "@/constants/theme";

interface Props {
  visible: boolean;
  uri: string;
  onClose: () => void;
}

/**
 * Full-screen photo viewer modal with a dark backdrop and close button.
 * Press anywhere outside the image or the X button to dismiss.
 */
export default function PhotoViewerModal({ visible, uri, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {/* Close button — top right */}
        <Pressable
          onPress={onClose}
          style={[styles.closeButton, { top: insets.top + Spacing.md }]}
          hitSlop={16}
        >
          <MaterialIcons name="close" size={28} color="#fff" />
        </Pressable>

        {/* Tap backdrop to close */}
        <Pressable style={styles.backdropPress} onPress={onClose} />

        {/* Image — centered, aspect-fit */}
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="contain"
        />

        {/* Second backdrop press area below the image */}
        <Pressable style={styles.backdropPress} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  backdropPress: {
    flex: 1,
    width: "100%",
  },
  closeButton: {
    position: "absolute",
    right: Spacing.lg,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "92%",
    height: "60%",
  },
});
