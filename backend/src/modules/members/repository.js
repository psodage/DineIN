const prisma = require("../../common/database/prisma");

class StudentRepository {
  async findAll() {
    return prisma.student.findMany({
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findActive() {
    return prisma.student.findMany({
      where: {
        status: "Active",
      },
      select: {
        id: true,
        name: true,
        rollNumber: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findById(id) {
    return prisma.student.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });
  }

  async findByUserId(userId) {
    return prisma.student.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });
  }

  async findByPhone(phone) {
    return prisma.student.findFirst({
      where: {
        phone: {
          in: [phone, phone.replace(/\D/g, ""), `+${phone.replace(/\D/g, "")}`],
        },
      },
    });
  }

  async create(data) {
    return prisma.student.create({
      data,
    });
  }

  async update(id, data) {
    return prisma.student.update({
      where: { id },
      data,
    });
  }

  async delete(id) {
    const student = await this.findById(id);
    if (!student) return null;

    // Clean up referencing models in transaction
    await prisma.$transaction([
      prisma.snackOrder.deleteMany({ where: { studentId: id } }),
      prisma.leaveRequest.deleteMany({ where: { studentId: id } }),
      prisma.leaveStat.deleteMany({ where: { studentId: id } }),
      prisma.payment.deleteMany({ where: { studentId: id } }),
      prisma.monthlyBill.deleteMany({ where: { studentId: id } }),
      prisma.student.delete({ where: { id } }),
      prisma.user.delete({ where: { id: student.userId } }),
    ]);

    return student;
  }
}

module.exports = new StudentRepository();
