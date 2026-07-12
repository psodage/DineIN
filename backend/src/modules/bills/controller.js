const prisma = require("../../common/database/prisma");
const billingRepo = require("./repository");

function monthStartOf(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function parseMonthParamToLocalMonthStart(monthParam) {
  if (!monthParam) return monthStartOf(new Date());
  const s = String(monthParam).trim();
  const m = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (m) {
    const year = Number(m[1]);
    const monthIndex = Number(m[2]) - 1;
    return monthStartOf(new Date(year, monthIndex, 1));
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return monthStartOf(new Date());
  return monthStartOf(d);
}

function getLeaveDeductionRate(mealPlan) {
  const normalized = String(mealPlan || "").trim().toLowerCase();
  return normalized === "both" ? 100 : 60;
}

async function buildMealSummary({ student, monthStart, inactiveDays, dailyRate }) {
  const monthEndInclusive = new Date(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1).getTime() - 1);
  const monthEndDateOnly = new Date(monthEndInclusive.getFullYear(), monthEndInclusive.getMonth(), monthEndInclusive.getDate());
  const joinDateOnly = student?.joiningDate 
    ? new Date(student.joiningDate.getFullYear(), student.joiningDate.getMonth(), student.joiningDate.getDate()) 
    : monthStart;
  const monthStartDateOnly = new Date(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate());
  
  const eligibleStart = joinDateOnly.getTime() > monthStartDateOnly.getTime() ? joinDateOnly : monthStartDateOnly;

  const now = new Date();
  const isCurrentMonth = now.getFullYear() === monthStart.getFullYear() && now.getMonth() === monthStart.getMonth();
  const cappedEnd = isCurrentMonth 
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) 
    : monthEndDateOnly;
  const eligibleEnd = cappedEnd.getTime() < monthEndDateOnly.getTime() ? cappedEnd : monthEndDateOnly;

  const msPerDay = 24 * 60 * 60 * 1000;
  const eligibleDays = Math.max(0, Math.floor((eligibleEnd.getTime() - eligibleStart.getTime()) / msPerDay) + 1);

  const leaveDeductionRate = getLeaveDeductionRate(student?.mealPlan);
  const rawLeaveDeduction = Math.max(0, Number(inactiveDays || 0) * leaveDeductionRate);
  const grossMealAmount = Math.max(0, eligibleDays * Number(dailyRate || 0));
  const leaveDeduction = Math.min(grossMealAmount, rawLeaveDeduction);
  const mealAmount = Math.round(Math.max(0, grossMealAmount - leaveDeduction));

  return {
    eligibleDays,
    grossMealAmount: Math.round(grossMealAmount),
    leaveDeduction: Math.round(leaveDeduction),
    mealAmount,
  };
}

const billsController = {
  // GET /api/member-monthly-due/:memberId?month=YYYY-MM
  async getByMemberId(req, res) {
    const { memberId } = req.params;
    const monthStart = parseMonthParamToLocalMonthStart(req.query?.month);

    const [dueDoc, computedDoc, leaveStat, student] = await Promise.all([
      billingRepo.findMonthlyBill(memberId, monthStart),
      billingRepo.calculateMemberBilling(memberId, monthStart),
      prisma.leaveStat.findFirst({
        where: {
          studentId: memberId,
          month: monthStart,
        },
      }),
      prisma.student.findUnique({
        where: { id: memberId },
      }),
    ]);

    const chargeableKeys = Array.isArray(leaveStat?.chargeableLeaveDayKeys) ? leaveStat.chargeableLeaveDayKeys : [];
    const shortKeys = Array.isArray(leaveStat?.shortLeaveDayKeys) ? leaveStat.shortLeaveDayKeys : [];

    const hasExplicitDue = dueDoc?.due != null;
    const hasExplicitCollected = dueDoc?.collected != null;
    const explicitDue = hasExplicitDue ? Number(dueDoc.due || 0) : 0;
    const explicitCollected = hasExplicitCollected ? Number(dueDoc.collected || 0) : 0;
    const explicitStatus = dueDoc?.status || null;
    
    const totalBill = Number(computedDoc?.totalBill || 0);
    const paidAmount = hasExplicitCollected ? explicitCollected : Number(computedDoc?.paidAmount || 0);
    const remainingAmount = hasExplicitDue ? explicitDue : Number(computedDoc?.remainingAmount || 0);
    const computedStatus = computedDoc?.status || "Pending";
    const snacksAmount = Number(computedDoc?.snacksAmount || 0);
    const expenseShare = Number(computedDoc?.expenseShare || 0);
    const inactiveDays = Number(leaveStat?.inactiveDays || 0);

    const mealTypePrice = await prisma.mealType.findUnique({
      where: { mealPlan: student?.mealPlan || "Lunch" },
    });
    const monthlyPrice = Number(mealTypePrice?.price || 0);
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const dailyRate = daysInMonth > 0 ? monthlyPrice / daysInMonth : 0;

    const mealSummary = await buildMealSummary({
      student,
      monthStart,
      inactiveDays,
      dailyRate,
    });

    const mealAmount = mealSummary.mealAmount;
    const leaveDeduction = mealSummary.leaveDeduction;

    res.json({
      memberId,
      studentId: memberId,
      month: monthStart,
      monthlyDue: remainingAmount,
      totalBill,
      paidAmount,
      monthlyStatus: explicitStatus || computedStatus,
      mealAmount,
      snacksAmount,
      expenseShare,
      leaveDeduction,
      dailyRate,
      remainingAmount,
      inactiveDays,
      inactiveDayKeys: Array.from(new Set([...chargeableKeys, ...shortKeys])).sort(),
    });
  },

  // GET /api/member-monthly-due/:memberId/current
  async getCurrentByMemberId(req, res) {
    const { memberId } = req.params;
    const monthStart = monthStartOf(new Date());

    const [dueDoc, computedDoc, leaveStat, student] = await Promise.all([
      billingRepo.findMonthlyBill(memberId, monthStart),
      billingRepo.calculateMemberBilling(memberId, monthStart),
      prisma.leaveStat.findFirst({
        where: {
          studentId: memberId,
          month: monthStart,
        },
      }),
      prisma.student.findUnique({
        where: { id: memberId },
      }),
    ]);

    const chargeableKeys = Array.isArray(leaveStat?.chargeableLeaveDayKeys) ? leaveStat.chargeableLeaveDayKeys : [];
    const shortKeys = Array.isArray(leaveStat?.shortLeaveDayKeys) ? leaveStat.shortLeaveDayKeys : [];

    const hasExplicitDue = dueDoc?.due != null;
    const hasExplicitCollected = dueDoc?.collected != null;
    const explicitDue = hasExplicitDue ? Number(dueDoc.due || 0) : 0;
    const explicitCollected = hasExplicitCollected ? Number(dueDoc.collected || 0) : 0;
    
    const totalBill = Number(computedDoc?.totalBill || 0);
    const inactiveDays = Number(leaveStat?.inactiveDays || 0);

    const mealTypePrice = await prisma.mealType.findUnique({
      where: { mealPlan: student?.mealPlan || "Lunch" },
    });
    const monthlyPrice = Number(mealTypePrice?.price || 0);
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const dailyRate = daysInMonth > 0 ? monthlyPrice / daysInMonth : 0;

    const mealSummary = await buildMealSummary({
      student,
      monthStart,
      inactiveDays,
      dailyRate,
    });

    const mealAmount = mealSummary.mealAmount;
    const leaveDeduction = mealSummary.leaveDeduction;
    const snacksAmount = Number(computedDoc?.snacksAmount || 0);
    const expenseShare = Number(computedDoc?.expenseShare || 0);

    res.json({
      memberId,
      studentId: memberId,
      month: monthStart,
      monthlyDue: hasExplicitDue ? explicitDue : Number(computedDoc?.remainingAmount || 0),
      totalBill,
      paidAmount: hasExplicitCollected ? explicitCollected : Number(computedDoc?.paidAmount || 0),
      monthlyStatus: dueDoc?.status || computedDoc?.status || "Pending",
      mealAmount,
      snacksAmount,
      expenseShare,
      leaveDeduction,
      dailyRate,
      inactiveDays,
      inactiveDayKeys: Array.from(new Set([...chargeableKeys, ...shortKeys])).sort(),
    });
  },

  // GET /api/member-monthly-due/:memberId/history
  async getHistoryByMemberId(req, res) {
    const { memberId } = req.params;
    const fetchAll = String(req.query?.all || "").trim().toLowerCase() === "true";
    const limit = Math.max(1, Math.min(24, Number(req.query?.limit || 12)));

    const rows = fetchAll 
      ? await billingRepo.findAllBillsHistory(memberId)
      : await billingRepo.findBillsHistory(memberId, limit);

    res.json(
      rows.map((row) => {
        const due = Number(row.due || 0);
        const collected = Number(row.collected || 0);
        return {
          _id: row.id,
          id: row.id,
          month: row.month,
          due,
          collected,
          totalBill: due + collected,
          status: row.status || "Pending",
        };
      })
    );
  },
};

module.exports = billsController;
