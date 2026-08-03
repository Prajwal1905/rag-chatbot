import { Router } from 'express';
import prisma from '../config/prisma';
import { sendAIRequest } from '../services/redisRequest.service';

const router = Router();

router.post('/ask', async (req, res) => {
  try {
    const { question, sessionId, chatHistory } = req.body;

    if (!question || !sessionId) {
      return res.status(400).json({ error: 'question and sessionId are required' });
    }

    const aiResponse = await sendAIRequest('chat', {
      question,
      chatHistory: chatHistory || [],
    });

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

  if (!question || !sessionId) {
    res.status(400).json({ error: 'question and sessionId are required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const aiResponse = await sendAIRequest('chat', {
      question,
      chatHistory: chatHistory || [],
    });

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
      await new Promise((r) => setTimeout(r, 30)); // typing speed
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

export default router;