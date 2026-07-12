const prisma = require("../../common/database/prisma");

class FoodMenuRepository {
  async findAll() {
    return prisma.foodMenu.findMany({
      orderBy: { date: "desc" },
    });
  }

  async findById(id) {
    return prisma.foodMenu.findUnique({
      where: { id },
    });
  }

  async findByDateRange(start, end) {
    return prisma.foodMenu.findFirst({
      where: {
        date: {
          gte: start,
          lt: end,
        },
      },
    });
  }

  async create(data) {
    return prisma.foodMenu.create({
      data,
    });
  }

  async update(id, data) {
    return prisma.foodMenu.update({
      where: { id },
      data,
    });
  }

  async delete(id) {
    try {
      await prisma.foodMenu.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = new FoodMenuRepository();
