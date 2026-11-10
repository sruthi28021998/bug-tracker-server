const router = require('express').Router();
const auth = require('../middleware/auth');
const { can, getAccess } = require('../middleware/access');
const { emit } = require('../socket');
const Ticket = require('../models/Ticket');
const Comment = require('../models/Comment');

const access = async (ticketId, userId) => {
  const t = await Ticket.findById(ticketId);
  if (!t) return null;
  const acc = await getAccess(t.projectId, userId);
  return acc ? { ...acc, ticket: t } : null;
};

router.get('/', auth, async (req, res) => {
  try {
    if (!(await access(req.query.ticketId, req.user.id))) return res.status(403).json({ message: 'No access' });
    res.json(await Comment.find({ ticketId: req.query.ticketId }).populate('userId', 'name').sort({ createdAt: 1 }));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { ticketId, text, parentId } = req.body;
    const acc = await access(ticketId, req.user.id);
    if (!acc) return res.status(403).json({ message: 'No access' });
    if (!can(acc.role, 'comment:create')) return res.status(403).json({ message: 'Not allowed for your role' });
    if (!text || !text.trim()) return res.status(400).json({ message: 'Text required' });
    const c = await Comment.create({ ticketId, text: text.trim(), parentId: parentId || null, userId: req.user.id });
    emit(acc.ticket.projectId, 'comment:changed', { ticketId });
    res.status(201).json(await Comment.findById(c._id).populate('userId', 'name'));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const c = await Comment.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Not found' });
    if (!c.userId.equals(req.user.id)) return res.status(403).json({ message: 'Not your comment' });
    await Comment.deleteMany({ $or: [{ _id: c._id }, { parentId: c._id }] });
    const t = await Ticket.findById(c.ticketId);
    if (t) emit(t.projectId, 'comment:changed', { ticketId: c.ticketId });
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;