import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';
import cartRoutes from './routes/cart';
import wishlistRoutes from './routes/wishlist';
import uploadRoutes from './routes/uploads';
import postRoutes from './routes/posts';

dotenv.config();
const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

const PORT = process.env.PORT || 4000 as number;

app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);
app.use('/cart', cartRoutes);
app.use('/wishlist', wishlistRoutes);
app.use('/uploads', uploadRoutes);
app.use('/posts', postRoutes);

// Basic error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
