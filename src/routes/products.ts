import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

const saveSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(2).default(''),
  price: z.number().int().positive(),
  category: z.string().min(1),
  image: z.string().url().optional(),
  originalPrice: z.number().int().positive().optional(),
  badge: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  reviews: z.number().int().min(0).optional(),
  images: z.array(z.string().url()).optional(),
});

router.get('/', async (_req, res) => {
  const products = await prisma.product.findMany({ orderBy: { id: 'desc' } });
  res.json({ products });
});

router.post('/', async (req, res) => {
  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const p = await prisma.product.create({ data: parsed.data });
  res.status(201).json({ product: p });
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json({ product: p });
});

router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  const parsed = saveSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const p = await prisma.product.update({ where: { id }, data: parsed.data });
    res.json({ product: p });
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    await prisma.product.delete({ where: { id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

export default router;
