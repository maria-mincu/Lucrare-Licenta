import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { fmtRON, downloadCsv } from '../utils';

export default function Comenzi() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [farmacii, setFarmacii] = useState([]);
  const [distribuitori, setDistribuitori] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ id_farmacie: user.id_farmacie || '', id_distribuitor: '', data_livrare_estimata: '', valoare_totala: '' });

  const loadOrders = async () => {
    setLoading(true);
    try {
      const [o, f, d] = await Promise.all([
        api.get('/comenzi', { params: user.id_farmacie ? { id_farmacie: user.id_farmacie } : {} }),
        api.get('/farmacii'),
        api.get('/distribuitori')
      ]);
      setOrders(o.data.data || []);
      setFarmacii(f.data.data || []);
      setDistribuitori(d.data.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Nu am putut încărca comenzile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOrders(); }, [user.id_farmacie]);

  const createOrder = async () => {
    setMessage('');
    if (!form.id_farmacie || !form.valoare_totala) {
      setMessage('Completă farmacia și valoarea estimată.');
      return;
    }
    try {
      await api.post('/comenzi', {
        id_farmacie: parseInt(form.id_farmacie),
        id_distribuitor: form.id_distribuitor || null,
        data_livrare_estimata: form.data_livrare_estimata || null,
        valoare_totala: parseFloat(form.valoare_totala) || 0
      });
      setMessage('Comanda a fost creată cu succes.');
      setForm({ ...form, id_distribuitor: '', data_livrare_estimata: '', valoare_totala: '' });
      loadOrders();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Eroare la creare comandă.');
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/comenzi/${id}/status`, { status });
      loadOrders();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Eroare la actualizarea statusului.');
    }
  };

  if (loading) return <div className="empty-state"><div className="spin">⚕️</div><p>Se încarcă comenzile...</p></div>;
  if (error) return <div className="empty-state"><p>{error}</p></div>;

  return (
    <>
      <div className="tcard">
        <div className="tcard-head"><h3>📋 Comenzi & NIR</h3></div>
        <div className="grid-2" style={{ gap: 16, flexWrap: 'wrap', padding: 16 }}>
          <div className="fg"><label>Farmacie</label><select className="fc" value={form.id_farmacie} onChange={e => setForm({ ...form, id_farmacie: e.target.value })}>
            <option value="">Alege farmacie</option>
            {farmacii.map(f => <option key={f.id} value={f.id}>{f.cod} — {f.denumire}</option>)}
          </select></div>
          <div className="fg"><label>Distribuitor</label><select className="fc" value={form.id_distribuitor} onChange={e => setForm({ ...form, id_distribuitor: e.target.value })}>
            <option value="">Niciun distribuitor</option>
            {distribuitori.map(d => <option key={d.id} value={d.id}>{d.denumire}</option>)}
          </select></div>
          <div className="fg"><label>Dată livrare estimată</label><input className="fc" type="date" value={form.data_livrare_estimata} onChange={e => setForm({ ...form, data_livrare_estimata: e.target.value })} /></div>
          <div className="fg"><label>Valoare estimată</label><input className="fc" type="number" min="0" step="0.01" value={form.valoare_totala} onChange={e => setForm({ ...form, valoare_totala: e.target.value })} /></div>
        </div>
        {message && <div className="info-box ib-blue" style={{ margin: '0 16px 16px' }}>{message}</div>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: 0, margin: '0 16px 16px' }}>
          <button className="btn btn-green" onClick={createOrder}>Creează comandă</button>
          <button className="btn btn-ghost" onClick={() => downloadCsv('comenzi.csv', orders)}>Export CSV</button>
        </div>
      </div>

      <div className="tcard">
        <div className="tcard-head"><h3>📦 Comenzi existente</h3></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Număr comandă</th><th>Farmacie</th><th>Distribuitor</th><th>Data</th><th>Valoare</th><th>Status</th><th>Acțiuni</th></tr></thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20 }}>Nu există comenzi înregistrate.</td></tr>
              ) : orders.map(order => (
                <tr key={order.id}>
                  <td>{order.numar_comanda}</td>
                  <td>{order.farmacie}</td>
                  <td>{order.distribuitor || '–'}</td>
                  <td>{new Date(order.created_at).toLocaleDateString('ro-RO')}</td>
                  <td>{fmtRON(order.valoare_totala)}</td>
                  <td><span className={`badge ${order.status === 'LIVRATA' ? 'b-green' : order.status === 'TRIMISA' ? 'b-amber' : 'b-gray'}`}>{order.status}</span></td>
                  <td>
                    {order.status === 'TRIMISA' ? (
                      <button className="btn btn-sm btn-blue" onClick={() => updateStatus(order.id, 'LIVRATA')}>Marchează livrată</button>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
