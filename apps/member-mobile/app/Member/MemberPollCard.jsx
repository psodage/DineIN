import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { fetchActivePoll, voteForPoll } from "../../@poll.js";

const PRIMARY = "#0F8F88";
const TEXT_DARK = "#0F172A";
const TEXT_MUTE = "#64748B";

function isErrorMessage(err) {
  return typeof err === "string" && err.trim().length > 0;
}

export default function MemberPollCard({ date = new Date() }) {
  const dateKey = useMemo(() => {
    try {
      const d = date instanceof Date ? date : new Date(date);
      if (Number.isNaN(d.getTime())) return "";
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    } catch {
      return String(date ?? "");
    }
  }, [date]);

  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [poll, setPoll] = useState(null);
  const [errorText, setErrorText] = useState("");

  const [selectedOptionKey, setSelectedOptionKey] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [successText, setSuccessText] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErrorText("");
      setSuccessText("");
      try {
        // Use local YYYY-MM-DD key directly to avoid timezone shifts.
        const active = await fetchActivePoll({ date: dateKey || undefined });
        if (!mounted) return;
        setPoll(active);
        setSelectedOptionKey(active?.myVote ?? null);
      } catch (err) {
        if (!mounted) return;
        setPoll(null);
        setSelectedOptionKey(null);
        const message = isErrorMessage(err?.message) ? err.message : "";
        setErrorText(message || "Failed to load poll.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [dateKey]);

  const hasVoted = !!poll?.myVote;
  const canVote = !!poll && !hasVoted && !!selectedOptionKey && !submitting;

  const getOptionCount = (optionKey) => {
    if (!poll?.counts) return null;
    return typeof poll.counts[optionKey] === "number" ? poll.counts[optionKey] : 0;
  };

  const onSelectOption = (key) => {
    if (hasVoted) return; // backend only allows one vote per day
    setSelectedOptionKey(key);
    setErrorText("");
    setSuccessText("");
  };

  const onPressVote = async () => {
    if (!poll?.id || !selectedOptionKey) return;

    setSubmitting(true);
    setErrorText("");
    setSuccessText("");

    try {
      const updated = await voteForPoll(poll.id, selectedOptionKey);
      setPoll(updated);
      setSelectedOptionKey(updated?.myVote ?? selectedOptionKey);
      setSuccessText("Thanks for voting!");
    } catch (err) {
      const message = err?.response?.data?.message || err?.message;
      setErrorText(isErrorMessage(message) ? message : "Failed to submit vote.");
    } finally {
      setSubmitting(false);
    }
  };

  const onPressCancel = () => {
    setErrorText("");
    setSuccessText("");
    if (hasVoted) {
      // No close X button in the design; use Cancel to hide the poll.
      setVisible(false);
      return;
    }
    setSelectedOptionKey(null);
  };

  if (!visible) return null;

  return (
    <View style={styles.card}>
      {loading ? (
        <View style={styles.stateWrap}>
          <ActivityIndicator color={PRIMARY} />
          <Text style={styles.mutedText}>Loading poll…</Text>
        </View>
      ) : poll ? (
        <>
          <Text style={styles.questionText}>{poll.question}</Text>

          <View style={styles.optionsWrap}>
            {poll.options.map((opt) => {
              const selected = opt.key === selectedOptionKey;
              const count = hasVoted ? getOptionCount(opt.key) : null;

              return (
                <TouchableOpacity
                  key={opt.key}
                  activeOpacity={0.85}
                  onPress={() => onSelectOption(opt.key)}
                  disabled={hasVoted || submitting}
                  style={[
                    styles.optionBox,
                    selected && styles.optionBoxSelected,
                    hasVoted && !selected && styles.optionBoxDisabled,
                  ]}
                >
                  <View style={styles.optionRow}>
                    <View
                      style={[
                        styles.optionIndicator,
                        selected && styles.optionIndicatorSelected,
                        hasVoted && !selected && styles.optionIndicatorDisabled,
                      ]}
                    >
                      {selected ? (
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.optionLabel,
                        selected && styles.optionLabelSelected,
                        hasVoted && !selected && styles.optionLabelDisabled,
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {opt.label}
                    </Text>

                    {hasVoted && count !== null && (
                      <View
                        style={[
                          styles.countPill,
                          selected ? styles.countPillSelected : styles.countPillMuted,
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionCountText,
                            selected
                              ? styles.optionCountTextSelected
                              : styles.optionCountTextDisabled,
                          ]}
                        >
                          {count}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {!!errorText && <Text style={styles.errorText}>{errorText}</Text>}
          {!!successText && <Text style={styles.successText}>{successText}</Text>}

          {!hasVoted && (
            <View style={styles.actionsRow}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={onPressVote}
                disabled={!canVote}
                style={[styles.voteButton, !canVote && styles.voteButtonDisabled]}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={styles.voteButtonContent}>
                    <Text style={styles.voteButtonText}>Submit</Text>
                    <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={onPressCancel}
                style={styles.cancelButton}
                disabled={submitting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      ) : (
        <View style={styles.emptyWrap}>
          <View style={styles.pollIllustration}>
            <Ionicons name="bar-chart-outline" size={34} color={PRIMARY} />
          </View>
          <Text style={styles.emptyText}>No active polls available</Text>
          <Text style={styles.emptySubText}>
            Check back later for new polls and give your opinion!
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingTop: 6,
  },
  mutedText: {
    color: TEXT_MUTE,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 8,
    textAlign: "center",
  },

  questionText: {
    fontSize: 14,
    fontWeight: "800",
    color: TEXT_MUTE,
    marginTop: 10,
    marginBottom: 14,
  },

  optionsWrap: {
    gap: 10,
  },

  optionBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  optionBoxSelected: {
    backgroundColor: "#E8F8F6",
    borderColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOpacity: 0.12,
  },

  optionBoxDisabled: {
    opacity: 0.85,
  },

  optionLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: TEXT_DARK,
    flex: 1,
  },

  optionLabelSelected: {
    color: TEXT_DARK,
  },

  optionLabelDisabled: {
    color: TEXT_MUTE,
  },

  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  optionIndicator: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  optionIndicatorSelected: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },

  optionIndicatorDisabled: {
    opacity: 0.75,
  },

  countPill: {
    minWidth: 36,
    height: 26,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  countPillSelected: {
    backgroundColor: "#FFFFFF",
    borderColor: "#BFEDEA",
  },

  countPillMuted: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
  },

  optionCountText: {
    fontSize: 12,
    fontWeight: "900",
  },

  optionCountTextSelected: {
    color: PRIMARY,
  },

  optionCountTextDisabled: {
    color: TEXT_MUTE,
  },

  stateWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },

  errorText: {
    marginTop: 10,
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "800",
  },

  successText: {
    marginTop: 10,
    color: "#059669",
    fontSize: 13,
    fontWeight: "800",
  },

  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
  },

  voteButton: {
    flex: 1,
    minHeight: 46,
    backgroundColor: PRIMARY,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 5,
  },

  voteButtonDisabled: {
    opacity: 0.55,
  },

  voteButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  voteButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  cancelButton: {
    minHeight: 46,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  cancelButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: TEXT_DARK,
  },

  emptyWrap: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FAFCFC",
    paddingVertical: 20,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  pollIllustration: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E8F8F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  emptyText: {
    color: TEXT_DARK,
    fontSize: 16,
    fontWeight: "700",
  },
  emptySubText: {
    marginTop: 8,
    color: TEXT_MUTE,
    textAlign: "center",
    lineHeight: 19,
    fontSize: 13,
    paddingHorizontal: 8,
  },
});

