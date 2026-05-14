import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { downloadCsv } from '../utils';
import AccessDenied from '../components/common/AccessDenied';

export default function Distribuitori() {
  const { user } = useAuth();
  const [dist, setDist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ denumire: '', contact: '', telefon: '' });
  const canManage = ['ADMIN_RETEA','MANAGER_JUDET'].includes(user?.rol);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/distribuitori');
      setDist(r.data.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Nu am putut încărca distribuitorii.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setMessage('');
    if (!form.denumire) {
      setMessage('Completează denumirea distribuitorului.');
      return;
    }
    try {
      await api.post('/distribuitori', form);
      setMessage('Distribuitorul a fost adăugat.');
      setForm({ denumire: '', contact: '', telefon: '' });
      load();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Eroare la salvarea distribuitorului.');
    }
  };

  if (!canManage) return <AccessDenied message="Accesul la gestionarea distribuitorilor este restricționat." />;
  if (loading) return <div className="empty-state"><div className="spin">⚕️</div><p>Se încarcă distribuitorii...</p></div>;
  if (error) return <div className="empty-state"><p>{error}</p></div>;

  return (
    <div>
      <div className="tcard" style={{ marginBottom: 16 }}>
        <div className="tcard-head" style={{ justifyContent: 'space-between' }}>
          <h3>🚚 Distribuitori</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => downloadCsv('distribuitori.csv', dist)}>Export CSV</button>
        </div>
        <div className="grid-3" style={{ gap: 16, padding: 16 }}>
          <div className="fg"><label>Denumire</label><input className="fc" value={form.denumire} onChange={e => setForm({ ...form, denumire: e.target.value })} /></div>
          <div className="fg"><label>Contact</label><input className="fc" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} /></div>
          <div className="fg"><label>Telefon</label><input className="fc" value={form.telefon} onChange={e => setForm({ ...form, telefon: e.target.value })} /></div>
        </div>
        {message && <div className="info-box ib-blue" style={{ margin: '0 16px 16px' }}>{message}</div>}
        <div style={{ padding: '0 16px 16px' }}><button className="btn btn-green" onClick={save}>Adaugă distribuitor</button></div>
      </div>

      <div className="tcard">
        <div className="tcard-head"><h3>Listă distribuitori</h3></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Denumire</th><th>Contact</th><th>Telefon</th></tr></thead>
            <tbody>
              {dist.length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20 }}>Nu există distribuitori în baza de date.</td></tr>
              ) : dist.map(d => (
                <tr key={d.id}>
                  <td>{d.denumire}</td>
                  <td>{d.contact || '–'}</td>
                  <td>{d.telefon || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
