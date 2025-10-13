import { Router } from 'express';
import { z } from 'zod';

const router = Router();

type Product = { id: number; name: string; description: string; price: number; category: string; image?: string };
let products: Product[] = [
  { id: 1, name: 'Đồng hồ nam sang trọng', description: 'Thiết kế hiện đại', price: 299000, category: 'watches', image: '/api/placeholder/300/300' },
  { id: 2, name: 'Túi xách nữ thời trang', description: 'Phong cách trẻ trung', price: 199000, category: 'bags', image: '/api/placeholder/300/300' },
];
let lastId = products.length;

router.get('/', (_req, res) => {
  res.json({ products });
});

const saveSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(2),
  price: z.number().int().positive(),
  category: z.string().min(2),
  image: z.string().url().optional(),
});

router.post('/', (req, res) => {
  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const id = ++lastId;
  const p: Product = { id, ...parsed.data };
  products.push(p);
  res.status(201).json({ product: p });
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const p = products.find((x) => x.id === id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json({ product: p });
});

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const idx = products.findIndex((x) => x.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const parsed = saveSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  products[idx] = { ...products[idx], ...parsed.data };
  res.json({ product: products[idx] });
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const before = products.length;
  products = products.filter((x) => x.id !== id);
  if (products.length === before) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
