import { Router } from 'express';
import { getMemes, createMeme, getTrendingMeme, analyzeMeme, remixMeme } from './memes.js';

const router = Router();

router.get('/trending', getTrendingMeme);
router.post('/analyze', analyzeMeme);
router.post('/remix', remixMeme);
router.get('/', getMemes);
router.post('/', createMeme);

export default router;
