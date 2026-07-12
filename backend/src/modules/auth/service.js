const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../../common/config");
const authRepo = require("./repository");

class AuthService {
  generateAccessToken(user) {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
  }

  generateRefreshToken(user) {
    return jwt.sign(
      { id: user.id, type: "refresh" },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );
  }

  async login(email, password) {
    const user = await authRepo.findUserByEmail(email);
    if (!user) {
      const err = new Error("Invalid email or password");
      err.status = 401;
      throw err;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const err = new Error("Invalid email or password");
      err.status = 401;
      throw err;
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Store session token for single-session enforcement
    await authRepo.setActiveSessionToken(user.id, accessToken);

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await authRepo.createRefreshToken({
      userId: user.id,
      token: refreshToken,
      expiresAt,
    });

    return {
      user: { id: user.id, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    };
  }

  async logout(userId) {
    await authRepo.clearActiveSessionToken(userId);
    await authRepo.deleteAllRefreshTokens(userId);
  }

  async refreshAccessToken(refreshTokenStr) {
    let decoded;
    try {
      decoded = jwt.verify(refreshTokenStr, config.jwt.refreshSecret);
    } catch {
      const err = new Error("Invalid or expired refresh token");
      err.status = 401;
      throw err;
    }

    const stored = await authRepo.findRefreshToken(refreshTokenStr);
    if (!stored || stored.expiresAt < new Date()) {
      const err = new Error("Refresh token expired or revoked");
      err.status = 401;
      throw err;
    }

    const user = await authRepo.findUserById(decoded.id);
    if (!user) {
      const err = new Error("User not found");
      err.status = 401;
      throw err;
    }

    const newAccessToken = this.generateAccessToken(user);
    await authRepo.setActiveSessionToken(user.id, newAccessToken);

    return {
      accessToken: newAccessToken,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await authRepo.findUserById(userId);
    if (!user) {
      const err = new Error("User not found");
      err.status = 404;
      throw err;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      const err = new Error("Current password is incorrect");
      err.status = 400;
      throw err;
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await authRepo.updateUser(userId, { password: hashed });
  }
}

module.exports = new AuthService();
