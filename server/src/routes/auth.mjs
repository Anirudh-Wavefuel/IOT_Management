import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { signToken, requireAuth } from '../auth.mjs';
import { prisma } from '../prisma.mjs';

export const authRouter = Router();

const allowedRoles = ['admin', 'operator', 'base'];

function normalizeRole(role) {
  const value = typeof role === 'string' ? role.toLowerCase() : '';
  if (allowedRoles.includes(value)) return value;
  return null;
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: normalizeRole(row.role) || 'base',
  };
}

authRouter.post('/signup', async (req, res) => {
  const { email, password, name, role: requestedRole } = req.body ?? {};
  if (!email || !password || !name) return res.status(400).json({ error: 'email, password, name are required' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const normalizedRole = normalizeRole(requestedRole);
  if (!normalizedRole) {
    return res.status(400).json({ error: 'Invalid role. Allowed roles: admin, operator, base' });
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  try {
    const created = await prisma.user.create({
      data: {
        email: String(email).toLowerCase(),
        passwordHash,
        name: String(name),
        role: normalizedRole,
      },
      select: { id: true, email: true, name: true, role: true },
    });
    const user = publicUser(created);
    const token = signToken({ sub: user.id, role: user.role, email: user.email, name: user.name });
    return res.json({ token, user });
  } catch (e) {
    if (e?.code === 'P2002') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    return res.status(500).json({ error: String(e?.message ?? e) });
  }
});

authRouter.post('/login', async (req, res) => {
  const { email, password, role: requestedRole } = req.body ?? {};
  if (!email || !password || !requestedRole) return res.status(400).json({ error: 'email, password, and role are required' });

  const normalizedRequested = normalizeRole(requestedRole);
  if (!normalizedRequested) {
    return res.status(400).json({ error: 'Invalid role. Allowed roles: admin, operator, base' });
  }

  const row = await prisma.user.findUnique({
    where: { email: String(email).toLowerCase() },
    select: { id: true, email: true, passwordHash: true, name: true, role: true },
  });
  if (!row) return res.status(401).json({ error: 'Invalid email or password' });

  const ok = await bcrypt.compare(String(password), row.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

  const user = publicUser(row);

  // Enforce role-specific login
  if (normalizedRequested !== user.role) {
    return res.status(401).json({ error: 'Role mismatch for this account' });
  }

  const token = signToken({ sub: user.id, role: user.role, email: user.email, name: user.name });
  return res.json({ token, user });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!row) return res.status(401).json({ error: 'Unauthorized' });
  return res.json({ user: publicUser(row) });
});



