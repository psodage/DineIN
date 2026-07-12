import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { useLanguage } from "../LanguageContext";

const LanguageToggle = () => {
const { language, toggleLanguage } = useLanguage();

  return (
    <TouchableOpacity style={styles.container} onPress={toggleLanguage}>
      <Text style={styles.text}>{language === "en" ? "MARATHI" : "ENGLISH"}</Text>
    </TouchableOpacity>
  );
};

export default LanguageToggle;

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 80,
    right: 24,
    zIndex: 999,
    elevation: 999,
    backgroundColor: "#111827",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  text: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 12,
  },
});

