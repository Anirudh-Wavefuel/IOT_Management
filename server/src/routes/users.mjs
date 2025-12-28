import { Router } from 'express';
import { requireAuth, requireRole } from '../auth.mjs';
import { prisma } from '../prisma.mjs';

const allowedRoles = ['admin', 'operator', 'base'];

function normalizeRole(role) {
  const value = typeof role === 'string' ? role.toLowerCase() : '';
  if (allowedRoles.includes(value)) return value;
  return 'base';
}

export const usersRouter = Router();

usersRouter.get('/', requireAuth, requireRole(['admin']), async (_req, res) => {
  const rows = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, email: true, role: true },
  });
  const users = rows.map(row => ({ ...row, role: normalizeRole(row.role) }));
  return res.json({ users });
});



