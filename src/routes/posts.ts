import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient, PostStatus } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

const saveSchema = z.object({
  title: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  excerpt: z.string().min(2),
  content: z.string().min(2),
  coverImage: z.string().url().optional(),
  images: z.array(z.string().url()).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
  publishedAt: z.string().datetime().optional(),
});

router.get('/', async (_req, res) => {
  const posts = await prisma.post.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ posts });
});

router.get('/:slug', async (req, res) => {
  const { slug } = req.params;
  const post = await prisma.post.findUnique({ where: { slug } });
  if (!post) return res.status(404).json({ error: 'Not found' });
  res.json({ post });
});

router.post('/', async (req, res) => {
  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const data = parsed.data;
  try {
    const created = await prisma.post.create({
      data: {
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt,
        content: data.content,
        coverImage: data.coverImage,
        images: data.images ?? [],
        tags: data.tags ?? [],
        status: (data.status as PostStatus) ?? PostStatus.DRAFT,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
      },
    });
    res.status(201).json({ post: created });
  } catch (e) {
    res.status(400).json({ error: 'Failed to create post' });
  }
});

router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  const parsed = saveSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;
  try {
    const updated = await prisma.post.update({
      where: { id },
      data: {
        ...data,
        status: data.status ? (data.status as PostStatus) : undefined,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : undefined,
      },
    });
    res.json({ post: updated });
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    await prisma.post.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(404).json({ error: 'Not found' });
  }
});

export default router;


