require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const { init } = require('./socket');

const app = express();
const server = http.createServer(app);
connectDB();
init(server);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tickets', require('./routes/tickets'));
app.get('/', (req, res) => res.send('API running'));

app.use((err, req, res, next) => res.status(400).json({ message: err.message }));

server.listen(process.env.PORT || 5000, () => console.log('Server running'));