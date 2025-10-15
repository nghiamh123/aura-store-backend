import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const router = Router();
async function sendOrderEmail(to: string, orderId: string, total: number) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM || 'Aura <no-reply@aura-store.vn>';
    if (!apiKey) return; // silently skip if not configured

    const subject = `Xác nhận đơn hàng #${orderId}`;
    const html = `
      <div style="font-family:Arial, sans-serif;line-height:1.5;color:#111">
        <h2>Cảm ơn bạn đã đặt hàng tại Aura!</h2>
        <p>Mã đơn hàng của bạn: <strong>${orderId}</strong></p>
        <p>Tổng tiền: <strong>${(total || 0).toLocaleString('vi-VN')}₫</strong></p>
        <p>Bạn có thể theo dõi đơn hàng tại: <a href="${process.env.FRONTEND_BASE_URL || 'http://localhost:3000'}/track">Trang theo dõi</a></p>
        <p>Nếu có thắc mắc, vui lòng phản hồi email này.</p>
      </div>
    `;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, to, subject, html })
    });
  } catch {
    // ignore email failures
  }
}


const createOrderSchema = z.object({
  customerInfo: z.object({
    fullName: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().min(1),
  }),
  shippingInfo: z.object({
    address: z.string().min(1),
    ward: z.string().min(1),
    district: z.string().min(1),
    city: z.string().min(1),
    note: z.string().optional(),
  }),
  paymentMethod: z.string().min(1),
  items: z.array(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().positive(),
    price: z.number().int().positive(),
  })),
  total: z.number().int().positive(),
  shippingFee: z.number().int().min(0),
  discount: z.number().int().min(0),
});

router.get('/', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ orders });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get current user's orders (requires customerAuth cookie)
router.get('/me', async (req, res) => {
  try {
    const token = (req as any).cookies?.customerAuth || '';
    if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' });
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { sub: string };
    const orders = await prisma.order.findMany({
      where: { userId: payload.sub },
      include: {
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ orders });
  } catch (e) {
    return res.status(401).json({ error: 'Không hợp lệ' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

router.post('/', async (req, res) => {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { customerInfo, shippingInfo, paymentMethod, items, total, shippingFee, discount } = parsed.data;

    // Resolve user from customerAuth cookie; fallback to guest-user
    let userId: string | null = null;
    try {
      const token = (req as any).cookies?.customerAuth || '';
      if (token) {
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { sub: string };
        userId = payload.sub;
      }
    } catch {}

    if (!userId) {
      // Create or get guest user
      let guestUser = await prisma.user.findUnique({ where: { id: 'guest-user' } });
      if (!guestUser) {
        guestUser = await prisma.user.create({
          data: {
            id: 'guest-user',
            email: 'guest@aura.com',
            name: 'Guest User',
            password: 'guest-password',
          }
        });
      }
      userId = guestUser.id;
    }

    // Create order with items
    const order = await prisma.order.create({
      data: {
        userId: userId,
        total,
        status: 'CONFIRMED',
        items: {
          create: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Fire-and-forget email confirmation
    if (customerInfo?.email) {
      void sendOrderEmail(customerInfo.email, order.id, total);
    }

    res.status(201).json({ order });
  } catch (error) {
    console.error('Error creating order:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ error: 'Failed to create order', details: error.message });
  }
});

// Track order by order number
router.get('/track/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    // Fallback: use id until DB schema includes orderNumber
    const order = await prisma.order.findUnique({
      where: { id: orderNumber },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order });
  } catch (error) {
    console.error('Error tracking order:', error);
    res.status(500).json({ error: 'Failed to track order' });
  }
});

// Update order status (admin only)
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, trackingNumber, notes } = req.body;

    const validStatuses = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await prisma.order.update({
      where: { id },
      data: {
        status,
        trackingNumber: trackingNumber || null,
        notes: notes || null,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    res.json({ order });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Link guest orders (same email) to logged-in account
router.post('/link-guest-to-account', async (req, res) => {
  try {
    const token = (req as any).cookies?.customerAuth || '';
    if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' });
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { sub: string };
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ error: 'Không hợp lệ' });

    // Find guest orders with matching email in customerInfo
    const guestOrders = await prisma.order.findMany({ where: { userId: 'guest-user' } });
    const toLink = guestOrders.filter(o => {
      try {
        const info = (o as any).customerInfo as any;
        return info && typeof info.email === 'string' && info.email.toLowerCase() === (user.email || '').toLowerCase();
      } catch {
        return false;
      }
    });

    for (const o of toLink) {
      await prisma.order.update({ where: { id: o.id }, data: { userId: user.id } });
    }

    return res.json({ linked: toLink.length });
  } catch {
    return res.status(500).json({ error: 'Không thể liên kết đơn hàng' });
  }
});

export default router;
