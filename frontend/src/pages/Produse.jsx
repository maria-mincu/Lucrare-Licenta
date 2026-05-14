import { useState, useEffect } from 'react';
import api from '../services/api';
import { fmt, fmtRON } from '../utils';

export default function Produse() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProducts = q => {
    setLoading(true);
    api.get('/products', { params: q ? { search: q } : {} })
      .then(r => setProducts(r.data.data || []))
      .catch(err => setError(err.response?.data?.message || 'Nu am putut încărca produsele.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadProducts(''); }, []);

  if (loading) return <div className="empty-state"><div className="spin">⚕️</div><p>Se încarcă catalogul de produse...</p></div>;
  if (error) return <div className="empty-state"><p>{error}</p></div>;

  return (
    <div>
      <div className="filters" style={{ marginBottom: 14 }}>
        <input className="fc" placeholder="Caută produs, DCI sau cod EAN" value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-blue" onClick={() => loadProducts(search)}>Caută</button>
      </div>
      <div className="tcard">
        <div className="tcard-head"><h3>💊 Catalog Produse</h3></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Produs</th>
                <th>DCI</th>
                <th>Formă</th>
                <th>Regim</th>
                <th>Stoc</th>
                <th>Min / Max</th>
                <th>Preț</th>
                <th>Expirare</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 20 }}>Nu am găsit produse.</td></tr>
              ) : products.map(item => (
                <tr key={item.id} className={!item.stoc_curent ? 'row-danger' : ''}>
                  <td><strong>{item.denumire_comerciala}</strong></td>
                  <td>{item.dci}</td>
                  <td>{item.forma_farmaceutica}</td>
                  <td>{item.regim_eliberare}</td>
                  <td>{fmt(item.stoc_curent, 0)}</td>
                  <td>{fmt(item.stoc_minim, 0)} / {fmt(item.stoc_maxim, 0)}</td>
                  <td>{item.pret_vanzare ? fmtRON(item.pret_vanzare) : '–'}</td>
                  <td>{item.expirare_urmatoare ? new Date(item.expirare_urmatoare).toLocaleDateString('ro-RO') : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
