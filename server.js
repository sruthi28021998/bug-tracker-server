require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const { init } = require('./socket');

const app = express();
const server = http.createServer(app);
connectDB();
init(server);

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.get('/', (req, res) => res.send('API running'));

server.listen(process.env.PORT || 5000, () => console.log('Server running'));