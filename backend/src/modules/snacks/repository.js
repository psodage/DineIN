const prisma = require("../../common/database/prisma");

class SnackRepository {
  // ─── Products ──────────────────────────────────────────────
  async findAllProducts(filter = {}) {
    return prisma.snackProduct.findMany({
      where: filter,
      orderBy: { name: "asc" },
    });
  }

  async findProductById(id) {
    return prisma.snackProduct.findUnique({
      where: { id },
    });
  }

  async findProductByName(name) {
    return prisma.snackProduct.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
  }

  async createProduct(data) {
    return prisma.snackProduct.create({ data });
  }

  async updateProduct(id, data) {
    return prisma.snackProduct.update({
      where: { id },
      data,
    });
  }

  async deleteProduct(id) {
    try {
      await prisma.snackProduct.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  // ─── Orders ────────────────────────────────────────────────
  async findAllOrders() {
    return prisma.snackOrder.findMany({
      orderBy: { date: "desc" },
      include: {
        student: true,
        snackProduct: true,
      },
    });
  }

  async findOrdersByStudent(studentId) {
    return prisma.snackOrder.findMany({
      where: { studentId },
      orderBy: { date: "desc" },
      include: {
        student: true,
        snackProduct: true,
      },
    });
  }

  async findOrdersByIds(ids) {
    return prisma.snackOrder.findMany({
      where: { id: { in: ids } },
      include: {
        student: true,
        snackProduct: true,
      },
    });
  }

  async findOrderById(id) {
    return prisma.snackOrder.findUnique({
      where: { id },
      include: {
        student: true,
        snackProduct: true,
      },
    });
  }

  async createOrder(data) {
    const { studentId, snackId, quantity, chargedAmount, date, isOutsideCustomer, customerName, customerNameMr } = data;
    
    // Find snack product price if chargedAmount is not provided
    let finalCharged = chargedAmount;
    if (finalCharged === null || finalCharged === undefined) {
      if (snackId) {
        const prod = await this.findProductById(snackId);
        if (prod) {
          finalCharged = Number(quantity || 0) * prod.price;
        }
      }
    }

    return prisma.snackOrder.create({
      data: {
        studentId,
        snackId,
        quantity: Number(quantity) || 1,
        chargedAmount: finalCharged || 0,
        date: date ? new Date(date) : new Date(),
        isOutsideCustomer: !!isOutsideCustomer,
        customerName,
        customerNameMr,
      },
      include: {
        student: true,
        snackProduct: true,
      },
    });
  }

  async createBulkOrders(studentId, orders, date) {
    const created = [];
    const dateObj = date ? new Date(date) : new Date();

    for (const o of orders) {
      const prod = await this.findProductById(o.snackId || o.snackProductId);
      if (prod) {
        const ord = await prisma.snackOrder.create({
          data: {
            studentId,
            snackId: prod.id,
            quantity: Number(o.quantity) || 1,
            chargedAmount: (Number(o.quantity) || 1) * prod.price,
            date: dateObj,
            isOutsideCustomer: false,
          },
          include: {
            student: true,
            snackProduct: true,
          },
        });
        created.push(ord);
      }
    }
    return created;
  }

  async updateOrder(id, data) {
    return prisma.snackOrder.update({
      where: { id },
      data,
    });
  }

  async deleteOrder(id) {
    try {
      await prisma.snackOrder.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = new SnackRepository();
