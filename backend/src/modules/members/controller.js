const studentService = require("./service");

const membersController = {
  async getAll(req, res) {
    const list = await studentService.getAllMembers();
    res.json(list);
  },

  async getSplit(req, res) {
    const list = await studentService.getSplitMembers();
    res.json(list);
  },

  async getDueMonth(req, res) {
    const result = await studentService.getMembersDueMonth(req.query.month);
    res.json(result);
  },

  async getById(req, res) {
    const student = await studentService.getMemberById(req.params.id);
    res.json(student);
  },

  async create(req, res) {
    const student = await studentService.createMember(req.body);
    res.status(201).json(student);
  },

  async update(req, res) {
    const student = await studentService.updateMember(req.params.id, req.body);
    res.json(student);
  },

  async delete(req, res) {
    await studentService.deleteMember(req.params.id);
    res.json({ message: "Member deleted successfully" });
  },
};

module.exports = membersController;
