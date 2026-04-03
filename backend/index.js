require('dotenv').config();
const express = require('express');
const cors = require('cors');

const leadsRouter = require('./routes/leads');
const enrichRouter = require('./routes/enrich');
const aiRouter = require('./routes/ai');
const exportRouter = require('./routes/export');
const importRouter = require('./routes/import');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5174',
    'https://digitalclod-prospector.vercel.app',
    /\.vercel\.app$/,
  ],
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use('/api/leads', leadsRouter);
app.use('/api/enrich', enrichRouter);
app.use('/api/ai', aiRouter);
app.use('/api/export', exportRouter);
app.use('/api/import', importRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => console.log(`DigitalClod Prospector backend running on port ${PORT}`));
