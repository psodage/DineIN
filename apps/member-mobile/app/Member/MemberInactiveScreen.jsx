import React, { useEffect, useState } from "react";
import { Alert, Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import api from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";

const PRIMARY = "#0F8F88";
const BG = "#F5F7FA";
const TEXT_DARK = "#0F172A";
const TEXT_MUTE = "#64748B";

function toLocalYmd(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function MemberInactiveScreen({ memberId, onRefreshStatus }) {
  const router = useRouter();
  const { logout } = useAuth();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkingPending, setCheckingPending] = useState(false);
  const [hasPendingActivation, setHasPendingActivation] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadPendingActivation = async () => {
      if (!memberId) {
        if (mounted) setHasPendingActivation(false);
        return;
      }
      try {
        setCheckingPending(true);
        const res = await api.get(`/api/leave/student/${memberId}`);
        const rows = Array.isArray(res?.data) ? res.data : [];
        const pendingActivationExists = rows.some((row) => {
          const type = String(row?.type || "").toLowerCase();
          const status = String(row?.status || "").toLowerCase();
          return type === "activation" && status === "pending";
        });
        if (mounted) setHasPendingActivation(pendingActivationExists);
      } catch (error) {
        console.error("Pending activation check error:", error);
      } finally {
        if (mounted) setCheckingPending(false);
      }
    };
    loadPendingActivation();
    return () => {
      mounted = false;
    };
  }, [memberId]);

  const submitReactivationRequest = async () => {
    if (!memberId) return;
    if (hasPendingActivation) {
      Alert.alert("Already requested", "Your previous reactivation request is still pending admin review.");
      return;
    }
    const todayYmd = toLocalYmd(new Date());
    try {
      setSubmitting(true);
      await api.post("/api/leave/apply", {
        memberId,
        startDate: todayYmd,
        endDate: todayYmd,
        type: "Activation",
      });
      setIsConfirmOpen(false);
      setIsSuccessOpen(true);
      setHasPendingActivation(true);
      await onRefreshStatus?.();
    } catch (error) {
      console.error("Reactivation request error:", error);
      Alert.alert("Error", error?.response?.data?.message || "Failed to submit reactivation request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.logoutBtn}
          activeOpacity={0.88}
          onPress={async () => {
            try {
              await logout?.();
            } finally {
              router.replace("/");
            }
          }}
        >
       
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.contentWrap}>
        <View style={styles.iconWrap}>
          <Ionicons name="pause-circle-outline" size={56} color="#B45309" />
        </View>
        <Text style={styles.title}>You are on leave</Text>
        <Text style={styles.subtitle}>
          Your member account is currently inactive. If you want to activate again, send a reactivation request.
        </Text>

    
          
          <TouchableOpacity
            style={styles.reactivateBtn}
            activeOpacity={0.9}
            onPress={() => {
              if (hasPendingActivation) {
                Alert.alert("Already requested", "Your previous reactivation request is still pending admin review.");
                return;
              }
              setIsConfirmOpen(true);
            }}
            disabled={submitting || checkingPending || hasPendingActivation}
          >
            <Text style={styles.reactivateBtnText}>
              {hasPendingActivation
                ? "Reactivation Request Pending"
                : checkingPending
                  ? "Checking request status..."
                  : "Request Reactivation"}
            </Text>
          </TouchableOpacity>
          {hasPendingActivation ? (
            <Text style={styles.pendingInfoText}>
              You have already sent a reactivation request. You can send a new one after admin approves or rejects this request.
            </Text>
          ) : null}
       
      </View>

      <Modal transparent animationType="fade" visible={isConfirmOpen} onRequestClose={() => setIsConfirmOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm reactivation request?</Text>
            <Text style={styles.modalSub}>A request will be sent for admin approval.</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                activeOpacity={0.88}
                onPress={() => setIsConfirmOpen(false)}
                disabled={submitting}
              >
                <Text style={styles.cancelText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.confirmBtn]}
                activeOpacity={0.88}
                onPress={submitReactivationRequest}
                disabled={submitting}
              >
                <Text style={styles.confirmText}>{submitting ? "Submitting..." : "Confirm"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="fade" visible={isSuccessOpen} onRequestClose={() => setIsSuccessOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Request sent</Text>
            <Text style={styles.modalSub}>Your reactivation request has been submitted successfully.</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.confirmBtn]}
                activeOpacity={0.88}
                onPress={() => setIsSuccessOpen(false)}
              >
                <Text style={styles.confirmText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
  },
  contentWrap: {
    flex: 1,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  topBar: {
    position: "absolute",
    top: 8,
    right: 14,
    zIndex: 20,
  },
  logoutBtn: {
    width: 80,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#FEE2E2",
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutBtnText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "700",
  },
  iconWrap: {
    alignSelf: "center",
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    textAlign: "center",
    color: TEXT_DARK,
    fontSize: 26,
    fontWeight: "800",
  },
  subtitle: {
    textAlign: "center",
    color: TEXT_MUTE,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  reactivateCard: {
    marginTop: 22,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
  },
  reactivateTitle: {
    color: TEXT_DARK,
    fontSize: 16,
    fontWeight: "800",
  },
  reactivateSub: {
    marginTop: 6,
    color: TEXT_MUTE,
    fontSize: 12,
    fontWeight: "600",
  },
  reactivateBtn: {
    marginTop: 20,
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
  },
  reactivateBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  pendingInfoText: {
    marginTop: 8,
    color: TEXT_MUTE,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
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
    maxWidth: 390,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    padding: 14,
  },
  modalTitle: {
    color: TEXT_DARK,
    fontSize: 16,
    fontWeight: "800",
  },
  modalSub: {
    marginTop: 6,
    color: TEXT_MUTE,
    fontSize: 12,
    fontWeight: "600",
  },
  modalActions: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  modalBtn: {
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  cancelBtn: {
    backgroundColor: "#F1F5F9",
  },
  confirmBtn: {
    backgroundColor: PRIMARY,
  },
  cancelText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
  },
  confirmText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
