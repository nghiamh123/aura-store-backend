import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const router = Router();
const prisma = new PrismaClient();

// ---------------- Customer Auth (JWT in httpOnly cookie) ----------------

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  avatar: z.string().url().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  dateOfBirth: z.string().datetime().optional(),
  address: z.string().optional(),
  ward: z.string().optional(),
  district: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
});

router.post('/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { name, email, password, phone, avatar, gender, dateOfBirth, address, ward, district, city, country, postalCode } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email đã được sử dụng' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: passwordHash,
        role: 'CUSTOMER',
        phone: phone || null,
        avatar: avatar || null,
        gender: (gender as any) || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        address: address || null,
        ward: ward || null,
        district: district || null,
        city: city || null,
        country: country || null,
        postalCode: postalCode || null,
      }
    });

    const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.cookie('customerAuth', token, {
      httpOnly: true,
      // Cross-site requests (frontend on different origin) need SameSite=None + Secure
      sameSite: 'none',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return res.status(201).json({ user: {
      id: user.id, name: user.name, email: user.email,
      phone: user.phone, avatar: user.avatar, gender: user.gender,
      dateOfBirth: user.dateOfBirth, address: user.address, ward: user.ward,
      district: user.district, city: user.city, country: user.country, postalCode: user.postalCode
    }});
  } catch (e) {
    return res.status(500).json({ error: 'Đăng ký thất bại' });
  }
});

const customerLoginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

router.post('/customer/login', async (req, res) => {
  try {
    const parsed = customerLoginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Sai email hoặc mật khẩu' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Sai email hoặc mật khẩu' });

    const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.cookie('customerAuth', token, {
      httpOnly: true,
      sameSite: 'none',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return res.json({ user: { id: user.id, name: user.name, email: user.email,
      phone: user.phone, avatar: user.avatar, gender: user.gender,
      dateOfBirth: user.dateOfBirth, address: user.address, ward: user.ward,
      district: user.district, city: user.city, country: user.country, postalCode: user.postalCode } });
  } catch (e) {
    return res.status(500).json({ error: 'Đăng nhập thất bại' });
  }
});

router.post('/customer/logout', (req, res) => {
  res.cookie('customerAuth', '', { httpOnly: true, maxAge: 0, path: '/' });
  return res.json({ ok: true });
});

router.get('/customer/me', async (req, res) => {
  try {
    const token = req.cookies?.customerAuth || '';
    if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' });
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { sub: string };
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ error: 'Không hợp lệ' });
    return res.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch {
    return res.status(401).json({ error: 'Không hợp lệ' });
  }
});

// Update customer profile (name/email)
const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  avatar: z.string().url().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  dateOfBirth: z.string().datetime().optional(),
  address: z.string().optional(),
  ward: z.string().optional(),
  district: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
});

router.patch('/customer/me', async (req, res) => {
  try {
    const token = req.cookies?.customerAuth || '';
    if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' });
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { sub: string };

    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { name, email, phone, avatar, gender, dateOfBirth, address, ward, district, city, country, postalCode } = parsed.data;

    if (email) {
      const exists = await prisma.user.findUnique({ where: { email } });
      if (exists && exists.id !== payload.sub) {
        return res.status(409).json({ error: 'Email đã được sử dụng' });
      }
    }

    const updated = await prisma.user.update({
      where: { id: payload.sub },
      data: {
        ...(name ? { name } : {}),
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        ...(avatar ? { avatar } : {}),
        ...(gender ? { gender: gender as any } : {}),
        ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) } : {}),
        ...(address ? { address } : {}),
        ...(ward ? { ward } : {}),
        ...(district ? { district } : {}),
        ...(city ? { city } : {}),
        ...(country ? { country } : {}),
        ...(postalCode ? { postalCode } : {}),
      }
    });

    return res.json({ user: { id: updated.id, name: updated.name, email: updated.email,
      phone: updated.phone, avatar: updated.avatar, gender: updated.gender,
      dateOfBirth: updated.dateOfBirth, address: updated.address, ward: updated.ward,
      district: updated.district, city: updated.city, country: updated.country, postalCode: updated.postalCode } });
  } catch {
    return res.status(500).json({ error: 'Cập nhật hồ sơ thất bại' });
  }
});

// Change password
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

router.post('/customer/change-password', async (req, res) => {
  try {
    const token = req.cookies?.customerAuth || '';
    if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' });
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { sub: string };

    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { currentPassword, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ error: 'Không hợp lệ' });

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) return res.status(401).json({ error: 'Mật khẩu hiện tại không đúng' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: passwordHash } });

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Đổi mật khẩu thất bại' });
  }
});

// ---------------- Admin Auth (existing demo) ----------------
const loginSchema = z.object({ username: z.string(), password: z.string() });

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { username, password } = parsed.data;

  // Demo: accept admin/admin123. Replace with DB check.
  if (!(username === 'admin' && password === 'admin123')) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ sub: 'admin', role: 'ADMIN' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
  return res.json({ token });
});

router.get('/me', (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    return res.json({ user: payload });
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
});

export default router;
