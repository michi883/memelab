import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import routes from './routes.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');

app.use(cors());
app.use(express.json());
app.use('/static', express.static(publicDir));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Meme Lab backend is running' });
});

app.use('/api/memes', routes);

export default app;
