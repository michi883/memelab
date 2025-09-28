import { Router } from 'express';
import { getTrendingMeme, analyzeMeme, remixMeme } from './memes.js';

const router = Router();

router.get('/trending', getTrendingMeme);
router.post('/analyze', analyzeMeme);
router.post('/remix', remixMeme);

export default router;
