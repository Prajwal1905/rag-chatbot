'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { askQuestion, ChatSource } from '@/lib/api';
import { getSessionId } from '@/lib/session';
import { askQuestionStream, ChatSource } from '@/lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  suggestedQuestions?: string[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(question: string) {
  if (!question.trim() || loading) return;

  const newUserMessage: Message = { role: 'user', content: question };
  setMessages((prev) => [...prev, newUserMessage, { role: 'assistant', content: '' }]);
  setInput('');
  setLoading(true);

  const history = messages
    .filter((m) => m.role === 'user')
    .map((m) => ({
      question: m.content,
      answer: messages[messages.indexOf(m) + 1]?.content || '',
    }));

  await askQuestionStream(
    question,
    sessionId,
    history,
    (chunk) => {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: updated[updated.length - 1].content + chunk,
        };
        return updated;
      });
    },
    (sources, suggestedQuestions) => {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          sources,
          suggestedQuestions,
        };
        return updated;
      });
      setLoading(false);
    },
    (error) => {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: ` Error: ${error}`,
        };
        return updated;
      });
      setLoading(false);
    }
  );
}

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto bg-white">
     
      <header className="border-b px-4 py-3 shrink-0">
        <h1 className="text-lg font-semibold">Knowledge Base Assistant</h1>
        <p className="text-sm text-gray-500">Ask questions based on uploaded documents</p>
      </header>

      
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <p> Ask me anything about the uploaded documents.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-900 rounded-bl-sm'
              }`}
            >
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </div>

              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-300 text-xs text-gray-600 space-y-1">
                  <p className="font-medium">Sources:</p>
                  {Array.from(new Set(msg.sources.map((s) => `${s.file_name}::${s.page}`))).map(
                    (key, idx) => {
                      const [file_name, page] = key.split('::');
                      return (
                        <p key={idx}>
                           {file_name} {page !== 'null' ? `(page ${Number(page) + 1})` : ''}
                        </p>
                      );
                    }
                  )}
                </div>
              )}

              {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-300">
                  <p className="text-xs font-medium text-gray-600 mb-2">Suggested Questions:</p>
                  <div className="flex flex-col gap-1.5">
                    {msg.suggestedQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => sendMessage(q)}
                        className="text-left text-sm text-blue-600 hover:underline"
                      >
                        • {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

     
      <div className="border-t p-4 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            className="flex-1 border rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-blue-600 text-white rounded-full px-5 py-2 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}