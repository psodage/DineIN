const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const config = require("../../common/config");
const prisma = require("../../common/database/prisma");
const authRepo = require("./repository");
const studentRepository = require("../members/repository");
const { sendOtpEmail, OTP_EXPIRY_MINUTES } = require("../../common/services/email");
const { statusMrFor, mealPlanMrFor } = require("../../common/utils/memberLabelsMr");

function hashOtp(otp) {
  return crypto.createHash("sha256").update(String(otp).trim()).digest("hex");
}

function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

function signToken(id, role) {
  return jwt.sign({ id, role }, config.jwt.secret, { expiresIn: "1d" });
}

function normalizePhoneDigits(raw) {
  return String(raw ?? "").replace(/\D/g, "");
}

const authController = {
  // 1. Admin Register
  async registerAdmin(req, res) {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await authRepo.findUserByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await authRepo.createUser({
      email: normalizedEmail,
      password: hashedPassword,
      role: "admin",
    });

    res.status(201).json({ message: "Admin registered successfully" });
  },

  // 2. Admin Send OTP
  async sendOtp(req, res) {
    const { email } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await authRepo.findUserByEmail(normalizedEmail);
    if (!user || user.role !== "admin") {
      return res.status(400).json({ message: "User not found" });
    }

    const otp = generateOtp();
    const hashedOtp = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Delete existing OTPs
    await prisma.otp.deleteMany({ where: { email: normalizedEmail } });
    await authRepo.createOtp({
      email: normalizedEmail,
      hashedOtp,
      expiresAt,
    });

    try {
      await sendOtpEmail(normalizedEmail, otp);
    } catch (emailError) {
      console.error("Nodemailer error:", emailError?.message || emailError);
      await prisma.otp.deleteMany({ where: { email: normalizedEmail } });
      return res.status(500).json({ message: "Failed to send OTP email" });
    }

    res.status(200).json({ message: "OTP sent successfully to your email" });
  },

  // 3. Admin Verify OTP
  async verifyOtp(req, res) {
    const { email, otp } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    const hashed = hashOtp(otp);

    const otpRecord = await prisma.otp.findFirst({
      where: {
        email: normalizedEmail,
        hashedOtp: hashed,
        expiresAt: { gte: new Date() },
      },
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    res.status(200).json({
      success: true,
      message: "OTP verified successfully",
    });
  },

  // 4. Admin Reset Password
  async resetPassword(req, res) {
    const { email, otp, newPassword } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    const hashed = hashOtp(otp);

    const otpRecord = await prisma.otp.findFirst({
      where: {
        email: normalizedEmail,
        hashedOtp: hashed,
        expiresAt: { gte: new Date() },
      },
    });

    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const user = await authRepo.findUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await authRepo.updateUser(user.id, {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    });

    await authRepo.deleteOtp(otpRecord.id);

    res.status(200).json({ message: "Password reset successful" });
  },

  // 5. Member Send OTP
  async sendMemberOtp(req, res) {
    const { email } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await authRepo.findUserByEmail(normalizedEmail);
    if (!user || user.role !== "member") {
      return res.status(400).json({ message: "Member not found" });
    }

    const otp = generateOtp();
    const hashedOtp = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.otp.deleteMany({ where: { email: normalizedEmail } });
    await authRepo.createOtp({
      email: normalizedEmail,
      hashedOtp,
      expiresAt,
    });

    try {
      await sendOtpEmail(normalizedEmail, otp);
    } catch (emailError) {
      console.error("Nodemailer error:", emailError?.message || emailError);
      await prisma.otp.deleteMany({ where: { email: normalizedEmail } });
      return res.status(500).json({ message: "Failed to send OTP email" });
    }

    res.status(200).json({ message: "OTP sent successfully to your email" });
  },

  // 6. Member Verify OTP
  async verifyMemberOtp(req, res) {
    const { email, otp } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    const hashed = hashOtp(otp);

    const otpRecord = await prisma.otp.findFirst({
      where: {
        email: normalizedEmail,
        hashedOtp: hashed,
        expiresAt: { gte: new Date() },
      },
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    res.status(200).json({
      success: true,
      message: "OTP verified successfully",
    });
  },

  // 7. Member Reset Password
  async resetMemberPassword(req, res) {
    const { email, otp, newPassword } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    const hashed = hashOtp(otp);

    const otpRecord = await prisma.otp.findFirst({
      where: {
        email: normalizedEmail,
        hashedOtp: hashed,
        expiresAt: { gte: new Date() },
      },
    });

    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const user = await authRepo.findUserByEmail(normalizedEmail);
    if (!user || user.role !== "member") {
      return res.status(400).json({ message: "Member not found" });
    }

    const hashedPassword = await bcrypt.hash(String(newPassword), 10);
    await authRepo.updateUser(user.id, {
      password: hashedPassword,
    });

    await authRepo.deleteOtp(otpRecord.id);

    res.status(200).json({ message: "Password reset successful" });
  },

  // 8. Member Change Password
  async changeMemberPassword(req, res) {
    const { currentPassword, newPassword } = req.body;

    const user = await authRepo.findUserById(req.user.id);
    if (!user || user.role !== "member") {
      return res.status(404).json({ message: "Member not found" });
    }

    const isMatch = await bcrypt.compare(String(currentPassword), user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(String(newPassword), 10);
    await authRepo.updateUser(user.id, {
      password: hashedPassword,
    });

    res.status(200).json({ message: "Password changed successfully" });
  },

  // 9. Admin Login
  async loginAdmin(req, res) {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await authRepo.findUserByEmail(normalizedEmail);
    if (!user || user.role !== "admin") {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = signToken(user.id, user.role);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
    });
  },

  // 10. Member Login
  async loginMember(req, res) {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await authRepo.findUserByEmail(normalizedEmail);
    if (!user || user.role !== "member") {
      return res.status(400).json({ message: "Member not found" });
    }

    const stored = String(user.password || "");
    const input = String(password || "");
    const looksHashed = stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$");

    const ok = looksHashed ? await bcrypt.compare(input, stored) : stored.trim() === input.trim();
    if (!ok) return res.status(400).json({ message: "Invalid credentials" });

    const student = await studentRepository.findByUserId(user.id);
    if (!student) return res.status(400).json({ message: "Member not found" });

    const token = signToken(student.id, "member");

    // Single active session
    await authRepo.setActiveSessionToken(user.id, token);

    res.json({
      token,
      user: {
        id: student.id,
        email: user.email,
        name: student.name,
        roomOwnerName: student.roomOwnerName,
        mealPlan: student.mealPlan,
        mealPlanMr: student.mealPlanMr || mealPlanMrFor(student.mealPlan),
        status: student.status,
        statusMr: student.statusMr || statusMrFor(student.status),
        role: "member",
      },
    });
  },

  // 11. Member Login Phone
  async loginMemberPhone(req, res) {
    const { phone, password } = req.body;

    const phoneRaw = String(phone).trim();
    const digits = normalizePhoneDigits(phoneRaw);
    if (!digits) {
      return res.status(400).json({ message: "Phone and password are required" });
    }

    const student = await studentRepository.findByPhone(phoneRaw);
    if (!student) return res.status(400).json({ message: "Member not found" });

    const user = await authRepo.findUserById(student.userId);
    if (!user || user.role !== "member") {
      return res.status(400).json({ message: "Member not found" });
    }

    const stored = String(user.password || "");
    const input = String(password || "");
    const looksHashed = stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$");

    const ok = looksHashed ? await bcrypt.compare(input, stored) : stored.trim() === input.trim();
    if (!ok) return res.status(400).json({ message: "Invalid credentials" });

    const token = signToken(student.id, "member");

    // Single active session
    await authRepo.setActiveSessionToken(user.id, token);

    res.json({
      token,
      user: {
        id: student.id,
        email: user.email,
        name: student.name,
        roomOwnerName: student.roomOwnerName,
        mealPlan: student.mealPlan,
        mealPlanMr: student.mealPlanMr || mealPlanMrFor(student.mealPlan),
        status: student.status,
        statusMr: student.statusMr || statusMrFor(student.status),
        role: "member",
      },
    });
  },

  // 12. Member Logout
  async logoutMember(req, res) {
    if (req.user) {
      await authRepo.setActiveSessionToken(req.user.id, null);
    }
    res.json({ message: "Logged out successfully" });
  },

  // 13. Admin Bounds
  async adminAccountBounds(req, res) {
    const u = req.user;
    if (!u) {
      return res.json({ createdAt: null });
    }
    res.json({ createdAt: u.createdAt.toISOString() });
  },

  // Extra helper methods for compatibility with common/middleware:
  async me(req, res) {
    res.json({ success: true, user: req.user });
  },

  async refresh(req, res) {
    const { refreshToken } = req.body;
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    } catch {
      return res.status(401).json({ success: false, message: "Invalid refresh token" });
    }
    const stored = await authRepo.findRefreshToken(refreshToken);
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ success: false, message: "Expired refresh token" });
    }
    const user = await authRepo.findUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }
    const token = signToken(user.id, user.role);
    res.json({ token, user });
  },
};

module.exports = authController;
