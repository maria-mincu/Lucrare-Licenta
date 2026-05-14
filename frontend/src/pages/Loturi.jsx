import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { fmtRON, fmt, fefoStatus, fefoClass, fefoLabel } from '../utils';
import { useToast } from '../hooks/useToast';

export default function Loturi() {
  const { user } = useAuth();
  const { addToast, ToastContainer } = useToast();
  const [loturi, setLoturi] = useState([]);
  const [farmacii, setFarmacii] = useState([]);
  const [produse, setProduse] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNIR, setShowNIR] = useState(false);
  const [nir, setNIR] = useState({ id_produs: '', id_farmacie: user.id_farmacie || '', numar_lot: '', data_expirare: '', cantitate: '', pret_achizitie: '', pret_vanzare: '', id_distribuitor: '' });
  const [distributori, setDistributori] = useState([]);

  const load = () => {
    setLoading(true);
    const params = user.id_farmacie ? { id_farmacie: user.id_farmacie } : {};
    Promise.all([
      api.get('/inventory/loturi', { params }),
      api.get('/farmacii'),
      api.get('/products', { params }),
      api.get('/distribuitori'),
    ]).then(([l, f, p, d]) => {
      setLoturi(l.data.data);
      setFarmacii(f.data.data);
      setProduse(p.data.data);
      setDistributori(d.data.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = loturi.filter(l => !filter || fefoStatus(l) === filter);
  const counts = { OK: loturi.filter(l => fefoStatus(l) === 'OK').length, ATENTIE: loturi.filter(l => fefoStatus(l) === 'ATENTIE').length, CRITIC: loturi.filter(l => fefoStatus(l) === 'CRITIC').length, EXPIRAT: loturi.filter(l => fefoStatus(l) === 'EXPIRAT').length };
  const valRisc = loturi.filter(l => fefoStatus(l) !== 'OK').reduce((s, l) => s + (l.cantitate_curenta || 0) * (l.pret_achizitie || 0), 0);

  const saveNIR = async () => {
    if (!nir.id_produs || !nir.id_farmacie || !nir.numar_lot || !nir.data_expirare || !nir.cantitate)
      return addToast('Completați câmpurile obligatorii!', '⚠️');
    try {
      await api.post('/inventory/nir', { ...nir, cantitate: parseInt(nir.cantitate), pret_achizitie: parseFloat(nir.pret_achizitie) || 0, pret_vanzare: parseFloat(nir.pret_vanzare) || 0, id_distribuitor: nir.id_distribuitor || null });
      addToast(`NIR înregistrat: +${nir.cantitate} buc`, '✅');
      setShowNIR(false);
      setNIR({ id_produs: '', id_farmacie: user.id_farmacie || '', numar_lot: '', data_expirare: '', cantitate: '', pret_achizitie: '', pret_vanzare: '', id_distribuitor: '' });
      load();
    } catch (e) { addToast(e.response?.data?.message || 'Eroare', '❌'); }
  };

  const marcLot = async (id, status) => {
    try {
      await api.patch(`/inventory/lot/${id}/status`, { status });
      addToast(`Lot marcat: ${status}`, '✅');
      load();
    } catch (e) { addToast('Eroare', '❌'); }
  };

  if (loading) return <div className="empty-state"><div className="spin" style={{ fontSize: 24 }}>⚕️</div></div>;

  return (
    <>
      <ToastContainer />
      {showNIR && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowNIR(false)}>
          <div className="modal">
            <div className="mhead"><h3>📥 Recepție NIR — Lot Nou</h3><button className="close-x" onClick={() => setShowNIR(false)}>✕</button></div>
            <div className="mbody">
              <div className="fg"><label>Produs *</label>
                <select className="fc" value={nir.id_produs} onChange={e => setNIR(p => ({ ...p, id_produs: e.target.value }))}>
                  <option value="">— Selectați produsul —</option>
                  {produse.map(p => <option key={p.id} value={p.id}>{p.denumire_comerciala}</option>)}
                </select>
              </div>
              <div className="fg"><label>Farmacie *</label>
                <select className="fc" value={nir.id_farmacie} onChange={e => setNIR(p => ({ ...p, id_farmacie: e.target.value }))}>
                  {farmacii.map(f => <option key={f.id} value={f.id}>{f.denumire}</option>)}
                </select>
              </div>
              <div className="fg2">
                <div className="fg"><label>Număr Lot *</label><input className="fc" placeholder="LOT2025-XXX" value={nir.numar_lot} onChange={e => setNIR(p => ({ ...p, numar_lot: e.target.value }))} /></div>
                <div className="fg"><label>Dată Expirare *</label><input className="fc" type="date" value={nir.data_expirare} onChange={e => setNIR(p => ({ ...p, data_expirare: e.target.value }))} /></div>
                <div className="fg"><label>Cantitate *</label><input className="fc" type="number" placeholder="100" value={nir.cantitate} onChange={e => setNIR(p => ({ ...p, cantitate: e.target.value }))} /></div>
                <div className="fg"><label>Preț Achiziție (RON)</label><input className="fc" type="number" step="0.01" value={nir.pret_achizitie} onChange={e => setNIR(p => ({ ...p, pret_achizitie: e.target.value }))} /></div>
                <div className="fg"><label>Preț Vânzare (RON)</label><input className="fc" type="number" step="0.01" value={nir.pret_vanzare} onChange={e => setNIR(p => ({ ...p, pret_vanzare: e.target.value }))} /></div>
                <div className="fg"><label>Distribuitor</label>
                  <select className="fc" value={nir.id_distribuitor} onChange={e => setNIR(p => ({ ...p, id_distribuitor: e.target.value }))}>
                    <option value="">— Selectați —</option>
                    {distributori.map(d => <option key={d.id} value={d.id}>{d.denumire}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="mfoot">
              <button className="btn btn-ghost" onClick={() => setShowNIR(false)}>Anulare</button>
              <button className="btn btn-green" onClick={saveNIR}>✅ Înregistrează NIR</button>
            </div>
          </div>
        </div>
      )}

      <div className="info-box ib-blue">🔬 <strong>FEFO — First Expired First Out</strong> — Implementat prin CTE PostgreSQL cu <code>SUM() OVER (ORDER BY data_expirare ASC)</code>. La orice vânzare, lotul cu expirarea cea mai apropiată este selectat automat.</div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {[
          { icon: '✅', lbl: 'OK', val: counts.OK, color: '#16a34a', stripe: 'linear-gradient(90deg,#16a34a,#4ade80)' },
          { icon: '⚡', lbl: 'Atenție (<90z)', val: counts.ATENTIE, color: '#d97706', stripe: 'linear-gradient(90deg,#d97706,#fbbf24)' },
          { icon: '🔴', lbl: 'Critic (<30z)', val: counts.CRITIC, color: '#dc2626', stripe: 'linear-gradient(90deg,#dc2626,#f87171)' },
          { icon: '💀', lbl: 'Expirate', val: counts.EXPIRAT, color: '#64748b', stripe: 'linear-gradient(90deg,#64748b,#94a3b8)' },
          { icon: '💰', lbl: 'Valoare la Risc', val: fmtRON(valRisc), color: '#7c3aed', stripe: 'linear-gradient(90deg,#7c3aed,#a78bfa)' },
        ].map((k, i) => (
          <div key={i} className="kpi">
            <div className="kpi-stripe" style={{ background: k.stripe }} />
            <div className="kpi-ico" style={{ background: k.color + '18' }}>{k.icon}</div>
            <div className="kpi-val">{k.val}</div>
            <div className="kpi-lbl">{k.lbl}</div>
          </div>
        ))}
      </div>

      <div className="section-hd">
        <h3>🏷️ Toate Loturile — Sortate FEFO</h3>
        <div style={{ display: 'flex', gap: 7 }}>
          {['', 'ATENTIE', 'CRITIC', 'EXPIRAT'].map(f => (
            <button key={f} className={`btn btn-sm ${filter === f ? 'btn-blue' : 'btn-ghost'}`} onClick={() => setFilter(f)}>
              {f || 'Toate'}
            </button>
          ))}
          <button className="btn btn-green btn-sm" onClick={() => setShowNIR(true)}>+ NIR</button>
        </div>
      </div>

      <div className="tcard">
        <table className="tbl">
          <thead>
            <tr><th>Produs</th><th>Nr. Lot</th><th>Farmacie</th><th>Expirare</th><th>Zile Rămase</th><th>Cantitate</th><th>Valoare</th><th>Status FEFO</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map(l => {
              const s = fefoStatus(l);
              const z = l.zile_exp !== undefined ? parseInt(l.zile_exp) : Math.ceil((new Date(l.data_expirare) - new Date()) / 86400000);
              return (
                <tr key={l.id} className={fefoClass(s)}>
                  <td><strong>{l.denumire_comerciala}</strong><br /><span style={{ fontSize: 10, color: 'var(--muted)' }}>{l.dci}</span></td>
                  <td style={{ fontFamily: 'monospace', fontSize: 10 }}>{l.numar_lot}</td>
                  <td>{l.farmacie}</td>
                  <td>{l.data_expirare?.slice(0, 10)}</td>
                  <td><strong style={{ fontSize: 15, color: z < 0 ? '#64748b' : z < 30 ? '#dc2626' : z < 90 ? '#d97706' : '#16a34a' }}>{z < 0 ? 'EXP' : z}</strong></td>
                  <td><strong>{l.cantitate_curenta} buc</strong></td>
                  <td>{fmtRON((l.cantitate_curenta || 0) * (l.pret_achizitie || 0))}</td>
                  <td><span className={`badge ${s === 'OK' ? 'b-green' : s === 'ATENTIE' ? 'b-amber' : s === 'CRITIC' ? 'b-red' : 'b-gray'}`}>{fefoLabel(s)}</span></td>
                  <td>
                    <button className="btn btn-sm btn-ghost" onClick={() => marcLot(l.id, 'QUARANTA')} title="Carantină" style={{ marginRight: 3 }}>🔒</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => marcLot(l.id, 'RETRAS')} title="Retras ANMDM">⛔</button>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>Niciun lot găsit</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
