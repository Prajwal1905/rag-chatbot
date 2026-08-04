import { Router } from 'express';
import multer from 'multer';
import prisma from '../config/prisma';
import { sendAIRequest } from '../services/redisRequest.service';
import { authMiddleware } from '../middleware/auth.middleware';
import fs from 'fs';

const router = Router();

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed'));
    }
    cb(null, true);
  },
});

// Upload PDF
router.post('/upload', authMiddleware, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload error' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const document = await prisma.document.create({
      data: {
        fileName: req.file.originalname,
        processingStatus: 'processing',
      },
    });

    const fileBuffer = fs.readFileSync(req.file.path);
    const fileBase64 = fileBuffer.toString('base64');

    let aiResponse;
    try {
      aiResponse = await sendAIRequest('upload', {
        documentId: document.id,
        fileName: req.file.originalname,
        fileBase64,
      });
    } catch (aiErr: any) {
      fs.unlinkSync(req.file.path);
      await prisma.document.update({
        where: { id: document.id },
        data: { processingStatus: 'failed' },
      });
      return res.status(503).json({
        error: 'AI service is unavailable or timed out. Please ensure python-ai is running.',
      });
    }

    fs.unlinkSync(req.file.path);

    if (aiResponse.error) {
      await prisma.document.update({
        where: { id: document.id },
        data: { processingStatus: 'failed' },
      });
      return res.status(500).json({ error: aiResponse.error });
    }

    const updated = await prisma.document.update({
      where: { id: document.id },
      data: {
        processingStatus: 'processed',
        chunksCreated: aiResponse.chunksCreated,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// List PDFs (with optional search)
router.get('/', authMiddleware, async (req, res) => {
  const { search } = req.query;
  const documents = await prisma.document.findMany({
    where: search
      ? { fileName: { contains: String(search), mode: 'insensitive' } }
      : undefined,
    orderBy: { uploadDate: 'desc' },
  });
  res.json(documents);
});

// Delete PDF
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.document.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Document not found' });
    }

    try {
      await sendAIRequest('delete', { documentId: id });
    } catch (aiErr) {
      console.warn('AI service unreachable during delete, removing from DB anyway');
    }

    await prisma.document.delete({ where: { id } });
    res.json({ status: 'deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

router.post('/:id/reprocess', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.document.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Document not found' });
    }
    await prisma.document.update({
      where: { id },
      data: { processingStatus: 'processing' },
    });
    res.json({ status: 'reprocessing_triggered' });
  } catch (err) {
    res.status(500).json({ error: 'Reprocess failed' });
  }
});

export default router;