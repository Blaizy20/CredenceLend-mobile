import { useState, useEffect } from 'react';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL ?? '';

interface LoanDocument {
  document_id: number;
  loan_id:     number;
  code:        string;
  label:       string;
  file_url:    string;
  file_key:    string;
  uploaded_at: string;
}

const DOC_ICONS: Record<string, string> = {
  VALID_ID:         '🪪',
  PROOF_OF_BILLING: '🧾',
  PROOF_OF_INCOME:  '💰',
  COLLATERAL_PROOF: '🏠',
  COLLATERAL_TYPE:  '📋',
};

export default function LoanDocuments({ loanId }: { loanId: number }) {
  const [documents, setDocuments] = useState<LoanDocument[]>([]);
  const [loading, setLoading]     = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [opening, setOpening]     = useState<number | null>(null);

  useEffect(() => {
    if (!loanId) {
      setFetchError('No loan ID provided.');
      setLoading(false);
      return;
    }

    const url = `${API}/api/loan/${loanId}/documents`;
    console.log('[LoanDocuments] fetching:', url);

    axios.get(url)
      .then((res) => {
        console.log('[LoanDocuments] response:', res.data);
        if (Array.isArray(res.data)) {
          setDocuments(res.data);
        } else {
          setFetchError('Unexpected response format.');
        }
      })
      .catch((err) => {
        const msg = err?.response?.data?.message ?? err?.message ?? 'Unknown error';
        console.error('[LoanDocuments] error:', msg);
        setFetchError(`Failed to load documents: ${msg}`);
      })
      .finally(() => setLoading(false));
  }, [loanId]);

  const openDocument = async (doc: LoanDocument) => {
    const newTab = Capacitor.isNativePlatform() ? null : window.open('', '_blank');
    try {
      setOpening(doc.document_id);

      const res = await axios.get(`${API}/api/documents/signed-url`, {
        params: { key: doc.file_key },
      });

      const url = res.data?.url;
      if (!url) {
        newTab?.close();
        alert('Could not generate document link. Please try again.');
        return;
      }

      if (Capacitor.isNativePlatform()) {
        await Browser.open({ url });
      } else {
        if (newTab) {
          newTab.location.href = url;
        } else {
          window.open(url, '_blank');
        }
      }
    } catch (err: any) {
      newTab?.close();
      const msg = err?.response?.data?.message ?? err?.message ?? 'Unknown error';
      console.error('[LoanDocuments] openDocument error:', msg);
      alert(`Could not open document: ${msg}`);
    } finally {
      setOpening(null);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-6">
      <span className="text-sm text-gray-400">Loading documents...</span>
    </div>
  );

  // ✅ Visible error state — shows on both browser and mobile
  if (fetchError) return (
    <div className="mx-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
      <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-1">Document Load Error</p>
      <p className="text-sm text-red-400">{fetchError}</p>
      <p className="text-[10px] text-red-300 mt-2">API: {API || '(empty — VITE_API_URL not set)'}</p>
      <p className="text-[10px] text-red-300">Loan ID: {loanId}</p>
    </div>
  );

  if (documents.length === 0) return (
    <div className="flex flex-col items-center py-6 gap-1">
      <span className="text-sm text-gray-400">No documents uploaded yet.</span>
      <span className="text-[10px] text-gray-300">API: {API || '(empty)'} · Loan: {loanId}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
        Loan Documents
      </h3>
      {documents.map((doc) => (
        <button
          key={doc.document_id}
          onClick={() => openDocument(doc)}
          disabled={opening === doc.document_id}
          className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm active:scale-95 transition-transform text-left"
        >
          <span className="text-2xl">
            {DOC_ICONS[doc.code] ?? '📎'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{doc.label}</p>
            <p className="text-xs text-gray-400">
              {new Date(doc.uploaded_at).toLocaleDateString('en-PH', {
                year: 'numeric', month: 'short', day: 'numeric'
              })}
            </p>
          </div>
          <span className="text-xs text-teal-600 font-medium">
            {opening === doc.document_id ? 'Opening...' : 'View'}
          </span>
        </button>
      ))}
    </div>
  );
}