import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { fmtRON, fmt, regimColor } from '../utils';
import { useToast } from '../hooks/useToast';

export default function POS() {
  const { user } = useAuth();
  const { addToast, ToastContainer } = useToast();
  const [farmacii, setFarmacii] = useState([]);
  const [farmacieId, setFarmacieId] = useState(user.id_farmacie || '');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [plata, setPlata] = useState('CARD');
  const [loading, setLoading] = useState(false);
  const searchRef = useRef();

  useEffect(() => {
    api.get('/farmacii').then(r => {
      setFarmacii(r.data.data);
      if (!farmacieId && r.data.data.length) setFarmacieId(r.data.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (search.length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      api.get('/products', { params: { search, id_farmacie: farmacieId } })
        .then(r => setResults(r.data.data.slice(0, 8)));
    }, 250);
    return () => clearTimeout(t);
  }, [search, farmacieId]);

  const addToCart = (p) => {
    if (!p.stoc_curent || p.stoc_curent <= 0) { addToast('Stoc epuizat!', '⚠️'); return; }
    setCart(prev => {
      const ex = prev.find(c => c.id === p.id);
      if (ex) {
        if (ex.qty >= p.stoc_curent) { addToast('Stoc insuficient!', '⚠️'); return prev; }
        return prev.map(c => c.id === p.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { ...p, qty: 1, este_compensat: p.este_compensat || false }];
    });
    setSearch(''); setResults([]);
    searchRef.current?.focus();
  };

  const changeQty = (id, d) => setCart(prev => prev.map(c => c.id === id ? { ...c, qty: Math.max(1, c.qty + d) } : c));
  const removeItem = (id) => setCart(prev => prev.filter(c => c.id !== id));
  const toggleComp = (id) => setCart(prev => prev.map(c => c.id === id ? { ...c, este_compensat: !c.este_compensat } : c));

  const subtotal = cart.reduce((s, c) => s + (c.pret_vanzare || 0) * c.qty, 0);
  const cnas = cart.filter(c => c.este_compensat).reduce((s, c) => s + (c.pret_vanzare || 0) * c.qty * 0.7, 0);
  const total = subtotal - cnas;

  const finalizeaza = async () => {
    if (!cart.length) { addToast('Coșul este gol!', '⚠️'); return; }
    if (!farmacieId) { addToast('Selectați farmacia!', '⚠️'); return; }
    setLoading(true);
    try {
      const r = await api.post('/inventory/vanzari', {
        id_farmacie: parseInt(farmacieId),
        modalitate_plata: plata,
        linii: cart.map(c => ({
          id_produs: c.id,
          cantitate: c.qty,
          pret_vanzare: c.pret_vanzare,
          este_compensat: c.este_compensat,
        })),
      });
      addToast(`✅ Bon ${r.data.data.numar_bon} — ${fmtRON(r.data.data.total)}`, '🧾');
      setCart([]);
    } catch (e) {
      addToast(e.response?.data?.message || 'Eroare la finalizare', '❌');
    } finally { setLoading(false); }
  };

  return (
    <>
      <ToastContainer />
      <div className="pos-layout">
        <div className="pos-left">
          <div className="pos-search">
            <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Caută produs după denumire, DCI, cod EAN..." autoFocus />
            <select className="fi" value={farmacieId} onChange={e => setFarmacieId(e.target.value)}>
              {farmacii.map(f => <option key={f.id} value={f.id}>{f.cod} — {f.denumire}</option>)}
            </select>
          </div>

          {results.length > 0 && (
            <div className="pos-results">
              {results.map(p => (
                <div key={p.id} className="pos-ri" onClick={() => addToCart(p)}>
                  <div>
                    <strong>{p.denumire_comerciala}</strong>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>{p.dci} · {p.cod_atc} · Stoc: <strong style={{ color: p.stoc_curent < 10 ? '#dc2626' : '#16a34a' }}>{p.stoc_curent}</strong></div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ color: '#2563eb' }}>{fmtRON(p.pret_vanzare)}</strong>
                    <div>
                      <span className={`badge ${regimColor(p.regim_eliberare)}`}>{p.regim_eliberare}</span>
                      {p.este_compensat && <span className="badge b-teal" style={{ marginLeft: 3 }}>CNAS</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pos-cart">
            {!cart.length && (
              <div className="empty-state">
                <div className="es-icon">🛒</div>
                <p>Coșul este gol — caută și adaugă produse</p>
              </div>
            )}
            {cart.map(item => (
              <div key={item.id} className="cart-item">
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{item.denumire_comerciala}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                    {item.dci}
                    {item.este_compensat && <span style={{ color: '#0891b2', marginLeft: 6 }}>CNAS (-70%)</span>}
                  </div>
                  {item.este_compensat && (
                    <label style={{ fontSize: 10, cursor: 'pointer', color: '#0891b2' }}>
                      <input type="checkbox" checked={item.este_compensat} onChange={() => toggleComp(item.id)} style={{ marginRight: 4 }} />
                      Compensat CNAS
                    </label>
                  )}
                </div>
                <div className="qc">
                  <button className="qb" onClick={() => changeQty(item.id, -1)}>−</button>
                  <strong style={{ minWidth: 22, textAlign: 'center' }}>{item.qty}</strong>
                  <button className="qb" onClick={() => changeQty(item.id, 1)}>+</button>
                </div>
                <div style={{ textAlign: 'right', minWidth: 80 }}>
                  <strong>{fmtRON((item.pret_vanzare || 0) * item.qty)}</strong>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{fmt(item.pret_vanzare)}/buc</div>
                </div>
                <button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16, padding: 2 }}>✕</button>
              </div>
            ))}
          </div>
        </div>

        <div className="pos-right">
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>
            🧾 Bon curent
            <span className="badge b-gray" style={{ marginLeft: 8 }}>{cart.reduce((s, c) => s + c.qty, 0)} prod.</span>
          </div>
          <div style={{ flex: 1 }} />
          <div className="tot-row"><span>Subtotal</span><span>{fmtRON(subtotal)}</span></div>
          <div className="tot-row"><span>TVA inclus (9%)</span><span>{fmtRON(subtotal * 0.09)}</span></div>
          <div className="tot-row" style={{ color: '#16a34a' }}><span>Comp. CNAS (70%)</span><span>-{fmtRON(cnas)}</span></div>
          <div className="tot-final"><span>TOTAL</span><span>{fmtRON(total)}</span></div>
          <div style={{ marginTop: 14 }}>
            <div className="fg">
              <label>Metodă plată</label>
              <select className="fc" value={plata} onChange={e => setPlata(e.target.value)}>
                <option value="CARD">💳 Card bancar</option>
                <option value="NUMERAR">💵 Numerar</option>
              </select>
            </div>
          </div>
          <button className="btn btn-green" style={{ width: '100%', justifyContent: 'center', padding: 11, fontSize: 13 }} onClick={finalizeaza} disabled={loading || !cart.length}>
            {loading ? '⏳ Se procesează...' : '✓ Finalizează Vânzarea'}
          </button>
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 7 }} onClick={() => setCart([])}>
            🗑 Golește coșul
          </button>
        </div>
      </div>
    </>
  );
}
