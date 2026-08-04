import { Router } from 'express';
import prisma from '../config/prisma';
import { sendAIRequest } from '../services/redisRequest.service';

const router = Router();

router.post('/ask', async (req, res) => {
  try {
    const { question, sessionId, chatHistory } = req.body;

    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'question is required and cannot be empty' });
    }
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    if (question.length > 2000) {
      return res.status(400).json({ error: 'question is too long (max 2000 characters)' });
    }

    let aiResponse;
    try {
      aiResponse = await sendAIRequest('chat', {
        question,
        chatHistory: chatHistory || [],
      });
    } catch (err) {
      return res.status(503).json({ error: 'AI service unavailable or timed out' });
    }

    if (aiResponse.error) {
      return res.status(500).json({ error: aiResponse.error });
    }

    await prisma.chat.create({
      data: { sessionId, question, answer: aiResponse.answer },
    });

    res.json({
      answer: aiResponse.answer,
      sources: aiResponse.sources,
      suggestedQuestions: aiResponse.suggestedQuestions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Chat request failed' });
  }
});

router.post('/ask-stream', async (req, res) => {
  const { question, sessionId, chatHistory } = req.body;

  if (!question || typeof question !== 'string' || !question.trim()) {
    res.status(400).json({ error: 'question is required and cannot be empty' });
    return;
  }
  if (!sessionId || typeof sessionId !== 'string') {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }
  if (question.length > 2000) {
    res.status(400).json({ error: 'question is too long (max 2000 characters)' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    let aiResponse;
    try {
      aiResponse = await sendAIRequest('chat', {
        question,
        chatHistory: chatHistory || [],
      });
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'AI service unavailable or timed out' })}\n\n`);
      res.end();
      return;
    }

    if (aiResponse.error) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: aiResponse.error })}\n\n`);
      res.end();
      return;
    }

    await prisma.chat.create({
      data: { sessionId, question, answer: aiResponse.answer },
    });

    const words = aiResponse.answer.split(' ');
    for (let i = 0; i < words.length; i++) {
      const chunk = (i === 0 ? '' : ' ') + words[i];
      res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
      await new Promise((r) => setTimeout(r, 30));
    }

    res.write(
      `data: ${JSON.stringify({
        type: 'done',
        sources: aiResponse.sources,
        suggestedQuestions: aiResponse.suggestedQuestions,
      })}\n\n`
    );

    res.end();
  } catch (err) {
    console.error(err);
    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Chat request failed' })}\n\n`);
    res.end();
  }
});

router.get('/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const chats = await prisma.chat.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'asc' },
    });
    res.json(chats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

export default router;