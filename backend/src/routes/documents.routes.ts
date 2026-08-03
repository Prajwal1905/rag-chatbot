import { Router } from 'express';
import multer from 'multer';
import prisma from '../config/prisma';
import { sendAIRequest } from '../services/redisRequest.service';
import { authMiddleware } from '../middleware/auth.middleware';
import fs from 'fs';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// Upload PDF
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
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

    // Read file as base64 to send through Redis (no shared filesystem between services)
    const fileBuffer = fs.readFileSync(req.file.path);
    const fileBase64 = fileBuffer.toString('base64');

    const aiResponse = await sendAIRequest('upload', {
      documentId: document.id,
      fileName: req.file.originalname,
      fileBase64,
    });

    fs.unlinkSync(req.file.path); // cleanup temp upload

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

// List PDFs
router.get('/', authMiddleware, async (req, res) => {
  const documents = await prisma.document.findMany({ orderBy: { uploadDate: 'desc' } });
  res.json(documents);
});

// Delete PDF
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    await sendAIRequest('delete', { documentId: id });

    await prisma.document.delete({ where: { id } });
    res.json({ status: 'deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Reprocess PDF (re-trigger embedding — simple version: mark for reprocessing)
router.post('/:id/reprocess', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.document.update({
      where: { id },
      data: { processingStatus: 'processing' },
    });
    // In a full implementation, you'd re-fetch the original file and resend to AI service.
    // For now this marks status; extend later if time permits.
    res.json({ status: 'reprocessing_triggered' });
  } catch (err) {
    res.status(500).json({ error: 'Reprocess failed' });
  }
});

export default router;