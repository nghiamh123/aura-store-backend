import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

function getUserId(q: any) { return (q.userId as string) || 'guest-user'; }

router.get('/', async (req, res) => {
  try {
    const userId = getUserId(req.query);
    
    // Get or create wishlist for user
    let wishlist = await prisma.wishlist.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } }
    });
    
    if (!wishlist) {
      // Create guest user if not exists
      let user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user && userId === 'guest-user') {
        user = await prisma.user.create({
          data: {
            id: 'guest-user',
            email: 'guest@aura.com',
            name: 'Guest User',
            password: 'guest-password',
          }
        });
      }
      
      wishlist = await prisma.wishlist.create({
        data: { userId },
        include: { items: { include: { product: true } } }
      });
    }
    
    res.json({ 
      productIds: wishlist.items.map(item => item.productId),
      items: wishlist.items.map(item => ({
        id: item.productId,
        name: item.product.name,
        description: item.product.description,
        price: item.product.price,
        originalPrice: item.product.originalPrice,
        image: item.product.image,
        category: item.product.category,
        badge: item.product.badge,
        rating: item.product.rating,
        reviewCount: item.product.reviewCount,
        material: item.product.material,
        size: item.product.size,
        color: item.product.color,
        warranty: item.product.warranty,
        addedAt: item.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = getUserId(req.query);
    const { productId } = req.body as { productId: number };
    
    if (!productId) return res.status(400).json({ error: 'productId required' });
    
    // Get or create wishlist
    let wishlist = await prisma.wishlist.findUnique({ where: { userId } });
    if (!wishlist) {
      // Create guest user if not exists
      let user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user && userId === 'guest-user') {
        user = await prisma.user.create({
          data: {
            id: 'guest-user',
            email: 'guest@aura.com',
            name: 'Guest User',
            password: 'guest-password',
          }
        });
      }
      
      wishlist = await prisma.wishlist.create({ data: { userId } });
    }
    
    // Check if item already exists
    const existingItem = await prisma.wishlistItem.findFirst({
      where: { wishlistId: wishlist.id, productId }
    });
    
    if (existingItem) {
      return res.json({ message: 'Item already in wishlist' });
    }
    
    // Add item to wishlist
    await prisma.wishlistItem.create({
      data: { wishlistId: wishlist.id, productId }
    });
    
    res.json({ message: 'Item added to wishlist' });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({ error: 'Failed to add to wishlist' });
  }
});

router.delete('/', async (req, res) => {
  try {
    const userId = getUserId(req.query);
    const productId = Number(req.query.productId);
    
    if (!productId) return res.status(400).json({ error: 'productId required' });
    
    const wishlist = await prisma.wishlist.findUnique({ where: { userId } });
    if (!wishlist) {
      return res.status(404).json({ error: 'Wishlist not found' });
    }
    
    await prisma.wishlistItem.deleteMany({
      where: { wishlistId: wishlist.id, productId }
    });
    
    res.json({ message: 'Item removed from wishlist' });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({ error: 'Failed to remove from wishlist' });
  }
});

export default router;
