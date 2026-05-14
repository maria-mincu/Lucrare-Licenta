import { useState, useEffect } from 'react';
import api from '../services/api';
import { fmtRON } from '../utils';

export default function Farmacii() {
  const [farmacii, setFarmacii] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/farmacii')
      .then(r => setFarmacii(r.data.data || []))
      .catch(err => setError(err.response?.data?.message || 'Nu am putut încărca farmacii.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty-state"><div className="spin">⚕️</div><p>Se încarcă farmacia...</p></div>;
  if (error) return <div className="empty-state"><p>{error}</p></div>;

  return (
    <div className="tcard">
      <div className="tcard-head"><h3>🏪 Rețea Farmacii</h3></div>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Cod</th>
              <th>Farmacie</th>
              <th>Oraș</th>
              <th>Județ</th>
              <th>Vânzări azi</th>
              <th>Vânzări lună</th>
              <th>Tranzacții azi</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {farmacii.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 20 }}>Nu există farmacii active.</td></tr>
            ) : farmacii.map(item => (
              <tr key={item.id}>
                <td>{item.cod}</td>
                <td>{item.denumire}</td>
                <td>{item.localitate}</td>
                <td>{item.judet}</td>
                <td>{fmtRON(item.vanzari_azi)}</td>
                <td>{fmtRON(item.vanzari_luna)}</td>
                <td>{item.tranzactii_azi}</td>
                <td>{fmtRON(item.target_lunar)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
