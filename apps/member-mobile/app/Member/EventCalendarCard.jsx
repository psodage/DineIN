import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

const WEEK_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const ACCENT = "#F59E0B";
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DEFAULT_EVENT_DOTS = {
  "2020-12-04": ["#60A5FA"],
  "2020-12-08": ["#F59E0B", "#8B5CF6"],
  "2020-12-12": ["#14B8A6"],
  "2020-12-17": ["#8B5CF6", "#60A5FA"],
  "2020-12-23": ["#F59E0B"],
  "2020-12-28": ["#14B8A6", "#8B5CF6"],
};

function makeDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function generateMonthGrid(displayDate) {
  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Convert JS weekday (Sun = 0) to Monday-first index (Mon = 0, Sun = 6).
  const firstColumn = (firstDay.getDay() + 6) % 7;
  const grid = [];

  for (let i = 0; i < firstColumn; i += 1) {
    grid.push({ type: "empty", key: `empty-start-${i}` });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, month, day);
    grid.push({
      type: "day",
      key: `day-${makeDateKey(date)}`,
      date,
      day,
      dateKey: makeDateKey(date),
    });
  }

  while (grid.length % 7 !== 0) {
    grid.push({ type: "empty", key: `empty-end-${grid.length}` });
  }

  return grid;
}

export default function EventCalendarCard({
  initialDate = new Date(2020, 11, 8),
  eventDots = DEFAULT_EVENT_DOTS,
  onDateChange,
  onConfirm,
}) {
  const initial = useMemo(() => new Date(initialDate), [initialDate]);
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(initial.getFullYear(), initial.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(new Date(initial));

  const monthLabel = `${MONTH_NAMES[visibleMonth.getMonth()]} ${visibleMonth.getFullYear()}`;
  const cells = useMemo(() => generateMonthGrid(visibleMonth), [visibleMonth]);

  const handlePickDay = (date) => {
    setSelectedDate(date);
    if (onDateChange) {
      onDateChange(date);
    }
  };

  const shiftMonth = (offset) => {
    setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const selectedKey = makeDateKey(selectedDate);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Activity Calender</Text>

      <View style={styles.monthNavRow}>
        <Pressable style={styles.navButton} onPress={() => shiftMonth(-1)}>
          <Text style={styles.navArrow}>{"\u2039"}</Text>
        </Pressable>

        <Text style={styles.monthLabel}>{monthLabel}</Text>

        <Pressable style={styles.navButton} onPress={() => shiftMonth(1)}>
          <Text style={styles.navArrow}>{"\u203A"}</Text>
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEK_LABELS.map((label, idx) => (
          <Text key={`${label}-${idx}`} style={styles.weekdayText}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((item) => {
          if (item.type === "empty") {
            return <View key={item.key} style={styles.dayCell} />;
          }

          const isSelected = item.dateKey === selectedKey;
          const dots = eventDots[item.dateKey] || [];

          return (
            <Pressable
              key={item.key}
              style={styles.dayCell}
              onPress={() => handlePickDay(item.date)}
            >
              <View style={[styles.dateCircle, isSelected && styles.dateCircleSelected]}>
                <Text style={[styles.dateText, isSelected && styles.dateTextSelected]}>
                  {item.day}
                </Text>
              </View>

              <View style={styles.dotRow}>
                {dots.slice(0, 3).map((color, index) => (
                  <View
                    key={`${item.dateKey}-dot-${index}`}
                    style={[styles.eventDot, { backgroundColor: color }]}
                  />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actionWrap}>
        <Pressable
          style={styles.actionButton}
          onPress={() => {
            if (onConfirm) {
              onConfirm(selectedDate);
            }
          }}
        >
          <Text style={styles.actionArrow}>{"\u2192"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  monthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },
  navArrow: {
    fontSize: 24,
    color: "#0F172A",
    fontWeight: "500",
    marginTop: -2,
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekdayText: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 14,
  },
  dayCell: {
    width: "14.2857%",
    height: 54,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 4,
  },
  dateCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  dateCircleSelected: {
    backgroundColor: ACCENT,
  },
  dateText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  dateTextSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  dotRow: {
    marginTop: 4,
    minHeight: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  eventDot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.25,
  },
  actionWrap: {
    alignItems: "flex-end",
    marginTop: 4,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  actionArrow: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    marginTop: -1,
  },
});
