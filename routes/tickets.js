const router = require('express').Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const { can, getAccess } = require('../middleware/access');
const { emit } = require('../socket');
const { removeFiles } = require('../utils/files');
const Ticket = require('../models/Ticket');

const populate = (q) => q.populate('assignee', 'name email').populate('reporter', 'name email');
const rank = { low: 1, medium: 2, high: 3 };

const loadTicket = async (req, res, next) => {
  try {
    const t = await Ticket.findById(req.params.id);
    if (!t) return res.status(404).json({ message: 'Not found' });
    const acc = await getAccess(t.projectId, req.user.id);
    if (!acc) return res.status(403).json({ message: 'No access' });
    req.ticket = t;
    req.acc = acc;
    next();
  } catch (e) { res.status(500).json({ message: e.message }); }
};

const needEdit = (req, res, next) =>
  can(req.acc.role, 'ticket:edit') ? next() : res.status(403).json({ message: 'Not allowed for your role' });

router.get('/', auth, async (req, res) => {
  try {
    const { projectId, status, priority, assignee, search, sort } = req.query;
    if (!(await getAccess(projectId, req.user.id))) return res.status(403).json({ message: 'No access' });
    const q = { projectId };
    if (status) q.status = status;
    if (priority) q.priority = priority;
    if (assignee) q.assignee = assignee === 'unassigned' ? null : assignee;
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      q.$or = [{ title: re }, { description: re }];
    }
    const tickets = await populate(Ticket.find(q).sort({ createdAt: sort === 'oldest' ? 1 : -1 }));
    if (sort === 'priority') tickets.sort((a, b) => rank[b.priority] - rank[a.priority]);
    res.json(tickets);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { title, description, type, priority, status, assignee, projectId } = req.body;
    const acc = await getAccess(projectId, req.user.id);
    if (!acc) return res.status(403).json({ message: 'No access' });
    if (!can(acc.role, 'ticket:create')) return res.status(403).json({ message: 'Not allowed for your role' });
    if (!title) return res.status(400).json({ message: 'Title required' });
    if (assignee && !acc.project.teamMembers.some((m) => m.equals(assignee)))
      return res.status(400).json({ message: 'Assignee must be a project member' });
    const t = await Ticket.create({
      title, description, type, priority, status,
      assignee: assignee || null, reporter: req.user.id, projectId,
    });
    emit(projectId, 'ticket:changed', { ticketId: t._id });
    res.status(201).json(await populate(Ticket.findById(t._id)));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put('/:id', auth, loadTicket, needEdit, async (req, res) => {
  try {
    const t = req.ticket;
    const { assignee } = req.body;
    if (assignee && !req.acc.project.teamMembers.some((m) => m.equals(assignee)))
      return res.status(400).json({ message: 'Assignee must be a project member' });
    ['title', 'description', 'type', 'priority', 'status'].forEach((k) => {
      if (req.body[k] !== undefined) t[k] = req.body[k];
    });
    if (assignee !== undefined) t.assignee = assignee || null;
    await t.save();
    emit(t.projectId, 'ticket:changed', { ticketId: t._id });
    res.json(await populate(Ticket.findById(t._id)));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete('/:id', auth, loadTicket, async (req, res) => {
  try {
    const t = req.ticket;
    const { role } = req.acc;
    const allowed = can(role, 'ticket:delete:any') || (role !== 'viewer' && t.reporter.equals(req.user.id));
    if (!allowed) return res.status(403).json({ message: 'Only reporter, manager or admin can delete' });
    removeFiles(t.attachments);
    await t.deleteOne();
    emit(t.projectId, 'ticket:changed', { ticketId: t._id });
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/:id/attachments', auth, loadTicket, needEdit, upload.array('files', 5), async (req, res) => {
  try {
    const t = req.ticket;
    t.attachments.push(...req.files.map((f) => ({ filename: f.filename, originalName: f.originalname })));
    await t.save();
    emit(t.projectId, 'ticket:changed', { ticketId: t._id });
    res.json(await populate(Ticket.findById(t._id)));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete('/:id/attachments/:fileId', auth, loadTicket, needEdit, async (req, res) => {
  try {
    const t = req.ticket;
    const a = t.attachments.id(req.params.fileId);
    if (!a) return res.status(404).json({ message: 'Attachment not found' });
    removeFiles([a]);
    t.attachments.pull(req.params.fileId);
    await t.save();
    emit(t.projectId, 'ticket:changed', { ticketId: t._id });
    res.json(await populate(Ticket.findById(t._id)));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;