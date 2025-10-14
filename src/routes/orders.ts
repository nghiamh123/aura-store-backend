import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

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

    // Create or get guest user
    let guestUser = await prisma.user.findUnique({
      where: { id: 'guest-user' }
    });
    
    if (!guestUser) {
      guestUser = await prisma.user.create({
        data: {
          id: 'guest-user',
          email: 'guest@aura.com',
          name: 'Guest User',
          password: 'guest-password', // Temporary password for guest user
        }
      });
    }

    // Create order with items
    const order = await prisma.order.create({
      data: {
        userId: guestUser.id,
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

    res.status(201).json({ order });
  } catch (error) {
    console.error('Error creating order:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ error: 'Failed to create order', details: error.message });
  }
});

export default router;
