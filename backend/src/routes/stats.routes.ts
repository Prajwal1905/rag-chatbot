import { Router } from 'express';
import prisma from '../config/prisma';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const totalDocuments = await prisma.document.count();

    const totalQuestions = await prisma.chat.count();

    const sessions = await prisma.chat.findMany({
      select: { sessionId: true },
      distinct: ['sessionId'],
    });
    const totalChatSessions = sessions.length;

    const recentDocuments = await prisma.document.findMany({
      orderBy: { uploadDate: 'desc' },
      take: 5,
    });

    res.json({
      totalDocuments,
      totalChatSessions,
      totalQuestions,
      recentDocuments,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;