import { Router } from 'express';

const router = Router();
const wishlists: Record<string, number[]> = {};

function getUserId(q: any) { return (q.userId as string) || 'demo-user'; }

router.get('/', (req, res) => {
  const userId = getUserId(req.query);
  res.json({ productIds: wishlists[userId] || [] });
});

router.post('/', (req, res) => {
  const userId = getUserId(req.query);
  const { productId } = req.body as { productId: number };
  if (!productId) return res.status(400).json({ error: 'productId required' });
  const arr = wishlists[userId] || (wishlists[userId] = []);
  if (!arr.includes(productId)) arr.push(productId);
  res.json({ productIds: arr });
});

router.delete('/', (req, res) => {
  const userId = getUserId(req.query);
  const pid = Number(req.query.productId);
  if (!pid) return res.status(400).json({ error: 'productId required' });
  const arr = wishlists[userId] || (wishlists[userId] = []);
  wishlists[userId] = arr.filter((id) => id !== pid);
  res.json({ productIds: wishlists[userId] });
});

export default router;
