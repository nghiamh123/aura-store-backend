import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

const saveSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(2).default(''),
  detailedDescription: z.string().optional(),
  price: z.number().int().positive(),
  originalPrice: z.number().int().positive().optional(),
  category: z.string().min(1),
  badge: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().min(0).optional(),
  material: z.string().optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  warranty: z.string().optional(),
  status: z.string().default('active'),
  image: z.string().url().optional(),
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
  console.log('DELETE request for product ID:', id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    // Check if product exists first
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      console.log('Product not found:', id);
      return res.status(404).json({ error: 'Not found' });
    }
    
    // Check if product is used in any orders
    const orderItems = await prisma.orderItem.findMany({ where: { productId: id } });
    if (orderItems.length > 0) {
      console.log('Product is used in orders, cannot delete');
      return res.status(400).json({ error: 'Cannot delete product that is used in orders' });
    }
    
    console.log('Deleting product:', product.name);
    await prisma.product.delete({ where: { id } });
    console.log('Product deleted successfully');
    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

export default router;
