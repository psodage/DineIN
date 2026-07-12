import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import FullScreenLoading from "../../components/FullScreenLoading";
import { useAuth } from "../../lib/AuthContext";
import api from "../../lib/api";

const COLORS = {
  bgPremium: "#F5F7FA",
  card: "#FFFFFF",
  textNavy: "#101828",
  mutedText: "#6B7280",
  border: "#E7ECF1",
  primaryTeal: "#0F8F88",
  inputBg: "#F8FAFC",
};

export default function MemberEditProfile() {
  const router = useRouter();
  const { user, loading, isAuthenticated } = useAuth();

  const [initializing, setInitializing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [roomOwnerName, setRoomOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [isMessageModalVisible, setIsMessageModalVisible] = useState(false);
  const [messageTitle, setMessageTitle] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [onMessageClose, setOnMessageClose] = useState(null);

  const openMessageModal = useCallback(
    ({ title, body, type = "success", onClose = null }) => {
      setMessageTitle(title);
      setMessageBody(body);
      setMessageType(type);
      setOnMessageClose(() => onClose);
      setIsMessageModalVisible(true);
    },
    []
  );

  const closeMessageModal = useCallback(() => {
    setIsMessageModalVisible(false);
    if (typeof onMessageClose === "function") {
      onMessageClose();
    }
  }, [onMessageClose]);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setInitializing(false);
      return;
    }

    try {
      setInitializing(true);
      const res = await api.get(`/api/members/${user.id}`);
      const member = res?.data || {};
      setName(String(member?.name || user?.name || "").trim());
      setPhone(String(member?.phone || "").trim());
      setRoomOwnerName(String(member?.roomOwnerName || user?.roomOwnerName || "").trim());
      setEmail(String(member?.email || user?.email || "").trim());
    } catch (err) {
      console.error("Fetch member profile (edit) error:", err);
      Alert.alert(
        "Error",
        err?.response?.data?.message || "Failed to load your profile details."
      );
    } finally {
      setInitializing(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/");
      return;
    }
    if (!loading && isAuthenticated) {
      fetchProfile();
    }
  }, [loading, isAuthenticated, fetchProfile, router]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedRoomOwner = roomOwnerName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      Alert.alert("Validation", "Name is required.");
      return;
    }
    if (!trimmedPhone) {
      Alert.alert("Validation", "Phone is required.");
      return;
    }
    if (!trimmedRoomOwner) {
      Alert.alert("Validation", "Room owner name is required.");
      return;
    }
    if (!normalizedEmail) {
      Alert.alert("Validation", "Email is required.");
      return;
    }

    try {
      setSaving(true);
      await api.put(`/api/members/${user.id}`, {
        name: trimmedName,
        phone: trimmedPhone,
        roomOwnerName: trimmedRoomOwner,
        email: normalizedEmail,
      });
      openMessageModal({
        title: "Success",
        body: "Profile updated successfully.",
        type: "success",
        onClose: () => router.back(),
      });
    } catch (err) {
      console.error("Update member profile error:", err);
      openMessageModal({
        title: "Update failed",
        body: err?.response?.data?.message || "Failed to update profile.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    if (saving || initializing) return;
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  }, [fetchProfile, initializing, saving]);

  if (loading || !isAuthenticated) {
    return (
      <View style={styles.centered}>
        <FullScreenLoading visible color="#111827" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.85}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.textNavy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primaryTeal}
          />
        }
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Update your details</Text>
          <Text style={styles.heroSubtitle}>
            Keep your personal and contact information up to date.
          </Text>
        </View>

        <View style={styles.formCard}>
          <Label text="Full Name" />
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter full name"
            placeholderTextColor="#98A2B3"
          />

          <Label text="Phone Number" />
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="Enter phone number"
            placeholderTextColor="#98A2B3"
          />

          <Label text="Room Owner Name" />
          <TextInput
            style={styles.input}
            value={roomOwnerName}
            onChangeText={setRoomOwnerName}
            placeholder="Enter room owner name"
            placeholderTextColor="#98A2B3"
          />

          <Label text="Email" />
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="Enter email"
            placeholderTextColor="#98A2B3"
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.saveButton}
          activeOpacity={0.9}
          onPress={handleSave}
          disabled={saving || initializing}
        >
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>
      </View>

      <FullScreenLoading visible={initializing || saving} color="#111827" />
      <Modal
        transparent
        animationType="fade"
        visible={isMessageModalVisible}
        onRequestClose={closeMessageModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{messageTitle}</Text>
            <Text style={styles.modalBody}>{messageBody}</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  messageType === "success"
                    ? styles.modalBtnSuccess
                    : styles.modalBtnError,
                ]}
                activeOpacity={0.88}
                onPress={closeMessageModal}
              >
                <Text style={styles.modalBtnText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Label({ text }) {
  return <Text style={styles.label}>{text}</Text>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPremium,
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.bgPremium,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textNavy,
  },
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingBottom: 20,
  },
  heroCard: {
    backgroundColor: COLORS.primaryTeal,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 14,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: "#DFF8F6",
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.mutedText,
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBg,
    paddingHorizontal: 12,
    color: COLORS.textNavy,
    fontSize: 15,
    fontWeight: "600",
  },
  footer: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: COLORS.bgPremium,
  },
  saveButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.primaryTeal,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    padding: 20,
  },
  modalTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
  },
  modalBody: {
    marginTop: 8,
    color: "#64748B",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
  },
  modalActions: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  modalBtn: {
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  modalBtnSuccess: {
    backgroundColor: COLORS.primaryTeal,
  },
  modalBtnError: {
    backgroundColor: COLORS.primaryTeal,
  },
  modalBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
