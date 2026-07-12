import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../lib/AuthContext";
import api from "../../lib/api";
import MemberLeave from "./MemberLeave";
import MemberBill from "./MemberBill";
import MemberProfile from "./MemberProfile";
import MemberPollCard from "./MemberPollCard";
import SnackOrderPage from "./SnackOrderPage";
import MemberInactiveScreen from "./MemberInactiveScreen";
import FullScreenLoading from "../../components/FullScreenLoading";

const PRIMARY = "#0F8F88";
const BG = "#F5F7FA";
const TEXT_DARK = "#0F172A";
const TEXT_MUTE = "#64748B";
const MEAL_FALLBACK_TEXT = "Chapati, Bhaji, Amti, Bhat";

function formatCurrentDate(now) {
  try {
    return new Date(now).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function formatCurrentTime(now) {
  try {
    return new Date(now).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function toLocalYMD(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toUTCYMD(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function resolveMenuFromAtMenu(menuList, dateLike) {
  const localKey = toLocalYMD(dateLike);
  const utcKey = toUTCYMD(dateLike);
  if ((!localKey && !utcKey) || !Array.isArray(menuList) || menuList.length === 0) return null;

  const found = menuList.find((m) => {
    const menuLocalKey = toLocalYMD(m?.date);
    const menuUtcKey = toUTCYMD(m?.date);
    return (
      (localKey && menuLocalKey === localKey) ||
      (utcKey && menuUtcKey === utcKey) ||
      (localKey && menuUtcKey === localKey) ||
      (utcKey && menuLocalKey === utcKey)
    );
  });
  if (!found) return null;

  return {
    lunch: String(found?.lunch ?? "").trim(),
    dinner: String(found?.dinner ?? "").trim(),
  };
}

function resolveMealText(mealText) {
  const v = String(mealText ?? "").trim();
  if (!v) return MEAL_FALLBACK_TEXT;
  const lowered = v.toLowerCase();
  if (lowered === "undefined" || lowered === "null" || lowered === "nan") {
    return MEAL_FALLBACK_TEXT;
  }
  return v;
}

function formatDurationLabel(diffMs) {
  if (diffMs <= 0) return "In progress";
  const totalMinutes = Math.ceil(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `Starts in ${minutes} mins`;
  if (minutes === 0) return `Starts in ${hours} hr${hours > 1 ? "s" : ""}`;
  return `Starts in ${hours} hr ${minutes} mins`;
}

const MemberDashboard = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const memberId = user?.id || user?._id;
  const [memberStatus, setMemberStatus] = useState(() => String(user?.status || "").trim().toLowerCase());
  const [memberStatusLoading, setMemberStatusLoading] = useState(true);
  const isMemberInactive = memberStatus === "inactive";

  const memberName = user?.name || "Member";
  const hasUnreadNotifications = Number(user?.notificationCount ?? 0) > 0;
  const demoAvatarSource = useMemo(
    () => ({
      uri: `https://api.dicebear.com/9.x/initials/png?seed=${encodeURIComponent(
        memberName
      )}&radius=50&backgroundType=gradientLinear`,
    }),
    [memberName]
  );

  const [now, setNow] = useState(() => new Date());
  const todayDate = useMemo(
    () => new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    [now]
  );
  const todayKey = toLocalYMD(todayDate);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const selectedDateKey = toLocalYMD(selectedDate);
  const [dateWindowStart, setDateWindowStart] = useState(() => {
    const d = new Date(todayDate);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const mealTransitionAnim = useRef(new Animated.Value(1)).current;

  const [menuList, setMenuList] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [pollRefreshKey, setPollRefreshKey] = useState(0);
  const lastMenuFetchAtRef = useRef(0);
  const menuFetchInFlightRef = useRef(false);

  const fetchMemberStatus = useCallback(async () => {
    if (!memberId) {
      setMemberStatusLoading(false);
      return;
    }
    try {
      const res = await api.get(`/api/members/${memberId}`);
      const resolvedStatus = String(res?.data?.status || user?.status || "").trim().toLowerCase();
      setMemberStatus(resolvedStatus);
    } catch (err) {
      console.error("Member status fetch error:", err);
      setMemberStatus(String(user?.status || "").trim().toLowerCase());
    } finally {
      setMemberStatusLoading(false);
    }
  }, [memberId, user?.status]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 15);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetchMemberStatus();
  }, [fetchMemberStatus]);

  const fetchMenuWithRetry = async (attempt = 0, force = false) => {
    const nowMs = Date.now();
    const THROTTLE_MS = 10 * 60 * 1000;
    if (menuFetchInFlightRef.current) return;
    if (!force && nowMs - lastMenuFetchAtRef.current < THROTTLE_MS && attempt === 0) return;

    menuFetchInFlightRef.current = true;
    lastMenuFetchAtRef.current = nowMs;

    try {
      const res = await api.get("/api/menu");
      setMenuList(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 429 && attempt < 4) {
        const retryAfterHeader = err?.response?.headers?.["retry-after"];
        const retryAfterSeconds = Number.parseInt(retryAfterHeader, 10);
        const delayMs = Number.isFinite(retryAfterSeconds)
          ? retryAfterSeconds * 1000
          : 1000 * Math.pow(2, attempt);

        await new Promise((r) => setTimeout(r, delayMs));
        return fetchMenuWithRetry(attempt + 1, force);
      }

      console.error("Menu fetch error:", err);
      setMenuList([]);
    } finally {
      menuFetchInFlightRef.current = false;
    }
  };

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await fetchMemberStatus();
      const freshNow = new Date();
      const freshDateOnly = new Date(
        freshNow.getFullYear(),
        freshNow.getMonth(),
        freshNow.getDate()
      );
      // Full-page refresh resets date selection/window, clears stale menu cache,
      // and remounts the poll card so all sections reload together.
      setNow(freshNow);
      setSelectedDate(freshDateOnly);
      setDateWindowStart(freshDateOnly);
      setMenuList([]);
      lastMenuFetchAtRef.current = 0;
      await fetchMenuWithRetry(0, true);
      setPollRefreshKey((k) => k + 1);
    } finally {
      setRefreshing(false);
    }
  }, [fetchMemberStatus]);

  useEffect(() => {
    fetchMenuWithRetry();
  }, []);

  useEffect(() => {
    setDateWindowStart((prev) => {
      const normalizedPrev = new Date(prev);
      normalizedPrev.setHours(0, 0, 0, 0);

      const windowEnd = new Date(normalizedPrev);
      windowEnd.setDate(normalizedPrev.getDate() + 5);
      windowEnd.setHours(0, 0, 0, 0);

      if (todayDate <= windowEnd) return normalizedPrev;

      const nextStart = new Date(todayDate);
      nextStart.setHours(0, 0, 0, 0);
      return nextStart;
    });
  }, [todayKey, todayDate]);

  const activeMenu = useMemo(
    () => resolveMenuFromAtMenu(menuList, selectedDate),
    [menuList, selectedDate]
  );

  useEffect(() => {
    if (menuList.length === 0 || activeMenu) return;
    fetchMenuWithRetry();
  }, [selectedDateKey, activeMenu, menuList.length]);

  useEffect(() => {
    mealTransitionAnim.setValue(0);
    Animated.timing(mealTransitionAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [selectedDateKey, mealTransitionAnim]);

  const lunchText = resolveMealText(activeMenu?.lunch);
  const dinnerText = resolveMealText(activeMenu?.dinner);
  const isSelectedToday = selectedDateKey === todayKey;

  const lunchWindow = useMemo(() => {
    const d = new Date(selectedDate);
    const start = new Date(d);
    const end = new Date(d);
    start.setHours(13, 30, 0, 0);
    end.setHours(14, 30, 0, 0);
    return { start, end };
  }, [selectedDate]);

  const dinnerWindow = useMemo(() => {
    const d = new Date(selectedDate);
    const start = new Date(d);
    const end = new Date(d);
    start.setHours(19, 30, 0, 0);
    end.setHours(20, 30, 0, 0);
    return { start, end };
  }, [selectedDate]);

  const lunchStatus = useMemo(() => {
    if (!isSelectedToday) {
      return { countdown: "Starts at 1:30 PM", statusLabel: "Upcoming", statusKind: "upcoming" };
    }
    if (now >= lunchWindow.start && now < lunchWindow.end) {
      return { countdown: "In progress", statusLabel: "In Progress", statusKind: "active" };
    }
    if (now >= lunchWindow.end) {
      return { countdown: "Completed", statusLabel: "Completed", statusKind: "done" };
    }
    return {
      countdown: formatDurationLabel(lunchWindow.start - now),
      statusLabel: "Upcoming",
      statusKind: "upcoming",
    };
  }, [isSelectedToday, now, lunchWindow]);

  const dinnerStatus = useMemo(() => {
    if (!isSelectedToday) {
      return { countdown: "Starts at 7:30 PM", statusLabel: "Upcoming", statusKind: "upcoming" };
    }
    if (now >= dinnerWindow.start && now < dinnerWindow.end) {
      return { countdown: "In progress", statusLabel: "In Progress", statusKind: "active" };
    }
    if (now >= dinnerWindow.end) {
      return { countdown: "Completed", statusLabel: "Completed", statusKind: "done" };
    }
    return {
      countdown: formatDurationLabel(dinnerWindow.start - now),
      statusLabel: "Upcoming",
      statusKind: "upcoming",
    };
  }, [isSelectedToday, now, dinnerWindow]);

  const weekStrip = useMemo(() => {
    const items = [];
    const windowStart = new Date(dateWindowStart);
    windowStart.setHours(0, 0, 0, 0);

    for (let offset = 0; offset < 6; offset += 1) {
      const d = new Date(windowStart);
      d.setDate(windowStart.getDate() + offset);
      d.setHours(0, 0, 0, 0);
      items.push({
        key: toLocalYMD(d),
        date: d,
        weekdayShort: d.toLocaleDateString("en-US", { weekday: "short" }),
        dayOfMonth: d.getDate(),
      });
    }
    return items;
  }, [dateWindowStart]);

  const [activeTab, setActiveTab] = useState("home");
  const tabScaleRef = useRef({
    home: new Animated.Value(1),
    snacks: new Animated.Value(1),
    leaves: new Animated.Value(1),
    bill: new Animated.Value(1),
    profile: new Animated.Value(1),
  });

  const getTabScaleValue = (key) => {
    if (!tabScaleRef.current[key]) tabScaleRef.current[key] = new Animated.Value(1);
    return tabScaleRef.current[key];
  };

  const animatePress = (key) => {
    const v = getTabScaleValue(key);
    Animated.sequence([
      Animated.spring(v, { toValue: 0.94, useNativeDriver: true, speed: 30, bounciness: 6 }),
      Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }),
    ]).start();
  };

  const goTab = (key) => {
    setActiveTab(key);
    animatePress(key);
  };

  const renderWeekCard = ({ item }) => {
    const isSelected = item.key === selectedDateKey;
    const isToday = item.key === todayKey;
    return (
      <TouchableOpacity
        style={[styles.weekCard, isSelected && styles.weekCardActive]}
        activeOpacity={1}
        disabled={!isToday}
        onPress={() => {
          if (!isToday) return;
          setSelectedDate(new Date(item.date));
        }}
      >
        <Text style={[styles.weekDayText, isSelected && styles.weekDayTextActive]}>
          {item.weekdayShort}
        </Text>
        <Text style={[styles.weekDateText, isSelected && styles.weekDateTextActive]}>
          {item.dayOfMonth}
        </Text>
        <View style={[styles.weekDot, !isSelected && styles.weekDotHidden]} />
      </TouchableOpacity>
    );
  };

  const MealTimelineCard = ({
    title,
    accent,
    icon,
    timeLabel,
    menuText,
    countdown,
    statusLabel,
    statusKind,
    showConnector = false,
  }) => (
    <View style={styles.mealTimelineRow}>
      <View style={styles.mealTimelineLeft}>
        <Text style={styles.mealTimeLabel}>{timeLabel}</Text>
        <View style={[styles.mealTimelineDot, { backgroundColor: accent }]} />
        {showConnector ? <View style={styles.mealTimelineConnector} /> : null}
      </View>

      <View style={[styles.mealCard, { borderLeftColor: accent }]}> 
        <View style={styles.mealCardTopRow}>
          <View style={styles.mealTitleLeft}>
            <View style={[styles.mealIconWrap, { backgroundColor: `${accent}22` }]}> 
              <MaterialCommunityIcons name={icon} size={16} color={accent} />
            </View>
            <Text style={styles.mealTitle}>{title}</Text>
          </View>
          <View
            style={[
              styles.upcomingBadge,
              statusKind === "active" && styles.activeBadge,
              statusKind === "done" && styles.doneBadge,
            ]}
          >
            <Text
              style={[
                styles.upcomingBadgeText,
                statusKind === "active" && styles.activeBadgeText,
                statusKind === "done" && styles.doneBadgeText,
              ]}
            >
              {statusLabel}
            </Text>
          </View>
        </View>

        <Text style={styles.mealMenuText} numberOfLines={2}>
          {menuText}
        </Text>

        <View
          style={[
            styles.mealCountdownRow,
            statusKind === "active" && styles.mealCountdownRowActive,
            statusKind === "done" && styles.mealCountdownRowDone,
          ]}
        >
          <Ionicons
            name="time-outline"
            size={14}
            color={statusKind === "active" ? "#9A3412" : statusKind === "done" ? "#334155" : "#C2410C"}
          />
          <Text
            style={[
              styles.mealCountdownText,
              statusKind === "active" && styles.mealCountdownTextActive,
              statusKind === "done" && styles.mealCountdownTextDone,
            ]}
          >
            {countdown}
          </Text>
        </View>
      </View>
    </View>
  );

  const TopHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}> 
      <Ionicons name="fast-food-outline" size={120} color="rgba(255,255,255,0.10)" style={styles.headerPatternOne} />
      <Ionicons name="pizza-outline" size={80} color="rgba(255,255,255,0.09)" style={styles.headerPatternTwo} />

      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color={PRIMARY} />
          </View>
          <View>
            <Text style={styles.welcomeText}>Welcome Back,</Text>
            <Text style={styles.memberName}>{memberName}</Text>
            <View style={styles.motivationalPill}>
             
              <Text style={styles.motivationalPillText}>Have a great day!</Text>
              <Ionicons name="hand-left-outline" size={13} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionButton} activeOpacity={0.88}>
            <Ionicons name="notifications-outline" size={19} color={TEXT_DARK} />
            {hasUnreadNotifications ? <View style={styles.notificationDot} /> : null}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerActionButton, styles.logoutActionButton]}
            activeOpacity={0.88}
            onPress={async () => {
              try {
                await logout?.();
              } finally {
                router.replace("/");
              }
            }}
          >
            <Ionicons name="exit-outline" size={19} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const DateTimeFloatingCard = () => (
    <View style={styles.dateTimeCardWrap}>
      <View style={styles.dateTimeCard}>
        <View style={styles.dateTimeBlock}>
          <View style={styles.dateTimeIconBox}>
            <Ionicons name="calendar-outline" size={16} color={PRIMARY} />
          </View>
          <View style={styles.dateTimeTextBlock}>
            <Text style={styles.dateTimeMainText}>{formatCurrentDate(now)}</Text>
            
          </View>
        </View>

        <View style={styles.dateTimeDivider} />

        <View style={styles.dateTimeBlock}>
          <View style={styles.dateTimeIconBox}>
            <Ionicons name="time-outline" size={16} color={PRIMARY} />
          </View>
          <View style={styles.dateTimeTextBlock}>
            <Text style={styles.dateTimeSubText}>Current Time</Text>
            <Text style={styles.dateTimeMainText}>{formatCurrentTime(now)}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const PremiumBottomNav = () => {
    const items = [
      { key: "snacks", label: "Extra Snacks", icon: "fast-food-outline" },
      { key: "leaves", label: "Leaves", icon: "calendar-outline" },
      { key: "home", label: "Home", icon: "home-outline" },
      { key: "bill", label: "Bill", icon: "receipt-outline" },
      { key: "profile", label: "Profile", icon: "person-outline" },
    ];

    return (
      <View style={[styles.bottomBarWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}> 
        <View style={styles.bottomBar}>
          {items.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.bottomTab}
                activeOpacity={0.85}
                onPress={() => goTab(tab.key)}
              >
                <Animated.View style={{ transform: [{ scale: getTabScaleValue(tab.key) }] }}>
                  <Ionicons
                    name={tab.icon}
                    size={isActive ? 24 : 21}
                    color={isActive ? PRIMARY : "#94A3B8"}
                  />
                </Animated.View>
                <Text style={[styles.bottomTabLabel, isActive && styles.bottomTabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const HomeContent = () => (
    <>
      <TopHeader />
      <DateTimeFloatingCard />

      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={PRIMARY}
          />
        }
      >
        <View style={styles.sectionCard}>
          <View style={styles.weekRow}>
            {weekStrip.map((item) => (
              <View key={item.key} style={styles.weekItemSlot}>
                {renderWeekCard({ item })}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeadingRow}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionTitleIconWrap}>
                <Ionicons name="restaurant-outline" size={16} color={PRIMARY} />
              </View>
              <Text style={styles.sectionTitle}>Meal Overview</Text>
            </View>
            <Text style={styles.sectionLink}>View All</Text>
          </View>

          <Animated.View
            style={{
              opacity: mealTransitionAnim,
              transform: [
                {
                  translateY: mealTransitionAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, 0],
                  }),
                },
              ],
            }}
          >
            <MealTimelineCard
              title="Lunch"
              accent="#F59E0B"
              icon="food-outline"
              timeLabel="1:30 PM"
              menuText={lunchText}
              countdown={lunchStatus.countdown}
              statusLabel={lunchStatus.statusLabel}
              statusKind={lunchStatus.statusKind}
              showConnector
            />
            <MealTimelineCard
              title="Dinner"
              accent="#8B5CF6"
              icon="food-turkey"
              timeLabel="7:30 PM"
              menuText={dinnerText}
              countdown={dinnerStatus.countdown}
              statusLabel={dinnerStatus.statusLabel}
              statusKind={dinnerStatus.statusKind}
            />
          </Animated.View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeadingRow}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionTitleIconWrap}>
                <Ionicons name="bar-chart-outline" size={16} color={PRIMARY} />
              </View>
              <Text style={styles.sectionTitle}>Poll</Text>
            </View>
            <TouchableOpacity activeOpacity={0.85}>
              <Text style={styles.sectionLink}>View All</Text>
            </TouchableOpacity>
          </View>

          <MemberPollCard key={`poll-${pollRefreshKey}`} date={selectedDate} />
        </View>
      </ScrollView>
    </>
  );

  const renderMiddleContent = () => {
    if (activeTab === "leaves") return <MemberLeave embedded />;
    if (activeTab === "profile") return <MemberProfile embedded />;
    if (activeTab === "snacks") return <SnackOrderPage embedded />;
    if (activeTab === "bill") return <MemberBill embedded />;
    return <HomeContent />;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {memberStatusLoading ? (
        <FullScreenLoading visible color="#111827" />
      ) : isMemberInactive ? (
        <MemberInactiveScreen memberId={memberId} onRefreshStatus={fetchMemberStatus} />
      ) : (
        <>
          <View style={styles.container}>{renderMiddleContent()}</View>
          <PremiumBottomNav />
        </>
      )}
    </SafeAreaView>
  );
};

export default MemberDashboard;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
  },
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 18,
    paddingBottom: 64,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    overflow: "hidden",
  },
  headerPatternOne: {
    position: "absolute",
    right: -10,
    top: 14,
    transform: [{ rotate: "-8deg" }],
  },
  headerPatternTwo: {
    position: "absolute",
    left: 120,
    top: 66,
    transform: [{ rotate: "16deg" }],
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    marginTop: 20,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2.5,
    borderColor: "rgba(255,255,255,0.88)",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontWeight: "500",
  },
  memberName: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 2,
    lineHeight: 26,
  },
  motivationalPill: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  motivationalPillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  headerActions: {
    flexDirection: "row",
    gap: 10,
    marginLeft: 12,
    marginTop: -20,
  },
  headerActionButton: {
    
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
  },
  logoutActionButton: {
    backgroundColor: "#FEE2E2",
  },
  notificationDot: {
    position: "absolute",
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  dateTimeCardWrap: {
    marginHorizontal: 16,
    marginTop: -42,
    zIndex: 5,
  },
  dateTimeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 7,
  },
  dateTimeBlock: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dateTimeDivider: {
    width: 1,
    height: 42,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 10,
  },
  dateTimeIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#E8F8F6",
    alignItems: "center",
    justifyContent: "center",
  },
  dateTimeTextBlock: {
    flex: 1,
  },
  dateTimeMainText: {
    color: TEXT_DARK,
    fontSize: 13,
    fontWeight: "700",
  },
  dateTimeSubText: {
    color: TEXT_MUTE,
    fontSize: 11,
    marginTop: 2,
  },
  bodyScroll: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 126,
    gap: 14,
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 14,
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 4,
  },
  weekCard: {
    width: "100%",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  weekRow: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
  },
  weekItemSlot: {
    width: "15.5%",
  },
  weekCardActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 5,
  },
  weekDayText: {
    color: "#334155",
    fontSize: 10,
    fontWeight: "600",
  },
  weekDayTextActive: {
    color: "#FFFFFF",
  },
  weekDateText: {
    color: TEXT_DARK,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
  },
  weekDateTextActive: {
    color: "#FFFFFF",
  },
  weekDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#FFFFFF",
    marginTop: 5,
  },
  weekDotHidden: {
    opacity: 0,
  },
  sectionHeadingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    color: TEXT_DARK,
    fontSize: 18,
    fontWeight: "800",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitleIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: "#E8F8F6",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLink: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: "700",
  },
  mealTimelineRow: {
    flexDirection: "row",
    marginTop: 12,
  },
  mealTimelineLeft: {
    width: 62,
    alignItems: "center",
  },
  mealTimeLabel: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },
  mealTimelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 16,
  },
  mealTimelineConnector: {
    width: 2,
    height: 72,
    marginTop: 6,
    marginBottom: -8,
    borderRadius: 99,
    backgroundColor: "#E2E8F0",
  },
  mealCard: {
    flex: 1,
    borderRadius: 16,
    borderLeftWidth: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEF2F7",
    padding: 12,
    marginBottom: 2,
  },
  mealCardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mealTitleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mealIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  mealTitle: {
    fontSize: 16,
    color: TEXT_DARK,
    fontWeight: "800",
  },
  upcomingBadge: {
    backgroundColor: "#FFF7ED",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeBadge: {
    backgroundColor: "#FFE4D1",
  },
  upcomingBadgeText: {
    color: "#C2410C",
    fontSize: 11,
    fontWeight: "700",
  },
  activeBadgeText: {
    color: "#9A3412",
  },
  doneBadge: {
    backgroundColor: "#E2E8F0",
  },
  doneBadgeText: {
    color: "#334155",
  },
  mealMenuText: {
    marginTop: 10,
    color: "#334155",
    fontSize: 13,
    lineHeight: 19,
  },
  mealCountdownRow: {
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: "#FFF7ED",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  mealCountdownRowActive: {
    backgroundColor: "#FFE4D1",
  },
  mealCountdownRowDone: {
    backgroundColor: "#E2E8F0",
  },
  mealCountdownText: {
    color: "#C2410C",
    fontSize: 12,
    fontWeight: "600",
  },
  mealCountdownTextActive: {
    color: "#9A3412",
  },
  mealCountdownTextDone: {
    color: "#334155",
  },
  pollCardEmpty: {
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
  pollEmptyTitle: {
    color: TEXT_DARK,
    fontSize: 16,
    fontWeight: "700",
  },
  pollEmptySubtitle: {
    marginTop: 8,
    color: TEXT_MUTE,
    textAlign: "center",
    lineHeight: 19,
    fontSize: 13,
    paddingHorizontal: 8,
  },
  bottomBarWrap: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 15,
  },
  bottomBar: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  bottomTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  bottomTabLabel: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "700",
  },
  bottomTabLabelActive: {
    color: PRIMARY,
  },
});
