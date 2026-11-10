const router = require('express').Router();
const auth = require('../middleware/auth');
const { projectGuard } = require('../middleware/access');
const { emit } = require('../socket');
const Project = require('../models/Project');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const { removeFiles } = require('../utils/files');

const populate = (q) => q.populate('owner', 'name email').populate('teamMembers', 'name email');
const ROLES = ['manager', 'developer', 'viewer'];

router.get('/', auth, async (req, res) => {
  try {
    res.json(await populate(Project.find({ teamMembers: req.user.id }).sort({ createdAt: -1 })));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    if (!req.body.title) return res.status(400).json({ message: 'Title required' });
    const p = await Project.create({
      title: req.body.title, description: req.body.description,
      owner: req.user.id, teamMembers: [req.user.id], roles: {},
    });
    res.status(201).json(await populate(Project.findById(p._id)));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/:id', auth, projectGuard(), async (req, res) => {
  try { res.json(await populate(Project.findById(req.params.id))); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

router.put('/:id', auth, projectGuard('project:edit'), async (req, res) => {
  try {
    const p = req.acc.project;
    if (req.body.title) p.title = req.body.title;
    if (req.body.description !== undefined) p.description = req.body.description;
    await p.save();
    emit(p._id, 'project:changed');
    res.json(await populate(Project.findById(p._id)));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete('/:id', auth, projectGuard('project:delete'), async (req, res) => {
  try {
    await req.acc.project.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/:id/members', auth, projectGuard('member:manage'), async (req, res) => {
  try {
    const p = req.acc.project;
    const { email, role = 'developer' } = req.body;
    if (!ROLES.includes(role)) return res.status(400).json({ message: 'Invalid role' });
    const u = await User.findOne({ email: (email || '').toLowerCase() });
    if (!u) return res.status(404).json({ message: 'No user with that email' });
    if (p.teamMembers.some((m) => m.equals(u._id))) return res.status(400).json({ message: 'Already a member' });
    p.teamMembers.push(u._id);
    p.roles = { ...(p.roles || {}), [String(u._id)]: role };
    await p.save();
    emit(p._id, 'project:changed');
    res.json(await populate(Project.findById(p._id)));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put('/:id/members/:userId', auth, projectGuard('member:manage'), async (req, res) => {
  try {
    const p = req.acc.project;
    if (!ROLES.includes(req.body.role)) return res.status(400).json({ message: 'Invalid role' });
    if (p.owner.equals(req.params.userId)) return res.status(400).json({ message: 'Cannot change owner role' });
    if (!p.teamMembers.some((m) => m.equals(req.params.userId))) return res.status(404).json({ message: 'Not a member' });
    p.roles = { ...(p.roles || {}), [req.params.userId]: req.body.role };
    await p.save();
    emit(p._id, 'project:changed');
    res.json(await populate(Project.findById(p._id)));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete('/:id', auth, projectGuard('project:delete'), async (req, res) => {
  try {
    const p = req.acc.project;
    const tickets = await Ticket.find({ projectId: p._id });
    tickets.forEach((t) => removeFiles(t.attachments));
    await Ticket.deleteMany({ projectId: p._id });
    await p.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;