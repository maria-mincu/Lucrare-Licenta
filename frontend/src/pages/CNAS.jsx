import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { fmtRON, downloadCsv } from '../utils';

export default function CNAS() {
  const { user } = useAuth();
  const [dosare, setDosare] = useState([]);
  const [farmacii, setFarmacii] = useState([]);
  const [selectedFarmacie, setSelectedFarmacie] = useState(user.id_farmacie || '');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canGenerate = ['ADMIN_RETEA','FARMACIST_SEF','MANAGER_JUDET'].includes(user?.rol);

  const loadDosare = async () => {
    try {
      const r = await api.get('/cnas/dosare', { params: user.id_farmacie ? { id_farmacie: user.id_farmacie } : {} });
      setDosare(r.data.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Nu am putut încărca dosarele CNAS.');
    }
  };

  const loadFarmacii = async () => {
    if (user.id_farmacie) return;
    try {
      const r = await api.get('/farmacii');
      setFarmacii(r.data.data || []);
      if (!selectedFarmacie && r.data.data?.length) setSelectedFarmacie(r.data.data[0].id);
    } catch (_) {
      setFarmacii([]);
    }
  };

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      await Promise.all([loadDosare(), loadFarmacii()]);
      setLoading(false);
    };
    fetch();
  }, [user.id_farmacie]);

  const generateDrdm = async () => {
    if (!selectedFarmacie) { setMessage('Alege o farmacie pentru export.'); return; }
    if (!canGenerate) { setMessage('Nu ai permisiunea de a genera DRDM XML.'); return; }
    setMessage('');

    try {
      const response = await api.get(`/cnas/drdm/${month}/${year}/${selectedFarmacie}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DRDM_${year}_${String(month).padStart(2, '0')}.xml`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setMessage('Fișierul DRDM XML a fost generat cu succes.');
      await loadDosare();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Eroare la generarea fișierului DRDM.');
    }
  };

  const summary = dosare.reduce((acc, row) => {
    acc.nr_retete += row.nr_retete || 0;
    acc.total_comp += parseFloat(row.valoare_compensata || 0);
    acc.total_copl += parseFloat(row.valoare_coplata || 0);
    acc.status[row.status] = (acc.status[row.status] || 0) + 1;
    return acc;
  }, { nr_retete: 0, total_comp: 0, total_copl: 0, status: {} });

  if (loading) return <div className="empty-state"><div className="spin">⚕️</div><p>Se încarcă raportarea CNAS...</p></div>;
  if (error) return <div className="empty-state"><p>{error}</p></div>;

  return (
    <div>
      <div className="tcard" style={{ marginBottom: 16 }}>
        <div className="tcard-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>🏥 Raportare CNAS</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => downloadCsv('dosare_cnas.csv', dosare)}>Export CSV</button>
        </div>
        <div style={{ padding: 16 }}>
          <div className="fg2">
            <div className="fg">
              <label>Farmacie</label>
              <select className="fc" value={selectedFarmacie} onChange={e => setSelectedFarmacie(e.target.value)} disabled={!!user.id_farmacie || !canGenerate}>
                {user.id_farmacie ? (
                  <option value={user.id_farmacie}>{user.farmacie || 'Farmacia curentă'}</option>
                ) : (
                  <>
                    <option value="">Alege farmacie</option>
                    {farmacii.map(f => <option key={f.id} value={f.id}>{f.denumire}</option>)}
                  </>
                )}
              </select>
            </div>
            <div className="fg">
              <label>Lună</label>
              <input className="fc" type="number" min="1" max="12" value={month} onChange={e => setMonth(Number(e.target.value))} />
            </div>
            <div className="fg">
              <label>An</label>
              <input className="fc" type="number" min="2020" max="2100" value={year} onChange={e => setYear(Number(e.target.value))} />
            </div>
          </div>
          <div className="fg" style={{ marginTop: 16 }}>
            <button className={`btn ${canGenerate ? 'btn-blue' : 'btn-disabled'}`} onClick={generateDrdm} disabled={!canGenerate}>Generează DRDM XML</button>
          </div>
          {message && <div className="info-box ib-blue" style={{ marginTop: 12 }}>{message}</div>}
        </div>
      </div>

      <div className="tcard" style={{ marginBottom: 16 }}>
        <div className="tcard-head"><h3>Rezumat CNAS</h3></div>
        <div style={{ padding: 16 }}>
          <div className="grid-3" style={{ gap: 16 }}>
            <div className="card-summary"><strong>{summary.nr_retete}</strong><p>Rețete generate</p></div>
            <div className="card-summary"><strong>{fmtRON(summary.total_comp)}</strong><p>Compensare totală</p></div>
            <div className="card-summary"><strong>{fmtRON(summary.total_copl)}</strong><p>Coplata totală</p></div>
          </div>
          <div style={{ marginTop: 12 }}>
            {Object.entries(summary.status).map(([status, count]) => (
              <span key={status} className={`badge ${status === 'GENERAT' ? 'b-green' : 'b-amber'}`} style={{ marginRight: 8 }}>{status}: {count}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="tcard">
        <div className="tcard-head"><h3>Dosare CNAS existente</h3></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Farmacie</th><th>Lună</th><th>An</th><th>Retete</th><th>Compensată</th><th>Coplata</th><th>Status</th></tr></thead>
            <tbody>
              {dosare.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20 }}>Nu există dosare CNAS încă.</td></tr>
              ) : dosare.map(d => (
                <tr key={`${d.id_farmacie}-${d.luna}-${d.an}`}>
                  <td>{d.farmacie}</td>
                  <td>{d.luna}</td>
                  <td>{d.an}</td>
                  <td>{d.nr_retete}</td>
                  <td>{fmtRON(d.valoare_compensata)}</td>
                  <td>{fmtRON(d.valoare_coplata)}</td>
                  <td><span className={`badge ${d.status === 'GENERAT' ? 'b-green' : 'b-amber'}`}>{d.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
