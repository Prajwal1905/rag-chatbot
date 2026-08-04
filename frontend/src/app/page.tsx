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
  <div className="flex flex-col h-screen w-full bg-white">

    <header className="border-b bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-4 shrink-0 w-full">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-lg font-semibold text-white">Knowledge Base Assistant</h1>
        <p className="text-sm text-indigo-100">Ask questions based on uploaded documents</p>
      </div>
    </header>

   
    <div className="flex-1 overflow-y-auto px-4 py-6 bg-slate-50 w-full">
      <div className="max-w-3xl mx-auto space-y-6">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <p>Ask me anything about the uploaded documents.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-br-sm'
                  : 'bg-white text-gray-900 rounded-bl-sm border border-slate-200'
              }`}
            >
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </div>

              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500 space-y-1">
                  <p className="font-medium text-slate-600">Sources</p>
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
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <p className="text-xs font-medium text-slate-600 mb-2">Suggested Questions</p>
                  <div className="flex flex-col gap-1.5">
                    {msg.suggestedQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => sendMessage(q)}
                        className="text-left text-sm text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                      >
                        {q}
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
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>

    {/* Input */}
    <div className="border-t bg-white p-4 shrink-0 w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="max-w-3xl mx-auto flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          className="flex-1 border border-slate-300 rounded-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-full px-6 py-2.5 font-medium disabled:opacity-40 hover:shadow-lg transition-all"
        >
          Send
        </button>
      </form>
    </div>
  </div>
);
}