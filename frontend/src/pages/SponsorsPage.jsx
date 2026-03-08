import { useState, useEffect } from 'react';
import { sponsorsAPI, assetsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Modal, LoadingState, EmptyState, SectionHeader } from '../components/common/UI';
import { PlusCircle, RefreshCw, Users2, Box } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SponsorsPage() {
  const { can } = useAuth();
  const [sponsors, setSponsors] = useState([]);
  const [assets, setAssets] = useState([]);
  const [tab, setTab] = useState('sponsors');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [sponsorForm, setSponsorForm] = useState({ sponsor_name: '', sponsor_type: 'corporate', amount: '', contact_name: '', contact_phone: '', contact_email: '', notes: '' });
  const [assetForm, setAssetForm] = useState({ asset_name: '', category: '', quantity: '1', condition: 'good', location: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [sp, as] = await Promise.all([
      sponsorsAPI.getAll({}).catch(() => null),
      assetsAPI.getAll({}).catch(() => null),
    ]);
    if (sp?.data) setSponsors(sp.data);
    if (as?.data) setAssets(as.data);
    setLoading(false);
  };

  const handleCreateSponsor = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await sponsorsAPI.create(sponsorForm);
      toast.success('Sponsor added!');
      setShowModal(false);
      loadData();
    } finally { setSubmitting(false); }
  };

  const handleCreateAsset = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await assetsAPI.create(assetForm);
      toast.success('Asset added!');
      setShowModal(false);
      loadData();
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Sponsors & Logistics"
        subtitle="Manage sponsors, agreements, and assets"
        actions={
          <div className="flex gap-2">
            {can('sponsors','write') && <button onClick={() => setShowModal(true)} className="btn-primary btn"><PlusCircle size={16} /> Add {tab === 'sponsors' ? 'Sponsor' : 'Asset'}</button>}
            <button onClick={loadData} className="btn-secondary btn"><RefreshCw size={15} /></button>
          </div>
        }
      />

      <div className="flex gap-2">
        {[['sponsors','Sponsors'],['assets','Assets/Logistics']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`btn btn-sm ${tab === key ? 'btn-primary' : 'btn-secondary'}`}>{label}</button>
        ))}
      </div>

      {loading ? <LoadingState rows={4} /> : tab === 'sponsors' ? (
        sponsors.length === 0 ? <EmptyState icon="🤝" title="No sponsors yet" /> : (
          <div className="space-y-2">
            {sponsors.map(s => (
              <div key={s.sponsor_id} className="card-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Users2 size={14} className="text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white text-sm">{s.sponsor_name}</div>
                  <div className="text-xs text-slate-500">{s.sponsor_type} · {s.contact_name}</div>
                </div>
                {s.amount && <span className="text-emerald-400 text-sm font-medium">৳{Number(s.amount).toLocaleString()}</span>}
                <span className={`badge ${s.status === 'active' ? 'badge-active' : 'badge-draft'}`}>{s.status || 'active'}</span>
              </div>
            ))}
          </div>
        )
      ) : (
        assets.length === 0 ? <EmptyState icon="📦" title="No assets recorded" /> : (
          <div className="space-y-2">
            {assets.map(a => (
              <div key={a.asset_id} className="card-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <Box size={14} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white text-sm">{a.asset_name}</div>
                  <div className="text-xs text-slate-500">{a.category} · {a.location}</div>
                </div>
                <span className="text-slate-400 text-sm">Qty: {a.quantity}</span>
                <span className={`badge ${a.condition === 'good' ? 'badge-active' : 'badge-probation'}`}>{a.condition}</span>
              </div>
            ))}
          </div>
        )
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={tab === 'sponsors' ? 'Add Sponsor' : 'Add Asset'} size="md">
        {tab === 'sponsors' ? (
          <form onSubmit={handleCreateSponsor} className="space-y-4">
            {[['sponsor_name','Sponsor Name *','text',true],['contact_name','Contact Name','text'],['contact_phone','Contact Phone','tel'],['contact_email','Contact Email','email']].map(([key,label,type,req]) => (
              <div key={key} className="form-group">
                <label className="form-label">{label}</label>
                <input className="form-input" type={type} value={sponsorForm[key]} onChange={e => setSponsorForm({...sponsorForm, [key]: e.target.value})} required={req} />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-input" value={sponsorForm.sponsor_type} onChange={e => setSponsorForm({...sponsorForm, sponsor_type: e.target.value})}>
                  {['corporate','individual','ngo','government','other'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Amount (৳)</label>
                <input className="form-input" type="number" value={sponsorForm.amount} onChange={e => setSponsorForm({...sponsorForm, amount: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2 border-t border-white/5">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary btn">Cancel</button>
              <button type="submit" disabled={submitting} className="btn-primary btn">{submitting ? 'Adding...' : 'Add Sponsor'}</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCreateAsset} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group col-span-2">
                <label className="form-label">Asset Name *</label>
                <input className="form-input" value={assetForm.asset_name} onChange={e => setAssetForm({...assetForm, asset_name: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <input className="form-input" value={assetForm.category} onChange={e => setAssetForm({...assetForm, category: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input className="form-input" type="number" value={assetForm.quantity} onChange={e => setAssetForm({...assetForm, quantity: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Condition</label>
                <select className="form-input" value={assetForm.condition} onChange={e => setAssetForm({...assetForm, condition: e.target.value})}>
                  {['good','fair','poor','damaged'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Location</label>
                <input className="form-input" value={assetForm.location} onChange={e => setAssetForm({...assetForm, location: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2 border-t border-white/5">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary btn">Cancel</button>
              <button type="submit" disabled={submitting} className="btn-primary btn">{submitting ? 'Adding...' : 'Add Asset'}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
