import express from 'express';
import cors from 'cors';
import memeRoutes from './routes/memeRoutes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Meme Lab backend is running' });
});

app.use('/api/memes', memeRoutes);

export default app;
