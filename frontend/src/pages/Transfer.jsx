import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import AccessDenied from '../components/common/AccessDenied';

export default function Transfer() {
  const { user } = useAuth();
  const [farmacii, setFarmacii] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ id_produs: '', id_farmacie_sursa: user.id_farmacie || '', id_farmacie_dest: '', cantitate: '' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const allowed = ['ADMIN_RETEA','FARMACIST_SEF'];
  const canTransfer = allowed.includes(user?.rol);

  useEffect(() => {
    Promise.all([api.get('/farmacii'), api.get('/products', { params: { search: '' } })])
      .then(([f, p]) => {
        setFarmacii(f.data.data || []);
        setProducts(p.data.data || []);
      })
      .catch(err => setError(err.response?.data?.message || 'Nu am putut încărca datele pentru transfer.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async () => {
    setMessage(''); setError('');
    if (!form.id_produs || !form.id_farmacie_sursa || !form.id_farmacie_dest || !form.cantitate) {
      setError('Completează toate câmpurile de transfer.');
      return;
    }
    if (form.id_farmacie_sursa === form.id_farmacie_dest) {
      setError('Farmacia sursă și destinație trebuie să fie diferite.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        id_produs: parseInt(form.id_produs),
        id_farmacie_sursa: parseInt(form.id_farmacie_sursa),
        id_farmacie_dest: parseInt(form.id_farmacie_dest),
        cantitate: parseInt(form.cantitate)
      };
      const res = await api.post('/inventory/transfer', payload);
      setMessage(res.data.message || 'Transfer realizat cu succes.');
      setForm(prev => ({ ...prev, cantitate: '' }));
    } catch (err) {
      setError(err.response?.data?.message || 'Eroare la transfer.');
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="empty-state"><div className="spin">⚕️</div><p>Se încarcă opțiunile de transfer...</p></div>;
  if (error && !farmacii.length) return <div className="empty-state"><p>{error}</p></div>;
  if (!canTransfer) return <AccessDenied message="Doar Admin Rețea și Farmacist Șef pot face transferuri între farmacii." />;

  return (
    <div className="tcard">
      <div className="tcard-head"><h3>🔄 Transfer Inter-Farmacii</h3></div>
      <div className="mb-4" style={{ padding: 16 }}>
        <div className="fg">
          <label>Produs</label>
          <select className="fc" value={form.id_produs} onChange={e => setForm({ ...form, id_produs: e.target.value })}>
            <option value="">Selectează produs</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.denumire_comerciala} ({p.dci})</option>)}
          </select>
        </div>
        <div className="fg2">
          <div className="fg">
            <label>Farmacie sursă</label>
            <select className="fc" value={form.id_farmacie_sursa} onChange={e => setForm({ ...form, id_farmacie_sursa: e.target.value })}>
              <option value="">Selectează farmacie</option>
              {farmacii.map(f => <option key={f.id} value={f.id}>{f.denumire}</option>)}
            </select>
          </div>
          <div className="fg">
            <label>Farmacie destinație</label>
            <select className="fc" value={form.id_farmacie_dest} onChange={e => setForm({ ...form, id_farmacie_dest: e.target.value })}>
              <option value="">Selectează farmacie</option>
              {farmacii.map(f => <option key={f.id} value={f.id}>{f.denumire}</option>)}
            </select>
          </div>
        </div>
        <div className="fg" style={{ width: 160 }}>
          <label>Cantitate</label>
          <input className="fc" type="number" min="1" value={form.cantitate} onChange={e => setForm({ ...form, cantitate: e.target.value })} />
        </div>
        {message && <div className="info-box ib-green">{message}</div>}
        {error && <div className="info-box ib-amber">{error}</div>}
        <button className="btn btn-blue" disabled={submitting} onClick={handleSubmit}>{submitting ? 'Se trimite...' : 'Trimite transfer'}</button>
      </div>
    </div>
  );
}
