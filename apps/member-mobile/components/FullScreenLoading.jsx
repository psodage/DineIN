import React from "react";
import { ActivityIndicator, Modal, View, StyleSheet } from "react-native";

export default function FullScreenLoading({
  visible,
  color = "#0F8F88",
  backdropColor = "rgba(15, 23, 42, 0.28)",
}) {
  return (
    <Modal transparent animationType="fade" visible={!!visible}>
      <View style={[styles.overlay, { backgroundColor: backdropColor }]}>
        <ActivityIndicator size="large" color={color} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
});

