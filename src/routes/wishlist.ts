import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const router = Router();

/**
 * Middleware để lấy userId từ JWT cookie
 * Yêu cầu user phải đăng nhập
 */
function requireAuth(req: any, res: any, next: any) {
  try {
    const token = req.cookies?.customerAuth || '';
    if (!token) {
      return res.status(401).json({ error: 'Chưa đăng nhập. Vui lòng đăng nhập để sử dụng wishlist.' });
    }
    
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { sub: string };
    req.userId = payload.sub;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.' });
  }
}

/**
 * GET /wishlist
 * Lấy wishlist của user đã đăng nhập
 */
router.get('/', requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    
    // Get or create wishlist for user
    let wishlist = await prisma.wishlist.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } }
    });
    
    if (!wishlist) {
      // Tạo wishlist mới cho user nếu chưa có
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
        images: item.product.images,
        category: item.product.category,
        badge: item.product.badge,
        rating: item.product.rating,
        reviewCount: item.product.reviewCount,
        material: item.product.material,
        size: item.product.size,
        color: item.product.color,
        warranty: item.product.warranty,
        addedAt: item.product.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
});

/**
 * POST /wishlist
 * Thêm sản phẩm vào wishlist của user đã đăng nhập
 */
router.post('/', requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { productId } = req.body as { productId: number };
    
    if (!productId) return res.status(400).json({ error: 'productId required' });
    
    // Get or create wishlist
    let wishlist = await prisma.wishlist.findUnique({ where: { userId } });
    if (!wishlist) {
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

/**
 * DELETE /wishlist
 * Xóa sản phẩm khỏi wishlist của user đã đăng nhập
 */
router.delete('/', requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
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

/**
 * DELETE /wishlist/clear
 * Xóa tất cả sản phẩm khỏi wishlist của user đã đăng nhập
 */
router.delete('/clear', requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    
    const wishlist = await prisma.wishlist.findUnique({ where: { userId } });
    if (!wishlist) {
      return res.status(404).json({ error: 'Wishlist not found' });
    }
    
    await prisma.wishlistItem.deleteMany({
      where: { wishlistId: wishlist.id }
    });
    
    res.json({ message: 'Wishlist cleared' });
  } catch (error) {
    console.error('Error clearing wishlist:', error);
    res.status(500).json({ error: 'Failed to clear wishlist' });
  }
});

export default router;
