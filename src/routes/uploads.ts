import { Router } from 'express';
import { z } from 'zod';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';

const router = Router();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
});

const schema = z.object({ filename: z.string().min(1) });

router.post('/presign', async (req, res) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { filename } = parsed.data;
    const bucket = process.env.S3_BUCKET as string;
    if (!bucket) return res.status(500).json({ error: 'S3 bucket not configured' });

    const key = `uploads/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const presigned = await createPresignedPost(s3, {
      Bucket: bucket,
      Key: key,
      Conditions: [
        ['content-length-range', 0, 10 * 1024 * 1024]
      ],
      Expires: 60,
    });

    const baseUrl = (process.env.S3_PUBLIC_BASE_URL || '').replace(/\/$/, '');
    const finalUrl = baseUrl ? `${baseUrl}/${key}` : undefined;

    return res.json({ url: presigned.url, fields: presigned.fields, key, finalUrl });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Failed to presign' });
  }
});

export default router;
