import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectRedis } from './config/redis';
import authRoutes from './routes/auth.routes';
import documentsRoutes from './routes/documents.routes';
import chatRoutes from './routes/chat.routes';
import statsRoutes from './routes/stats.routes';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/stats', statsRoutes);
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
const PORT = process.env.PORT || 5000;

async function start() {
  await connectRedis();
  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
}

start();