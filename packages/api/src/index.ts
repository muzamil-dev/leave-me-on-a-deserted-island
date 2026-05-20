import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import profileRoutes from './routes/profile';
import brokerRoutes from './routes/brokers';
import runRoutes from './routes/runs';
import discoveredRoutes from './routes/discovered';
import logRoutes from './routes/logs';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/profile', profileRoutes);
app.use('/api/brokers', brokerRoutes);
app.use('/api/runs', runRoutes);
app.use('/api/discovered', discoveredRoutes);
app.use('/api/logs', logRoutes);

app.listen(Number(port), '0.0.0.0', () => {
  console.log(`API Server running on 0.0.0.0:${port}`);
});
