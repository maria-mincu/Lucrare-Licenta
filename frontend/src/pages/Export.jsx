import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { fmtRON } from '../utils';

export default function Export() {
  const { user } = useAuth();
  const [farmacii, setFarmacii] = useState([]);
  const [dosare, setDosare] = useState([]);
  const [selectedFarmacie, setSelectedFarmacie] = useState(user.id_farmacie || '');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const canGenerate = ['ADMIN_RETEA','FARMACIST_SEF','MANAGER_JUDET'].includes(user?.rol);

  const load = () => {
    api.get('/farmacii')
      .then(r => setFarmacii(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    api.get('/cnas/dosare', { params: user.id_farmacie ? { id_farmacie: user.id_farmacie } : {} })
      .then(r => setDosare(r.data.data || []))
      .catch(() => setDosare([]));
  };

  useEffect(() => { load(); }, [user.id_farmacie]);

  const downloadXml = async () => {
    if (!selectedFarmacie) { setMessage('Alege o farmacie.'); return; }
    if (!canGenerate) { setMessage('Nu ai permisiunea de a genera fișiere DRDM.'); return; }
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
      setMessage('Fișierul XML a fost generat.');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Eroare la generarea exportului.');
    }
  };

  if (loading) return <div className="empty-state"><div className="spin">⚕️</div><p>Se încarcă datele de export...</p></div>;

  return (
    <div>
      <div className="tcard">
        <div className="tcard-head"><h3>📄 Export Rapoarte CNAS</h3></div>
        <div className="mb-4" style={{ padding: 16 }}>
          <div className="fg2">
            <div className="fg">
              <label>Farmacie</label>
              <select className="fc" value={selectedFarmacie} onChange={e => setSelectedFarmacie(e.target.value)}>
                <option value="">Alege farmacie</option>
                {farmacii.map(f => <option key={f.id} value={f.id}>{f.denumire}</option>)}
              </select>
            </div>
            <div className="fg">
              <label>Lună</label>
              <input className="fc" type="number" min="1" max="12" value={month} onChange={e => setMonth(e.target.value)} />
            </div>
            <div className="fg">
              <label>An</label>
              <input className="fc" type="number" min="2020" max="2100" value={year} onChange={e => setYear(e.target.value)} />
            </div>
          </div>
          {message && <div className="info-box ib-blue">{message}</div>}
          <button className="btn btn-blue" onClick={downloadXml}>{canGenerate ? 'Generează DRDM XML' : 'Generează DRDM (fără acces)'}</button>
        </div>
      </div>
      <div className="tcard">
        <div className="tcard-head"><h3>Dosare CNAS existente</h3></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Farmacie</th><th>Lună</th><th>An</th><th>Retete</th><th>Compensată</th><th>Coplata</th><th>Status</th></tr></thead>
            <tbody>
              {dosare.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20 }}>Nu există dosare generate.</td></tr>
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
