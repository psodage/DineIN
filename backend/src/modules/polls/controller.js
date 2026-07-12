const pollRepository = require("./repository");

function toUtcDayRange(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  const startOfDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
  return { startOfDay, endOfDay };
}

function summarizePoll(poll, viewerStudentId) {
  if (!poll) return null;

  const options = (poll.options || []).map((o) => ({
    key: o.key,
    label: o.label,
    labelMr: o.labelMr || o.label,
  }));

  const votes = poll.votes || [];
  const counts = {};
  for (const o of options) counts[o.key] = 0;

  for (const v of votes) {
    const opt = poll.options.find(o => o.id === v.optionId);
    if (opt && Object.prototype.hasOwnProperty.call(counts, opt.key)) {
      counts[opt.key] += 1;
    }
  }

  const totalVotes = votes.length;
  let myVote = null;

  if (viewerStudentId) {
    const userVote = votes.find((v) => String(v.studentId) === String(viewerStudentId));
    if (userVote) {
      const opt = poll.options.find(o => o.id === userVote.optionId);
      myVote = opt ? opt.key : null;
    }
  }

  return {
    _id: poll.id,
    id: poll.id,
    date: poll.date,
    question: poll.question,
    questionMr: poll.questionMr || poll.question,
    options,
    counts,
    totalVotes,
    myVote,
    expiresAt: poll.expiresAt,
    createdAt: poll.createdAt,
    updatedAt: poll.updatedAt,
  };
}

const pollsController = {
  // GET /api/polls/list
  async listRecent(req, res) {
    const polls = await pollRepository.findAll(120);
    res.json(polls.map((p) => summarizePoll(p, null)));
  },

  // GET /api/polls?date=YYYY-MM-DD
  async getByDate(req, res) {
    const dateQuery = req.query?.date;
    const range = toUtcDayRange(dateQuery || new Date());
    if (!range) return res.status(400).json({ message: "Invalid date" });

    const poll = await pollRepository.findByDateRange(range.startOfDay, range.endOfDay);
    if (!poll) return res.json(null);

    const viewerStudentId = req.auth?.role === "member" ? req.auth.id : null;
    res.json(summarizePoll(poll, viewerStudentId));
  },

  // POST /api/polls
  async create(req, res) {
    const { date, question, questionMr, options } = req.body;

    const range = toUtcDayRange(date);
    if (!range) return res.status(400).json({ message: "Invalid date" });

    const existing = await pollRepository.findByDateRange(range.startOfDay, range.endOfDay);
    if (existing) {
      return res.status(400).json({ message: "Poll already exists for this date" });
    }

    const qEn = String(question || "Meal Preference").trim();
    const qMr = String(questionMr || qEn).trim();

    const optionsStored = options.map(opt => ({
      key: opt.key.trim().toLowerCase(),
      label: String(opt.label || opt.key).trim(),
      labelMr: String(opt.labelMr || opt.label || opt.key).trim(),
    }));

    const poll = await pollRepository.create({
      date: range.startOfDay,
      question: qEn,
      questionMr: qMr,
      options: optionsStored,
      expiresAt: range.endOfDay,
    });

    res.status(201).json(summarizePoll(poll, null));
  },

  // PUT /api/polls/:id
  async update(req, res) {
    const { id } = req.params;
    const { question, questionMr, options } = req.body;

    const poll = await pollRepository.findById(id);
    if (!poll) return res.status(404).json({ message: "Poll not found" });

    const updateData = {};
    if (question !== undefined) {
      updateData.question = String(question).trim();
      updateData.questionMr = String(questionMr || question).trim();
    }

    if (options !== undefined) {
      updateData.options = options.map(opt => ({
        key: opt.key.trim().toLowerCase(),
        label: String(opt.label || opt.key).trim(),
        labelMr: String(opt.labelMr || opt.label || opt.key).trim(),
      }));
    }

    const updated = await pollRepository.update(id, updateData);
    res.json(summarizePoll(updated, null));
  },

  // DELETE /api/polls/:id
  async delete(req, res) {
    const success = await pollRepository.delete(req.params.id);
    if (!success) return res.status(404).json({ message: "Poll not found" });
    res.json({ message: "Poll deleted successfully" });
  },

  // POST /api/polls/:id/vote
  async vote(req, res) {
    const { id } = req.params;
    const { optionKey } = req.body;

    const poll = await pollRepository.findById(id);
    if (!poll) return res.status(404).json({ message: "Poll not found" });

    if (poll.expiresAt && new Date(poll.expiresAt).getTime() <= Date.now()) {
      return res.status(400).json({ message: "Poll has expired" });
    }

    const studentId = req.member?.id;
    if (!studentId) {
      return res.status(400).json({ message: "Student credentials not found" });
    }

    try {
      const updated = await pollRepository.addVote(id, studentId, optionKey);
      res.json(summarizePoll(updated, studentId));
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
};

module.exports = pollsController;
