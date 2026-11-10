const Project = require('../models/Project');

const PERMS = {
  admin: ['project:edit', 'project:delete', 'member:manage', 'ticket:create', 'ticket:edit', 'ticket:delete:any', 'comment:create'],
  manager: ['project:edit', 'member:manage', 'ticket:create', 'ticket:edit', 'ticket:delete:any', 'comment:create'],
  developer: ['ticket:create', 'ticket:edit', 'comment:create'],
  viewer: [],
};

const can = (role, perm) => PERMS[role].includes(perm);

const getAccess = async (projectId, userId) => {
  const project = await Project.findById(projectId);
  if (!project || !project.teamMembers.some((m) => m.equals(userId))) return null;
  const role = project.owner.equals(userId) ? 'admin' : (project.roles || {})[String(userId)] || 'developer';
  return { project, role };
};

const projectGuard = (perm) => async (req, res, next) => {
  try {
    const acc = await getAccess(req.params.id, req.user.id);
    if (!acc) return res.status(403).json({ message: 'No access' });
    if (perm && !can(acc.role, perm)) return res.status(403).json({ message: 'Not allowed for your role' });
    req.acc = acc;
    next();
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = { can, getAccess, projectGuard };