'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, isLoggedIn, clearToken } from '@/lib/auth';
import {
  uploadPdf,
  listDocuments,
  deleteDocument,
  getStats,
  searchDocuments,
  reprocessDocument,
} from '@/lib/api';

interface Document {
  id: string;
  fileName: string;
  uploadDate: string;
  processingStatus: string;
  chunksCreated: number | null;
}

interface Stats {
  totalDocuments: number;
  totalChatSessions: number;
  totalQuestions: number;
}

export default function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/admin/login');
      return;
    }
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      const token = getToken()!;
      const [docs, statsData] = await Promise.all([listDocuments(token), getStats(token)]);
      setDocuments(docs);
      setStats(statsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    try {
      const token = getToken()!;
      if (!searchQuery.trim()) {
        const docs = await listDocuments(token);
        setDocuments(docs);
        return;
      }
      const docs = await searchDocuments(searchQuery, token);
      setDocuments(docs);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      const token = getToken()!;
      await uploadPdf(file, token);
      await fetchAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this document?')) return;
    try {
      const token = getToken()!;
      await deleteDocument(id, token);
      await fetchAll();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleReprocess(id: string) {
    try {
      const token = getToken()!;
      await reprocessDocument(id, token);
      await fetchAll();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function handleLogout() {
    clearToken();
    router.push('/admin/login');
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <button onClick={handleLogout} className="text-sm text-gray-600 hover:underline">
          Logout
        </button>
      </div>

      
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">Total PDFs</p>
          <p className="text-2xl font-semibold">{stats?.totalDocuments ?? '-'}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">Total Chat Sessions</p>
          <p className="text-2xl font-semibold">{stats?.totalChatSessions ?? '-'}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">Total Questions Asked</p>
          <p className="text-2xl font-semibold">{stats?.totalQuestions ?? '-'}</p>
        </div>
      </div>

      
      <div className="bg-white border rounded-lg p-6 mb-8">
        <h2 className="font-medium mb-3">Upload PDF</h2>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          disabled={uploading}
          className="block"
        />
        {uploading && <p className="text-sm text-blue-600 mt-2">Uploading and processing...</p>}
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search PDFs by name..."
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
        <button type="submit" className="bg-gray-800 text-white rounded px-4 py-2 text-sm">
          Search
        </button>
      </form>

      
      <div className="bg-white border rounded-lg overflow-hidden">
        <h2 className="font-medium p-4 border-b">Uploaded Documents</h2>
        {loading ? (
          <p className="p-4 text-gray-500">Loading...</p>
        ) : documents.length === 0 ? (
          <p className="p-4 text-gray-500">No documents found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3">File Name</th>
                <th className="p-3">Uploaded</th>
                <th className="p-3">Status</th>
                <th className="p-3">Chunks</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-t">
                  <td className="p-3">{doc.fileName}</td>
                  <td className="p-3">{new Date(doc.uploadDate).toLocaleString()}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        doc.processingStatus === 'processed'
                          ? 'bg-green-100 text-green-700'
                          : doc.processingStatus === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {doc.processingStatus}
                    </span>
                  </td>
                  <td className="p-3">{doc.chunksCreated ?? '-'}</td>
                  <td className="p-3 flex gap-3">
                    <button
                      onClick={() => handleReprocess(doc.id)}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Reprocess
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="text-red-600 hover:underline text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}