import { useState, useEffect } from 'react';
import { documentsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Modal, LoadingState, EmptyState, SectionHeader } from '../components/common/UI';
import { PlusCircle, RefreshCw, FileText, Lock, Unlock, ExternalLink, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DocumentsPage() {
  const { can } = useAuth();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', doc_type: 'meeting_minutes', file_url: '', description: '', linked_to_type: '', linked_to_id: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadDocs(); }, []);

  const loadDocs = async () => {
    setLoading(true);
    const res = await documentsAPI.getAll({}).catch(() => null);
    if (res?.data) setDocs(res.data);
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await documentsAPI.create(form);
      toast.success('Document added!');
      setShowModal(false);
      loadDocs();
    } finally { setSubmitting(false); }
  };

  const handleToggleLock = async (doc) => {
    if (!can('documents','lock')) return toast.error('Permission denied');
    await documentsAPI.update(doc.doc_id, { is_locked: doc.is_locked === 'true' ? 'false' : 'true' });
    toast.success('Document lock status updated');
    loadDocs();
  };

  const handleDelete = async (doc_id) => {
    if (!confirm('Delete this document?')) return;
    await documentsAPI.delete(doc_id);
    toast.success('Document deleted');
    loadDocs();
  };

  const DOC_TYPES = ['meeting_minutes','financial_report','project_report','policy','announcement','other'];

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Documents (UDMS)"
        subtitle={`${docs.length} documents`}
        actions={
          <div className="flex gap-2">
            {can('documents','write') && <button onClick={() => setShowModal(true)} className="btn-primary btn"><PlusCircle size={16} /> Add Document</button>}
            <button onClick={loadDocs} className="btn-secondary btn"><RefreshCw size={15} /></button>
          </div>
        }
      />

      {loading ? <LoadingState rows={5} /> : docs.length === 0 ? (
        <EmptyState icon="📄" title="No documents found" />
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.doc_id} className="card-sm flex items-center gap-3 hover:border-white/10 transition-all">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                <FileText size={14} className="text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-white text-sm truncate">{doc.title}</div>
                <div className="text-xs text-slate-500">{doc.doc_type?.replace(/_/g,' ')} · {doc.upload_date}</div>
              </div>
              {doc.is_locked === 'true' && <Lock size={14} className="text-amber-400 flex-shrink-0" />}
              <div className="flex items-center gap-1">
                {doc.file_url && (
                  <a href={doc.file_url} target="_blank" rel="noreferrer" className="btn-secondary btn btn-sm">
                    <ExternalLink size={12} />
                  </a>
                )}
                {can('documents','lock') && (
                  <button onClick={() => handleToggleLock(doc)} className="btn-secondary btn btn-sm">
                    {doc.is_locked === 'true' ? <Unlock size={12} /> : <Lock size={12} />}
                  </button>
                )}
                {can('documents','delete') && (
                  <button onClick={() => handleDelete(doc.doc_id)} className="btn-danger btn btn-sm">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Document" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input className="form-input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="form-label">Document Type</label>
            <select className="form-input" value={form.doc_type} onChange={e => setForm({...form, doc_type: e.target.value})}>
              {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Google Drive / File URL</label>
            <input className="form-input" type="url" value={form.file_url} onChange={e => setForm({...form, file_url: e.target.value})} placeholder="https://drive.google.com/..." />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input resize-none" rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-white/5">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary btn">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary btn">{submitting ? 'Adding...' : 'Add Document'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
