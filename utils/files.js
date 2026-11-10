const fs = require('fs');
const path = require('path');

exports.removeFiles = (attachments = []) =>
  attachments.forEach((a) => fs.unlink(path.join(__dirname, '..', 'uploads', a.filename), () => {}));