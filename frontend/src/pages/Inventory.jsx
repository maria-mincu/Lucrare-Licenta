import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { fmt, fmtRON } from '../utils';

export default function Inventory() {
  const { user } = useAuth();
  const [stock, setStock] = useState([]);
  const [products, setProducts] = useState([]);
  const [farmacii, setFarmacii] = useState([]);
  const [distribuitori, setDistribuitori] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ id_produs: '', id_farmacie: user.id_farmacie || '', numar_lot: '', data_expirare: '', cantitate: '', pret_achizitie: '', pret_vanzare: '', id_distribuitor: '' });

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, p, f, d] = await Promise.all([
        api.get('/inventory/stoc'),
        api.get('/products', { params: { search: '' } }),
        api.get('/farmacii'),
        api.get('/distribuitori')
      ]);
      setStock(s.data.data || []);
      setProducts(p.data.data || []);
      setFarmacii(f.data.data || []);
      setDistribuitori(d.data.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Nu am putut încărca datele stocului.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [user.id_farmacie]);

  const submitNir = async () => {
    setMessage('');
    if (!form.id_produs || !form.id_farmacie || !form.numar_lot || !form.data_expirare || !form.cantitate) {
      setMessage('Completează toate câmpurile obligatorii pentru NIR.');
      return;
    }
    try {
      await api.post('/inventory/nir', {
        ...form,
        id_produs: parseInt(form.id_produs),
        id_farmacie: parseInt(form.id_farmacie),
        cantitate: parseFloat(form.cantitate),
        pret_achizitie: parseFloat(form.pret_achizitie || 0),
        pret_vanzare: parseFloat(form.pret_vanzare || 0),
        id_distribuitor: form.id_distribuitor || null
      });
      setMessage('NIR creat cu succes și stoc actualizat.');
      setForm({ ...form, numar_lot: '', data_expirare: '', cantitate: '', pret_achizitie: '', pret_vanzare: '', id_distribuitor: '' });
      loadData();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Eroare la generarea NIR.');
    }
  };

  if (loading) return <div className="empty-state"><div className="spin">⚕️</div><p>Se încarcă stocul...</p></div>;
  if (error) return <div className="empty-state"><p>{error}</p></div>;

  return (
    <>
      <div className="tcard">
        <div className="tcard-head"><h3>📥 Recepție marfă (NIR)</h3></div>
        <div className="grid-2" style={{ gap: 16, flexWrap: 'wrap' }}>
          <div className="fg">
            <label>Farmacie</label>
            <select className="fc" value={form.id_farmacie} onChange={e => setForm({ ...form, id_farmacie: e.target.value })}>
              <option value="">Alege farmacie</option>
              {farmacii.map(f => <option key={f.id} value={f.id}>{f.cod} — {f.denumire}</option>)}
            </select>
          </div>
          <div className="fg">
            <label>Produs</label>
            <select className="fc" value={form.id_produs} onChange={e => setForm({ ...form, id_produs: e.target.value })}>
              <option value="">Alege produs</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.denumire_comerciala} ({p.dci})</option>)}
            </select>
          </div>
          <div className="fg"><label>Număr lot</label><input className="fc" value={form.numar_lot} onChange={e => setForm({ ...form, numar_lot: e.target.value })} /></div>
          <div className="fg"><label>Dată expirare</label><input className="fc" type="date" value={form.data_expirare} onChange={e => setForm({ ...form, data_expirare: e.target.value })} /></div>
          <div className="fg"><label>Cantitate</label><input className="fc" type="number" min="1" value={form.cantitate} onChange={e => setForm({ ...form, cantitate: e.target.value })} /></div>
          <div className="fg"><label>Preț achiziție</label><input className="fc" type="number" min="0" value={form.pret_achizitie} onChange={e => setForm({ ...form, pret_achizitie: e.target.value })} /></div>
          <div className="fg"><label>Preț vânzare</label><input className="fc" type="number" min="0" value={form.pret_vanzare} onChange={e => setForm({ ...form, pret_vanzare: e.target.value })} /></div>
          <div className="fg"><label>Distribuitor</label><select className="fc" value={form.id_distribuitor} onChange={e => setForm({ ...form, id_distribuitor: e.target.value })}>
            <option value="">Niciun distribuitor</option>
            {distribuitori.map(d => <option key={d.id} value={d.id}>{d.denumire}</option>)}
          </select></div>
        </div>
        {message && <div className="info-box ib-blue" style={{ margin: '12px 16px' }}>{message}</div>}
        <div style={{ padding: 16 }}>
          <button className="btn btn-green" onClick={submitNir}>Generează NIR</button>
        </div>
      </div>

      <div className="tcard">
        <div className="tcard-head"><h3>📦 Stocuri curente</h3></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Produs</th>
                <th>DCI</th>
                <th>Stoc</th>
                <th>Min / Max</th>
                <th>Preț vânzare</th>
                <th>Expirare</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stock.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20 }}>Nu există stocuri pentru farmacia ta.</td></tr>
              ) : stock.map(item => (
                <tr key={item.id_produs} className={item.sub_minim ? 'row-warn' : ''}>
                  <td><strong>{item.denumire_comerciala}</strong></td>
                  <td>{item.dci}</td>
                  <td>{fmt(item.cantitate_totala, 0)}</td>
                  <td>{fmt(item.stoc_minim, 0)} / {fmt(item.stoc_maxim, 0)}</td>
                  <td>{item.pret_vanzare ? fmtRON(item.pret_vanzare) : '–'}</td>
                  <td>{item.expirare_next ? new Date(item.expirare_next).toLocaleDateString('ro-RO') : '–'}</td>
                  <td>{item.sub_minim ? <span className="badge b-red">Sub minim</span> : <span className="badge b-green">OK</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
