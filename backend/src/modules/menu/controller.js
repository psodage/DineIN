const menuRepository = require("./repository");

function parseDateOnlyToUtcRange(dateStr) {
  const raw = String(dateStr ?? "").trim();
  if (!raw) return null;

  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(d)) return null;
    const startOfDay = new Date(Date.UTC(y, mo, d));
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
    return { startOfDay, endOfDay };
  }

  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return null;
  const startOfDay = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
  return { startOfDay, endOfDay };
}

const menuController = {
  async getAll(req, res) {
    const menus = await menuRepository.findAll();
    res.json(menus);
  },

  async getByDate(req, res) {
    const { date } = req.query;
    const range = parseDateOnlyToUtcRange(date);
    if (!range) {
      return res.status(400).json({ message: "Valid 'date' query param is required" });
    }

    const menu = await menuRepository.findByDateRange(range.startOfDay, range.endOfDay);
    if (!menu) return res.status(404).json({ message: "Menu not found for this date" });
    res.json(menu);
  },

  async create(req, res) {
    const { date, lunch, dinner } = req.body;

    const d = new Date(date);
    const startOfDay = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    const existingMenu = await menuRepository.findByDateRange(startOfDay, endOfDay);
    if (existingMenu) {
      return res.status(400).json({ message: "Menu already exists for this date" });
    }

    const lunchEn = String(lunch || "").trim();
    const dinnerEn = String(dinner || "").trim();
    if (!lunchEn && !dinnerEn) {
      return res.status(400).json({ message: "Please provide lunch or dinner" });
    }

    const lunchMr = String(req.body.lunchMr || lunchEn).trim();
    const dinnerMr = String(req.body.dinnerMr || dinnerEn).trim();

    const menu = await menuRepository.create({
      date: startOfDay,
      breakfast: req.body.breakfast || "",
      lunch: lunchEn,
      lunchMr,
      dinner: dinnerEn,
      dinnerMr,
    });

    res.status(201).json(menu);
  },

  async update(req, res) {
    const { id } = req.params;
    const { date, lunch, dinner } = req.body;

    const lunchEn = String(lunch || "").trim();
    const dinnerEn = String(dinner || "").trim();
    if (lunch !== undefined && dinner !== undefined && !lunchEn && !dinnerEn) {
      return res.status(400).json({ message: "Please provide lunch or dinner" });
    }

    const menu = await menuRepository.findById(id);
    if (!menu) {
      return res.status(404).json({ message: "Menu not found" });
    }

    const updateData = {};
    if (date) updateData.date = new Date(date);
    if (req.body.breakfast !== undefined) updateData.breakfast = req.body.breakfast;

    if (lunch !== undefined) {
      updateData.lunch = lunchEn;
      updateData.lunchMr = String(req.body.lunchMr || lunchEn).trim();
    }
    if (dinner !== undefined) {
      updateData.dinner = dinnerEn;
      updateData.dinnerMr = String(req.body.dinnerMr || dinnerEn).trim();
    }

    const updated = await menuRepository.update(id, updateData);
    res.json(updated);
  },

  async delete(req, res) {
    const success = await menuRepository.delete(req.params.id);
    if (!success) return res.status(404).json({ message: "Menu not found" });
    res.json({ message: "Menu deleted successfully" });
  },
};

module.exports = menuController;
