import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { fmt, fmtRON } from '../utils';

export default function Analytics() {
  const { user } = useAuth();
  const [abc, setAbc] = useState([]);
  const [ewma, setEwma] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = user.id_farmacie ? { id_farmacie: user.id_farmacie } : {};
    Promise.all([
      api.get('/analytics/abc-xyz', { params }),
      api.get('/analytics/ewma', { params }),
    ]).then(([a, e]) => {
      setAbc(a.data.data || []);
      setEwma(e.data.data || []);
    }).catch(err => setError(err.response?.data?.message || 'Nu am putut încărca datele analitice.'))
      .finally(() => setLoading(false));
  }, [user.id_farmacie]);

  if (loading) return <div className="empty-state"><div className="spin">⚕️</div><p>Se încarcă analizele...</p></div>;
  if (error) return <div className="empty-state"><p>{error}</p></div>;

  return (
    <div>
      <div className="tcard">
        <div className="tcard-head"><h3>📊 Clasificare ABC / XYZ</h3></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Produs</th><th>Regim</th><th>Vânzări 12 luni</th><th>ABC</th><th>XYZ</th><th>Stoc curent</th></tr></thead>
            <tbody>
              {abc.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20 }}>Nu există date ABC / XYZ.</td></tr>
              ) : abc.map(item => (
                <tr key={item.id_produs}>
                  <td>{item.denumire_comerciala}</td>
                  <td>{item.regim_eliberare}</td>
                  <td>{fmtRON(item.val_tot)}</td>
                  <td>{item.abc}</td>
                  <td>{item.xyz}</td>
                  <td>{fmt(item.stoc_curent, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="tcard">
        <div className="tcard-head"><h3>📈 Trend EWMA 30 zile</h3></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Zi</th><th>Vânzări</th><th>EWMA</th></tr></thead>
            <tbody>
              {ewma.length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20 }}>Datele EWMA nu sunt disponibile.</td></tr>
              ) : ewma.map(item => (
                <tr key={item.zi}>
                  <td>{item.zi}</td>
                  <td>{fmtRON(item.vanzari)}</td>
                  <td>{fmtRON(item.ewma)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
