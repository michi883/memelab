import { Router } from 'express';
import { getMemes, createMeme, getTrendingMeme, analyzeMeme } from './memeController.js';

const router = Router();

router.get('/trending', getTrendingMeme);
router.post('/analyze', analyzeMeme);
router.get('/', getMemes);
router.post('/', createMeme);

export default router;
