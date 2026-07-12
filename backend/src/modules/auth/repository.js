const prisma = require("../../common/database/prisma");

class AuthRepository {
  async findUserByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  }

  async findUserById(id) {
    return prisma.user.findUnique({ where: { id } });
  }

  async createUser(data) {
    return prisma.user.create({ data });
  }

  async updateUser(id, data) {
    return prisma.user.update({ where: { id }, data });
  }

  async setActiveSessionToken(id, token) {
    return prisma.user.update({
      where: { id },
      data: { activeSessionToken: token },
    });
  }

  async clearActiveSessionToken(id) {
    return prisma.user.update({
      where: { id },
      data: { activeSessionToken: null },
    });
  }

  async createRefreshToken(data) {
    return prisma.refreshToken.create({ data });
  }

  async findRefreshToken(token) {
    return prisma.refreshToken.findUnique({ where: { token } });
  }

  async deleteRefreshToken(token) {
    return prisma.refreshToken.delete({ where: { token } });
  }

  async deleteAllRefreshTokens(userId) {
    return prisma.refreshToken.deleteMany({ where: { userId } });
  }

  async findPendingRegistration(email) {
    return prisma.pendingRegistration.findUnique({ where: { email } });
  }

  async createPendingRegistration(data) {
    return prisma.pendingRegistration.create({ data });
  }

  async deletePendingRegistration(id) {
    return prisma.pendingRegistration.delete({ where: { id } });
  }

  async createOtp(data) {
    return prisma.otp.create({ data });
  }

  async findOtpsByEmail(email) {
    return prisma.otp.findMany({
      where: { email },
      orderBy: { createdAt: "desc" },
    });
  }

  async deleteOtp(id) {
    return prisma.otp.delete({ where: { id } });
  }
}

module.exports = new AuthRepository();
