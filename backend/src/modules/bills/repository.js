"use strict";

const prisma = require("../../common/database/prisma");
const logger = require("../../common/utils/logger");

function getMonthRange(monthDate) {
  const d = monthDate instanceof Date ? monthDate : new Date(monthDate);
  if (Number.isNaN(d.getTime())) return null;

  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const endExclusive = new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, endExclusive };
}

function getDaysInMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function normalizeMealPlanKey(mealPlan) {
  return String(mealPlan || "Lunch").trim().toLowerCase();
}

function toDateOnlyLocal(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayKeyLocal(d) {
  const dd = toDateOnlyLocal(d);
  const pad = (n) => String(n).padStart(2, "0");
  return `${dd.getFullYear()}-${pad(dd.getMonth() + 1)}-${pad(dd.getDate())}`;
}

function addDaysLocal(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

class MonthlyBillRepository {
  async getMealPlanPriceMap() {
    const mealTypes = await prisma.mealType.findMany({
      select: {
        mealPlan: true,
        price: true,
      },
    });

    const map = new Map();
    for (const mealType of mealTypes) {
      map.set(normalizeMealPlanKey(mealType.mealPlan), Number(mealType.price || 0));
    }
    return map;
  }

  async computeApprovedLeaveDayKeysForMonth(studentId, monthStart) {
    const range = getMonthRange(monthStart);
    if (!range) return { approvedLeaveDayKeys: [] };

    const monthEndInclusive = addDaysLocal(range.endExclusive, -1);

    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        studentId,
        status: "Approved",
        type: "Leave",
        startDate: { lte: range.endExclusive },
        endDate: { gte: range.start },
      },
    });

    const set = new Set();

    for (const leave of approvedLeaves) {
      const reqStart = toDateOnlyLocal(new Date(leave.startDate));
      const reqEnd = toDateOnlyLocal(new Date(leave.endDate));
      if (Number.isNaN(reqStart.getTime()) || Number.isNaN(reqEnd.getTime())) continue;

      const clippedStart =
        reqStart.getTime() > range.start.getTime() ? reqStart : range.start;
      const clippedEnd =
        reqEnd.getTime() < monthEndInclusive.getTime() ? reqEnd : monthEndInclusive;

      if (clippedEnd.getTime() < clippedStart.getTime()) continue;

      for (
        let day = new Date(clippedStart);
        day.getTime() <= clippedEnd.getTime();
        day = addDaysLocal(day, 1)
      ) {
        set.add(dayKeyLocal(day));
      }
    }

    return { approvedLeaveDayKeys: Array.from(set) };
  }

  async calculateSnackTotalForMonth(studentId, monthDate) {
    const range = getMonthRange(monthDate);
    if (!range) return 0;

    const orders = await prisma.snackOrder.findMany({
      where: {
        studentId,
        isOutsideCustomer: false,
        date: {
          gte: range.start,
          lt: range.endExclusive,
        },
      },
      include: {
        snackProduct: true,
      },
    });

    return orders.reduce((sum, o) => {
      const charged = Number(o.chargedAmount);
      if (Number.isFinite(charged)) return sum + charged;
      const price = Number(o.snackProduct?.price || 0);
      const qty = Number(o.quantity || 0);
      return sum + qty * price;
    }, 0);
  }

  async calculateMemberBilling(studentId, monthDate) {
    const range = getMonthRange(monthDate);
    if (!range) return null;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) return null;

    const mealPriceMap = await this.getMealPlanPriceMap();
    const daysInMonth = getDaysInMonth(range.start);
    const monthlyPrice = Number(mealPriceMap.get(normalizeMealPlanKey(student.mealPlan)) || 0);
    const dailyRate = daysInMonth > 0 ? monthlyPrice / daysInMonth : 0;

    // If joined after billing window
    if (student.joiningDate && student.joiningDate >= range.endExclusive) {
      return {
        memberId: studentId,
        studentId,
        userId: student.userId,
        month: range.start,
        inactiveDays: 0,
        chargeableLeaveDayKeys: [],
        chargeableLeaveDays: 0,
        dailyRate,
        mealAmount: 0,
        snacksAmount: 0,
        expenseShare: 0,
        totalBill: 0,
        paidAmount: 0,
        remainingAmount: 0,
        status: "Paid",
      };
    }

    const { approvedLeaveDayKeys } = await this.computeApprovedLeaveDayKeysForMonth(
      studentId,
      range.start
    );

    const monthStart = range.start;
    const monthEndInclusive = addDaysLocal(range.endExclusive, -1);
    const joinDateOnly = student.joiningDate ? toDateOnlyLocal(new Date(student.joiningDate)) : null;
    const eligibleStart =
      joinDateOnly && joinDateOnly.getTime() > monthStart.getTime() ? joinDateOnly : monthStart;

    const isCurrentMonth =
      new Date().getFullYear() === monthStart.getFullYear() &&
      new Date().getMonth() === monthStart.getMonth();
    const maxEligibleEnd = isCurrentMonth ? toDateOnlyLocal(new Date()) : monthEndInclusive;
    const eligibleEnd =
      maxEligibleEnd.getTime() < monthEndInclusive.getTime() ? maxEligibleEnd : monthEndInclusive;

    const msPerDay = 24 * 60 * 60 * 1000;
    const eligibleDays = Math.max(
      0,
      Math.floor((eligibleEnd.getTime() - eligibleStart.getTime()) / msPerDay) + 1
    );

    const approvedEligibleLeaveDays = (approvedLeaveDayKeys || []).reduce((acc, key) => {
      const parts = key.split("-");
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0);
      if (Number.isNaN(d.getTime())) return acc;
      if (d.getTime() < eligibleStart.getTime()) return acc;
      if (d.getTime() > eligibleEnd.getTime()) return acc;
      return acc + 1;
    }, 0);

    const leaveDeductionRate = normalizeMealPlanKey(student.mealPlan) === "both" ? 100 : 60;
    const rawLeaveDeduction = approvedEligibleLeaveDays * leaveDeductionRate;
    const grossMealAmount = eligibleDays * dailyRate;
    const leaveDeduction = Math.min(grossMealAmount, rawLeaveDeduction);
    const mealAmount = Math.round(Math.max(0, grossMealAmount - leaveDeduction));

    const snacksAmount = Math.round(await this.calculateSnackTotalForMonth(studentId, range.start));
    const expenseShare = 0;
    const totalBill = mealAmount + snacksAmount;

    const payments = await prisma.payment.findMany({
      where: {
        studentId,
        month: {
          gte: range.start,
          lt: range.endExclusive,
        },
      },
      select: {
        paidAmount: true,
      },
    });

    const paidAmount = payments.reduce((sum, p) => sum + Number(p.paidAmount || 0), 0);
    const remainingAmount = Math.round(Math.max(0, totalBill - paidAmount));
    const status = remainingAmount <= 0 ? "Paid" : "Pending";

    return {
      memberId: studentId,
      studentId,
      userId: student.userId,
      month: range.start,
      inactiveDays: approvedEligibleLeaveDays,
      chargeableLeaveDayKeys: approvedLeaveDayKeys,
      chargeableLeaveDays: approvedEligibleLeaveDays,
      dailyRate,
      mealAmount,
      snacksAmount,
      expenseShare,
      totalBill,
      paidAmount,
      remainingAmount,
      status,
    };
  }

  async syncDuesForMember(student) {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    const createdAt = student.createdAt ? new Date(student.createdAt) : null;
    const joiningDate = student.joiningDate ? new Date(student.joiningDate) : null;

    let earliest = createdAt || joiningDate || currentMonthStart;
    if (joiningDate && joiningDate < earliest) earliest = joiningDate;

    let cursor = new Date(earliest.getFullYear(), earliest.getMonth(), 1, 0, 0, 0, 0);
    let upserted = 0;

    while (cursor <= currentMonthStart) {
      try {
        const billing = await this.calculateMemberBilling(student.id, cursor);
        if (billing) {
          await prisma.monthlyBill.upsert({
            where: {
              studentId_month: {
                studentId: student.id,
                month: cursor,
              },
            },
            update: {
              due: billing.remainingAmount,
              collected: billing.paidAmount,
              status: billing.status,
              lastChargedDate: now,
            },
            create: {
              studentId: student.id,
              month: cursor,
              due: billing.remainingAmount,
              collected: billing.paidAmount,
              status: billing.status,
              lastChargedDate: now,
            },
          });
          upserted++;
        }
      } catch (err) {
        logger.error(
          `syncDuesForMember: failed for student ${student.id} month ${cursor.toISOString()}: ${err.message}`
        );
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1, 0, 0, 0, 0);
    }

    return upserted;
  }

  async syncAllMemberDues() {
    const startTime = Date.now();
    logger.info("syncAllMemberDues: starting...");

    try {
      const students = await prisma.student.findMany({
        where: { status: "Active" },
        select: {
          id: true,
          userId: true,
          createdAt: true,
          joiningDate: true,
        },
      });

      let totalUpserted = 0;
      for (const student of students) {
        const count = await this.syncDuesForMember(student);
        totalUpserted += count;
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.info(
        `syncAllMemberDues: completed — ${students.length} students, ${totalUpserted} due records upserted in ${elapsed}s`
      );
    } catch (err) {
      logger.error(`syncAllMemberDues: fatal error — ${err.message}`);
    }
  }

  async findMonthlyBill(studentId, month) {
    return prisma.monthlyBill.findUnique({
      where: {
        studentId_month: {
          studentId,
          month,
        },
      },
    });
  }

  async findBillsHistory(studentId, limit = 12) {
    return prisma.monthlyBill.findMany({
      where: { studentId },
      orderBy: { month: "desc" },
      take: limit,
    });
  }

  async findAllBillsHistory(studentId) {
    return prisma.monthlyBill.findMany({
      where: { studentId },
      orderBy: { month: "desc" },
    });
  }
}

module.exports = new MonthlyBillRepository();
