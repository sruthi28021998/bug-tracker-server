const mongoose = require('mongoose');

module.exports = mongoose.model('Project', new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  teamMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  roles: { type: Object, default: {} }, // { userId: 'manager' | 'developer' | 'viewer' }
}, { timestamps: true }));