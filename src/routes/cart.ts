import { Router } from 'express';
import { z } from 'zod';

const router = Router();

type CartItem = { productId: number; quantity: number };
const carts: Record<string, CartItem[]> = {};

function getUserId(q: any) { return (q.userId as string) || 'demo-user'; }

router.get('/', (req, res) => {
  const userId = getUserId(req.query);
  res.json({ items: carts[userId] || [] });
});

const addSchema = z.object({ productId: z.number().int().positive(), quantity: z.number().int().positive().optional() });
router.post('/', (req, res) => {
  const userId = getUserId(req.query);
  const parsed = addSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const q = parsed.data.quantity || 1;
  const arr = carts[userId] || (carts[userId] = []);
  const existing = arr.find((it) => it.productId === parsed.data.productId);
  if (existing) existing.quantity += q; else arr.push({ productId: parsed.data.productId, quantity: q });
  res.json({ items: arr });
});

const updateSchema = z.object({ productId: z.number().int().positive(), quantity: z.number().int() });
router.patch('/', (req, res) => {
  const userId = getUserId(req.query);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const arr = carts[userId] || (carts[userId] = []);
  const it = arr.find((x) => x.productId === parsed.data.productId);
  if (!it) return res.status(404).json({ error: 'Not in cart' });
  if (parsed.data.quantity <= 0) carts[userId] = arr.filter((x) => x.productId !== parsed.data.productId);
  else it.quantity = parsed.data.quantity;
  res.json({ items: carts[userId] });
});

router.delete('/', (req, res) => {
  const userId = getUserId(req.query);
  const pid = Number(req.query.productId);
  if (!pid) return res.status(400).json({ error: 'productId required' });
  const arr = carts[userId] || (carts[userId] = []);
  carts[userId] = arr.filter((x) => x.productId !== pid);
  res.json({ items: carts[userId] });
});

export default router;
