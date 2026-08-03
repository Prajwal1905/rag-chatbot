const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export interface ChatSource {
  file_name: string;
  page: number | null;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  suggestedQuestions: string[];
}

export async function loginAdmin(email: string, password: string) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Login failed' }));
    throw new Error(err.error || 'Login failed');
  }
  return res.json();
}

export async function uploadPdf(file: File, token: string) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_URL}/api/documents/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Upload failed');
  }
  return res.json();
}

export async function listDocuments(token: string) {
  const res = await fetch(`${API_URL}/api/documents`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch documents');
  return res.json();
}

export async function deleteDocument(id: string, token: string) {
  const res = await fetch(`${API_URL}/api/documents/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to delete document');
  return res.json();
}

export async function askQuestion(
  question: string,
  sessionId: string,
  chatHistory: { question: string; answer: string }[]
): Promise<ChatResponse> {
  const res = await fetch(`${API_URL}/api/chat/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, sessionId, chatHistory }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }

  return res.json();
}

export async function getStats(token: string) {
  const res = await fetch(`${API_URL}/api/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function searchDocuments(query: string, token: string) {
  const res = await fetch(`${API_URL}/api/documents?search=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export async function reprocessDocument(id: string, token: string) {
  const res = await fetch(`${API_URL}/api/documents/${id}/reprocess`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Reprocess failed');
  return res.json();
}
export async function askQuestionStream(
  question: string,
  sessionId: string,
  chatHistory: { question: string; answer: string }[],
  onChunk: (text: string) => void,
  onDone: (sources: ChatSource[], suggestedQuestions: string[]) => void,
  onError: (error: string) => void
) {
  try {
    const res = await fetch(`${API_URL}/api/chat/ask-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, sessionId, chatHistory }),
    });

    if (!res.body) {
      onError('No response body');
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = JSON.parse(line.slice(6));

        if (payload.type === 'chunk') {
          onChunk(payload.text);
        } else if (payload.type === 'done') {
          onDone(payload.sources, payload.suggestedQuestions);
        } else if (payload.type === 'error') {
          onError(payload.error);
        }
      }
    }
  } catch (err: any) {
    onError(err.message || 'Streaming failed');
  }
}