import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import AccessDenied from '../components/common/AccessDenied';

export default function Audit() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [limit, setLimit] = useState(200);
  const allowed = ['ADMIN_RETEA','AUDITOR','MANAGER_JUDET'];

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = {
        limit,
        search: query || undefined,
        actiune: action || undefined,
        entitate: entity || undefined,
        user: userFilter || undefined,
        from: from || undefined,
        to: to || undefined,
      };
      const r = await api.get('/audit', { params });
      setLogs(r.data.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Nu am putut încărca jurnalul.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!allowed.includes(user?.rol)) return setLoading(false);
    loadLogs();
  }, [user?.rol]);

  if (!allowed.includes(user?.rol)) return <AccessDenied message="Accesul la jurnalul de audit este rezervat Admin Rețea, Auditor și Manager Județ." />;
  if (loading) return <div className="empty-state"><div className="spin">⚕️</div><p>Se încarcă jurnalul de audit...</p></div>;
  if (error) return <div className="empty-state"><p>{error}</p></div>;

  return (
    <div>
      <div className="tcard">
        <div className="tcard-head"><h3>🔍 Jurnal Audit</h3></div>
        <div className="mbody">
          <div className="filters">
            <input className="fc" placeholder="Caută acțiune, entitate, utilizator" value={query} onChange={e => setQuery(e.target.value)} />
            <input className="fc" placeholder="Acțiune" value={action} onChange={e => setAction(e.target.value)} />
            <input className="fc" placeholder="Entitate" value={entity} onChange={e => setEntity(e.target.value)} />
            <input className="fc" placeholder="Utilizator" value={userFilter} onChange={e => setUserFilter(e.target.value)} />
            <input className="fc" type="date" value={from} onChange={e => setFrom(e.target.value)} />
            <input className="fc" type="date" value={to} onChange={e => setTo(e.target.value)} />
            <input className="fc" type="number" min="50" max="1000" value={limit} onChange={e => setLimit(Number(e.target.value))} />
            <button className="btn btn-blue btn-sm" onClick={loadLogs}>Aplică filtre</button>
          </div>
        </div>
      </div>

      <div className="tcard">
        <div className="tcard-head"><h3>Înregistrări Audit</h3><span className="badge b-gray">{logs.length} rezultate</span></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Data</th><th>Utilizator</th><th>Rol</th><th>Acțiune</th><th>Entitate</th><th>Detalii</th><th>IP</th></tr></thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20 }}>Nu există înregistrări care să corespundă filtrului.</td></tr>
              ) : logs.map(log => (
                <tr key={log.id}>
                  <td>{new Date(log.created_at).toLocaleString('ro-RO')}</td>
                  <td>{log.email || 'Sistem'}</td>
                  <td>{log.rol || '—'}</td>
                  <td>{log.actiune}</td>
                  <td>{log.entitate}</td>
                  <td style={{ maxWidth: 260, overflowWrap: 'anywhere' }}>{typeof log.detalii === 'object' ? JSON.stringify(log.detalii) : log.detalii}</td>
                  <td>{log.ip_client}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
