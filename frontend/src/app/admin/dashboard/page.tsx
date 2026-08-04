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
  const [recentDocs, setRecentDocs] = useState<Document[]>([]);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [docToDelete, setDocToDelete] = useState<Document | null>(null);
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
      setRecentDocs(statsData.recentDocuments || []);
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

    setSelectedFileName(file.name);
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
      setSelectedFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function confirmDelete(doc: Document) {
    setDocToDelete(doc);
  }

  async function executeDelete() {
    if (!docToDelete) return;
    try {
      const token = getToken()!;
      await deleteDocument(docToDelete.id, token);
      await fetchAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDocToDelete(null);
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
    <div className="min-h-screen bg-slate-50">
      {/* Header bar */}
      <div className="bg-indigo-600 px-6 py-5">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-white">Admin Dashboard</h1>
            <p className="text-sm text-indigo-100">Manage your knowledge base</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-white bg-indigo-500 hover:bg-indigo-400 transition-colors rounded-lg px-4 py-2 cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border-l-4 border-indigo-500 rounded-lg p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total PDFs</p>
            <p className="text-3xl font-semibold text-indigo-600 mt-1">{stats?.totalDocuments ?? '-'}</p>
          </div>
          <div className="bg-white border-l-4 border-violet-500 rounded-lg p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total Chat Sessions</p>
            <p className="text-3xl font-semibold text-violet-600 mt-1">{stats?.totalChatSessions ?? '-'}</p>
          </div>
          <div className="bg-white border-l-4 border-emerald-500 rounded-lg p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total Questions Asked</p>
            <p className="text-3xl font-semibold text-emerald-600 mt-1">{stats?.totalQuestions ?? '-'}</p>
          </div>
        </div>

        {/* Recent Documents */}
        {recentDocs.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6 shadow-sm">
            <h2 className="font-medium text-slate-900 mb-3 text-sm">Recently Uploaded</h2>
            <ul className="divide-y divide-slate-100">
              {recentDocs.map((doc) => (
                <li key={doc.id} className="flex justify-between text-sm text-slate-600 py-2">
                  <span>{doc.fileName}</span>
                  <span className="text-slate-400">{new Date(doc.uploadDate).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Upload */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6 shadow-sm">
          <h2 className="font-medium text-slate-900 mb-3 text-sm">Upload PDF</h2>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-indigo-600 text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Choose PDF
            </button>
            <span className="text-sm text-slate-500">
              {uploading ? selectedFileName : 'No file selected'}
            </span>
          </div>

          {uploading && (
            <p className="text-sm text-indigo-600 mt-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse" />
              Uploading and processing...
            </p>
          )}
          {error && (
            <p className="text-sm text-red-600 mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search PDFs by name..."
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
          />
          <button
            type="submit"
            className="bg-indigo-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            Search
          </button>
        </form>

        {/* Document list */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <h2 className="font-medium text-slate-900 p-4 border-b border-slate-200 text-sm">
            Uploaded Documents
          </h2>
          {loading ? (
            <p className="p-4 text-slate-500 text-sm">Loading...</p>
          ) : documents.length === 0 ? (
            <p className="p-4 text-slate-500 text-sm">No documents found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="p-3 text-slate-500 font-medium">File Name</th>
                    <th className="p-3 text-slate-500 font-medium">Uploaded</th>
                    <th className="p-3 text-slate-500 font-medium">Status</th>
                    <th className="p-3 text-slate-500 font-medium">Chunks</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-900">{doc.fileName}</td>
                      <td className="p-3 text-slate-500">{new Date(doc.uploadDate).toLocaleString()}</td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            doc.processingStatus === 'processed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : doc.processingStatus === 'failed'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {doc.processingStatus}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">{doc.chunksCreated ?? '-'}</td>
                      <td className="p-3 flex gap-3">
                        <button
                          onClick={() => handleReprocess(doc.id)}
                          className="text-indigo-600 hover:text-indigo-800 hover:underline text-xs font-medium cursor-pointer"
                        >
                          Reprocess
                        </button>
                        <button
                          onClick={() => confirmDelete(doc)}
                          className="text-red-600 hover:text-red-800 hover:underline text-xs font-medium cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Custom Delete Confirmation Modal */}
      {docToDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete document?</h3>
            <p className="text-sm text-slate-500 mb-6">
              This will permanently remove{' '}
              <span className="font-medium text-slate-700">{docToDelete.fileName}</span> and its
              indexed vectors. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDocToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
