const prisma = require("../../common/database/prisma");

class PollRepository {
  async findAll(limit = 120) {
    return prisma.poll.findMany({
      take: limit,
      orderBy: { date: "desc" },
      include: {
        options: true,
        votes: true,
      },
    });
  }

  async findById(id) {
    return prisma.poll.findUnique({
      where: { id },
      include: {
        options: true,
        votes: true,
      },
    });
  }

  async findByDateRange(start, end) {
    return prisma.poll.findFirst({
      where: {
        date: {
          gte: start,
          lt: end,
        },
      },
      include: {
        options: true,
        votes: true,
      },
    });
  }

  async create(data) {
    const { date, question, questionMr, expiresAt, options } = data;
    return prisma.poll.create({
      data: {
        date,
        question,
        questionMr,
        expiresAt,
        options: {
          create: options.map(o => ({
            key: o.key,
            label: o.label,
            labelMr: o.labelMr,
          })),
        },
      },
      include: {
        options: true,
        votes: true,
      },
    });
  }

  async update(id, data) {
    const { question, questionMr, options } = data;

    if (options) {
      // Clean delete existing options and recreate
      await prisma.pollOption.deleteMany({
        where: { pollId: id },
      });
      return prisma.poll.update({
        where: { id },
        data: {
          question,
          questionMr,
          options: {
            create: options.map(o => ({
              key: o.key,
              label: o.label,
              labelMr: o.labelMr,
            })),
          },
        },
        include: {
          options: true,
          votes: true,
        },
      });
    }

    return prisma.poll.update({
      where: { id },
      data: {
        question,
        questionMr,
      },
      include: {
        options: true,
        votes: true,
      },
    });
  }

  async delete(id) {
    try {
      await prisma.poll.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async addVote(pollId, studentId, optionKey) {
    // 1. Get the option
    const option = await prisma.pollOption.findFirst({
      where: { pollId, key: optionKey },
    });
    if (!option) throw new Error("Invalid option key");

    // 2. Try upserting a vote
    await prisma.pollVote.upsert({
      where: {
        pollId_studentId: { pollId, studentId },
      },
      create: {
        pollId,
        studentId,
        optionId: option.id,
      },
      update: {
        optionId: option.id,
      },
    });

    // 3. Return full updated poll
    return this.findById(pollId);
  }
}

module.exports = new PollRepository();
