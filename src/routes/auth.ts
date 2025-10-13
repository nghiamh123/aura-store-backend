import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

const router = Router();

const loginSchema = z.object({ username: z.string(), password: z.string() });

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { username, password } = parsed.data;

  // Demo: accept admin/admin123. Replace with DB check.
  if (!(username === 'admin' && password === 'admin123')) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ sub: 'admin', role: 'ADMIN' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
  return res.json({ token });
});

router.get('/me', (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    return res.json({ user: payload });
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
});

export default router;
