import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import schedulesRouter from './routes/schedules.js';
import bookingsRouter from './routes/bookings.js';
import adminRouter from './routes/admin.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/schedules', schedulesRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/admin', adminRouter);

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'server error' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API on http://localhost:${port}`));
