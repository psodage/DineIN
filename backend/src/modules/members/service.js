const bcrypt = require("bcryptjs");
const prisma = require("../../common/database/prisma");
const studentRepository = require("./repository");
const authRepo = require("../auth/repository");
const { resolveMemberPrimaryFields } = require("../../common/utils/translateEnToMr");
const { statusMrFor, mealPlanMrFor } = require("../../common/utils/memberLabelsMr");
const billingRepo = require("../bills/repository");

// Helper to normalize months starts in local timezone
function getMonthStartLocal(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), 1, 0, 0, 0, 0);
}

function monthKeyLocal(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return `${dt.getFullYear()}-${dt.getMonth()}`;
}

function buildMonthStarts(joiningDate) {
  const start = getMonthStartLocal(joiningDate);
  const currentMonthStart = getMonthStartLocal(new Date());
  if (!start || !currentMonthStart) return [];
  if (start.getTime() > currentMonthStart.getTime()) return [];

  const months = [];
  let cursor = new Date(start);
  while (cursor.getTime() <= currentMonthStart.getTime()) {
    months.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function mapStudentToMember(student) {
  if (!student) return null;
  return {
    ...student,
    _id: student.id,
    email: student.user?.email || student.email || undefined,
  };
}

class StudentService {
  async getAllMembers() {
    const students = await studentRepository.findAll();
    const flattened = students.map(mapStudentToMember);

    for (const m of flattened) {
      const monthStarts = buildMonthStarts(m.joiningDate);
      let dueTotal = 0;
      let totalBillsSum = 0;

      for (const monthDate of monthStarts) {
        const key = monthKeyLocal(monthDate);
        if (!key) continue;

        const billing = await billingRepo.calculateMemberBilling(m.id, monthDate);
        totalBillsSum += Number(billing?.totalBill || 0);
        dueTotal += Number(billing?.remainingAmount || 0);
      }

      m.dueAmount = Math.round(dueTotal);
      m.duePayment = Math.round(totalBillsSum);
    }

    return flattened;
  }

  async getSplitMembers() {
    const activeStudents = await studentRepository.findActive();
    return activeStudents.map(s => ({
      _id: s.id,
      id: s.id,
      name: s.name,
      rollNumber: s.rollNumber,
    }));
  }

  async getMembersDueMonth(monthParam) {
    const m = String(monthParam || "").trim().match(/^(\d{4})-(\d{2})/);
    if (!m) {
      const err = new Error("Invalid month format. Expected YYYY-MM");
      err.status = 400;
      throw err;
    }

    const year = Number(m[1]);
    const monthIndex = Number(m[2]) - 1;
    const monthStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
    const monthEndExclusive = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0);

    const studentsToCompute = await prisma.student.findMany({
      where: {
        joiningDate: {
          lt: monthEndExclusive,
        },
      },
      select: { id: true },
    });

    const members = await Promise.all(
      studentsToCompute.map(async (st) => {
        const student = await studentRepository.findById(st.id);
        const billing = await billingRepo.calculateMemberBilling(st.id, monthStart);

        return {
          memberId: student.id,
          name: student.name || "",
          nameMr: student.nameMr || "",
          rollNumber: student.rollNumber || "",
          roomOwnerName: student.roomOwnerName || "",
          roomOwnerNameMr: student.roomOwnerNameMr || "",
          status: student.status || "",
          statusMr: student.statusMr || "",
          mealPlan: student.mealPlan || "",
          mealPlanMr: student.mealPlanMr || "",
          joiningDate: student.joiningDate || null,
          dueAmount: Number(billing?.remainingAmount || 0),
          paidAmount: Number(billing?.paidAmount || 0),
          remainingAmount: Number(billing?.remainingAmount || 0),
          monthlyStatus: billing?.status || "Pending",
        };
      })
    );

    const totals = members.reduce(
      (acc, member) => {
        acc.collected += Number(member.paidAmount || 0);
        acc.pending += Number(member.remainingAmount || 0);
        if (Number(member.remainingAmount || 0) <= 0) acc.membersPaid += 1;
        else acc.remainingMembers += 1;
        return acc;
      },
      { collected: 0, pending: 0, membersPaid: 0, remainingMembers: 0 }
    );

    return { month: monthStart, totals, members };
  }

  async getMemberById(id) {
    const student = await studentRepository.findById(id);
    if (!student) {
      const err = new Error("Member not found");
      err.status = 404;
      throw err;
    }

    const member = mapStudentToMember(student);
    const monthStarts = buildMonthStarts(member.joiningDate);
    let dueTotal = 0;
    let totalBillsSum = 0;
    const monthlyDueBills = [];

    for (const monthDate of monthStarts) {
      const key = monthKeyLocal(monthDate);
      if (!key) continue;

      const billing = await billingRepo.calculateMemberBilling(id, monthDate);
      const billDoc = billing
        ? {
            month: billing.month,
            totalBill: Number(billing.totalBill || 0),
            paidAmount: Number(billing.paidAmount || 0),
            remainingAmount: Number(billing.remainingAmount || 0),
          }
        : null;

      totalBillsSum += Number(billDoc?.totalBill || 0);
      const remaining = Number(billDoc?.remainingAmount || 0);
      dueTotal += remaining;

      if (remaining > 0) {
        monthlyDueBills.push({
          month: billDoc?.month || monthDate,
          totalBill: Number(billDoc?.totalBill || 0),
          paidAmount: Number(billDoc?.paidAmount || 0),
          remainingAmount: remaining,
        });
      }
    }

    member.dueAmount = Math.round(dueTotal);
    member.duePayment = Math.round(totalBillsSum);
    member.monthlyDueBills = monthlyDueBills;

    return member;
  }

  async createMember(data) {
    const normalizedEmail = data.email.toLowerCase().trim();

    const existingUser = await authRepo.findUserByEmail(normalizedEmail);
    if (existingUser && existingUser.role === "member") {
      const err = new Error("Member email already exists");
      err.status = 400;
      throw err;
    }

    // Sequence member roll number
    const counter = await prisma.counter.upsert({
      where: { name: "memberRollNumber" },
      update: { seq: { increment: 1 } },
      create: { name: "memberRollNumber", seq: 1 },
    });
    const nextRollNumber = String(counter.seq);

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await authRepo.createUser({
      email: normalizedEmail,
      password: hashedPassword,
      role: "member",
    });

    const [namePair, roomPair] = await Promise.all([
      resolveMemberPrimaryFields(String(data.name).trim(), String(data.nameMr ?? "").trim(), "", ""),
      resolveMemberPrimaryFields(String(data.roomOwnerName).trim(), String(data.roomOwnerNameMr ?? "").trim(), "", ""),
    ]);

    const student = await studentRepository.create({
      userId: user.id,
      name: namePair.en,
      nameMr: namePair.mr || "",
      rollNumber: nextRollNumber,
      roomOwnerName: roomPair.en,
      roomOwnerNameMr: roomPair.mr || "",
      phone: String(data.phone).trim(),
      joiningDate: data.joiningDate ? new Date(data.joiningDate) : new Date(),
      status: data.status || "Active",
      statusMr: statusMrFor(data.status || "Active"),
      mealPlan: data.mealPlan || "Lunch",
      mealPlanMr: mealPlanMrFor(data.mealPlan || "Lunch"),
    });

    return mapStudentToMember(student);
  }

  async updateMember(id, data) {
    const student = await studentRepository.findById(id);
    if (!student) {
      const err = new Error("Member not found");
      err.status = 404;
      throw err;
    }

    const trim = (v) => String(v ?? "").trim();
    const prevNameEn = trim(student.name);
    const prevNameMr = trim(student.nameMr);
    const prevRoomEn = trim(student.roomOwnerName);
    const prevRoomMr = trim(student.roomOwnerNameMr);

    const updateData = {};

    if (data.name !== undefined || data.nameMr !== undefined) {
      const namePair = await resolveMemberPrimaryFields(
        data.name !== undefined ? trim(data.name) : prevNameEn,
        data.nameMr !== undefined ? trim(data.nameMr) : prevNameMr,
        prevNameEn,
        prevNameMr
      );
      updateData.name = namePair.en;
      updateData.nameMr = namePair.mr || "";
    }

    if (data.roomOwnerName !== undefined || data.roomOwnerNameMr !== undefined) {
      const roomPair = await resolveMemberPrimaryFields(
        data.roomOwnerName !== undefined ? trim(data.roomOwnerName) : prevRoomEn,
        data.roomOwnerNameMr !== undefined ? trim(data.roomOwnerNameMr) : prevRoomMr,
        prevRoomEn,
        prevRoomMr
      );
      updateData.roomOwnerName = roomPair.en;
      updateData.roomOwnerNameMr = roomPair.mr || "";
    }

    if (data.phone !== undefined) updateData.phone = String(data.phone).trim();
    if (data.joiningDate !== undefined) updateData.joiningDate = new Date(data.joiningDate);
    if (data.status) {
      updateData.status = data.status;
      updateData.statusMr = statusMrFor(data.status);
    }
    if (data.mealPlan) {
      updateData.mealPlan = data.mealPlan;
      updateData.mealPlanMr = mealPlanMrFor(data.mealPlan);
    }

    if (data.email !== undefined) {
      const normalizedEmail = data.email ? String(data.email).trim().toLowerCase() : "";
      const user = await authRepo.findUserById(student.userId);
      if (!user) {
        const err = new Error("Auth record not found");
        err.status = 404;
        throw err;
      }

      if (normalizedEmail && normalizedEmail !== user.email) {
        const existing = await authRepo.findUserByEmail(normalizedEmail);
        if (existing && existing.role === "member") {
          const err = new Error("Member email already exists");
          err.status = 400;
          throw err;
        }
        await authRepo.updateUser(user.id, { email: normalizedEmail });
      }
    }

    if (data.password !== undefined) {
      const trimmedPassword = String(data.password).trim();
      if (trimmedPassword) {
        const user = await authRepo.findUserById(student.userId);
        if (!user) {
          const err = new Error("Auth record not found");
          err.status = 404;
          throw err;
        }
        const hashedPassword = await bcrypt.hash(trimmedPassword, 10);
        await authRepo.updateUser(user.id, { password: hashedPassword });
      }
    }

    const updated = await studentRepository.update(id, updateData);
    const populated = await studentRepository.findById(updated.id);
    return mapStudentToMember(populated);
  }

  async deleteMember(id) {
    const student = await studentRepository.delete(id);
    if (!student) {
      const err = new Error("Member not found");
      err.status = 404;
      throw err;
    }
    return student;
  }
}

module.exports = new StudentService();
