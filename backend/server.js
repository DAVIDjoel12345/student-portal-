require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { getDb, closeDb } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));

app.get('/', (req, res) => res.json({ 
  name: 'Secure Student Academic Record Portal API',
  version: '1.0.0',
  status: 'running',
  endpoints: {
    health: '/api/health',
    auth: '/api/auth',
    records: '/api/records',
    admin: '/api/admin',
    student: '/api/student'
  }
}));

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/records', require('./routes/recordRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/student', require('./routes/studentRoutes'));

app.use((err, req, res, next) => { console.error(err.stack); res.status(500).json({ error: 'Internal server error' }); });

const server = app.listen(PORT, () => { getDb(); console.log(`Server running on port ${PORT}`); });

const shutdown = () => { server.close(() => { closeDb(); process.exit(0); }); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = app;
