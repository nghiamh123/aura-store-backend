import { Router } from 'express';
import { z } from 'zod';

const router = Router();

type OrderItem = { productId: number; quantity: number; price: number };
type Order = { id: string; userId: string; items: OrderItem[]; total: number; status: string };
let orders: Order[] = [];

router.get('/', (req, res) => {
  const userId = (req.query.userId as string) || 'demo-user';
  res.json({ orders: orders.filter((o) => o.userId === userId) });
});

const createSchema = z.object({
  userId: z.string().min(1).optional(),
  items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().positive(), price: z.number().int().positive() }))
});

router.post('/', (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const userId = parsed.data.userId || 'demo-user';
  const total = parsed.data.items.reduce((s, it) => s + it.price * it.quantity, 0);
  const order: Order = { id: `AURA-${Math.random().toString(36).slice(2,8).toUpperCase()}`, userId, items: parsed.data.items, total, status: 'CONFIRMED' };
  orders.push(order);
  res.status(201).json({ order });
});

export default router;
