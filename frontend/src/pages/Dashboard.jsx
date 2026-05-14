import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { fmtRON, fmt, fefoStatus, fefoClass, fefoLabel, statusColor } from '../utils';

const COLORS = ['#2563eb','#16a34a','#7c3aed','#d97706','#0891b2','#dc2626'];

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loturi, setLoturi] = useState([]);

  useEffect(() => {
    const params = user.id_farmacie ? { id_farmacie: user.id_farmacie } : {};
    Promise.all([
      api.get('/analytics/dashboard', { params }),
      api.get('/inventory/loturi', { params }),
    ]).then(([d, l]) => {
      setData(d.data.data);
      setLoturi(l.data.data.filter(lo => fefoStatus(lo) !== 'OK').slice(0, 8));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty-state"><div className="spin" style={{ fontSize: 24 }}>⚕️</div><p style={{ marginTop: 10 }}>Se încarcă datele...</p></div>;
  if (!data) return <div className="empty-state"><p>Eroare la încărcarea datelor. Verificați conexiunea la backend.</p></div>;

  const farmaciiStatus = (data.farmacii || []).map(f => ({
    ...f,
    status: f.vanzari_luna >= f.target_lunar ? 'VERDE' : f.vanzari_luna >= f.target_lunar * 0.8 ? 'GALBEN' : 'ROSU'
  }));

  return (
    <div>
      {/* KPI */}
      <div className="kpi-grid">
        {[
          { icon: '💰', lbl: 'Vânzări Astăzi', val: fmtRON(data.vanzari_azi?.total), sub: `${data.vanzari_azi?.nr} tranzacții`, color: '#2563eb', stripe: 'linear-gradient(90deg,#2563eb,#60a5fa)' },
          { icon: '📅', lbl: 'Vânzări Luna', val: fmtRON(data.vanzari_luna?.total), sub: `${data.vanzari_luna?.nr} tranzacții`, color: '#16a34a', stripe: 'linear-gradient(90deg,#16a34a,#4ade80)' },
          { icon: '🏥', lbl: 'Decontare CNAS', val: fmtRON(data.vanzari_luna?.cnas), sub: `${fmt((data.vanzari_luna?.cnas / (data.vanzari_luna?.total || 1)) * 100, 1)}% din vânzări`, color: '#7c3aed', stripe: 'linear-gradient(90deg,#7c3aed,#a78bfa)' },
          { icon: '⚠️', lbl: 'Alerte FEFO', val: data.alerte_fefo, sub: 'loturi aproape de expirare', color: '#dc2626', stripe: 'linear-gradient(90deg,#dc2626,#f87171)' },
          { icon: '💰', lbl: 'Valoare Stoc', val: fmtRON(data.valoare_stoc), sub: 'total rețea', color: '#d97706', stripe: 'linear-gradient(90deg,#d97706,#fbbf24)' },
          { icon: '🏪', lbl: 'Farmacii Active', val: data.farmacii?.length || 0, sub: `${farmaciiStatus.filter(f => f.status === 'VERDE').length} pe target`, color: '#0891b2', stripe: 'linear-gradient(90deg,#0891b2,#22d3ee)' },
        ].map((k, i) => (
          <div key={i} className="kpi">
            <div className="kpi-stripe" style={{ background: k.stripe }} />
            <div className="kpi-ico" style={{ background: k.color + '18' }}>{k.icon}</div>
            <div className="kpi-val">{k.val}</div>
            <div className="kpi-lbl">{k.lbl}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* TREND 30 ZILE */}
      <div className="chart-card">
        <div className="ch-head">
          <h3>📈 Trend Vânzări 30 Zile + Prognoze EWMA (α=0.3)</h3>
          <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--muted)' }}>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#2563eb', marginRight: 4 }} />Vânzări reale</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#16a34a', marginRight: 4 }} />CNAS</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data.trend_30_zile}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="zi" tickFormatter={v => v?.slice(5)} tick={{ fontSize: 10 }} tickCount={10} />
            <YAxis tickFormatter={v => Math.round(v / 100) / 10 + 'k'} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v, n) => [fmtRON(v), n === 'total' ? 'Vânzări' : 'CNAS']} labelFormatter={v => 'Data: ' + v} />
            <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="cnas" stroke="#16a34a" strokeWidth={1.5} dot={false} strokeOpacity={0.8} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* CHARTS 3 COL */}
      <div className="charts-3">
        <div className="chart-card" style={{ marginBottom: 0 }}>
          <div className="ch-head"><h3>🏆 Top Produse</h3></div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.top_produse} layout="vertical">
              <XAxis type="number" tickFormatter={v => Math.round(v / 100) / 10 + 'k'} tick={{ fontSize: 9 }} />
              <YAxis type="category" dataKey="denumire_comerciala" width={100} tick={{ fontSize: 9 }} />
              <Tooltip formatter={v => fmtRON(v)} />
              <Bar dataKey="val" radius={4}>
                {(data.top_produse || []).map((_, i) => <Cell key={i} fill={COLORS[i % 6]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card" style={{ marginBottom: 0 }}>
          <div className="ch-head"><h3>📊 Performanță vs Target</h3></div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={farmaciiStatus}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="denumire" tickFormatter={v => v.replace('Farmacia ', '')} tick={{ fontSize: 9 }} />
              <YAxis tickFormatter={v => Math.round(v / 1000) + 'k'} tick={{ fontSize: 9 }} />
              <Tooltip formatter={v => fmtRON(v)} />
              <Bar dataKey="vanzari_luna" name="Realizat" radius={3}>
                {farmaciiStatus.map((f, i) => <Cell key={i} fill={f.status === 'VERDE' ? '#16a34a' : f.status === 'GALBEN' ? '#d97706' : '#dc2626'} />)}
              </Bar>
              <Bar dataKey="target_lunar" name="Target" fill="rgba(0,0,0,.08)" radius={3} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card" style={{ marginBottom: 0 }}>
          <div className="ch-head"><h3>🍩 Structura Vânzărilor</h3></div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={[
                { name: 'Vânzări OTC', value: data.vanzari_luna?.total - data.vanzari_luna?.cnas },
                { name: 'Decontare CNAS', value: data.vanzari_luna?.cnas },
              ]} innerRadius="55%" outerRadius="80%" dataKey="value" paddingAngle={3}>
                <Cell fill="#2563eb" /><Cell fill="#16a34a" />
              </Pie>
              <Tooltip formatter={v => fmtRON(v)} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ALERTE + VANZARI RECENTE */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
        <div className="tcard">
          <div className="tcard-head">
            <h3>⚠️ Alerte FEFO Active</h3>
            <button className="btn btn-sm btn-ghost" onClick={() => window.location.href = '/loturi'}>Toate →</button>
          </div>
          <table className="tbl">
            <thead><tr><th>Produs</th><th>Lot</th><th>Zile</th><th>Status</th></tr></thead>
            <tbody>
              {loturi.map(l => {
                const s = fefoStatus(l); const z = Math.ceil((new Date(l.data_expirare) - new Date()) / 86400000);
                return (
                  <tr key={l.id} className={fefoClass(s)}>
                    <td><strong>{l.denumire_comerciala}</strong><br /><span style={{ fontSize: 10, color: 'var(--muted)' }}>{l.dci}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: 10 }}>{l.numar_lot}</td>
                    <td><strong style={{ color: z < 30 ? '#dc2626' : z < 90 ? '#d97706' : '#16a34a' }}>{z < 0 ? 'EXP' : z}</strong></td>
                    <td><span className={`badge ${s === 'CRITIC' ? 'b-red' : s === 'ATENTIE' ? 'b-amber' : 'b-gray'}`}>{fefoLabel(s)}</span></td>
                  </tr>
                );
              })}
              {!loturi.length && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>✓ Nicio alertă activă</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="tcard">
          <div className="tcard-head"><h3>🏪 Performanță Farmacii</h3></div>
          {farmaciiStatus.map(f => {
            const pct = Math.min(100, (f.vanzari_luna / (f.target_lunar || 1)) * 100);
            const color = f.status === 'VERDE' ? '#16a34a' : f.status === 'GALBEN' ? '#d97706' : '#dc2626';
            return (
              <div key={f.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
                  <strong>{f.denumire}</strong>
                  <span style={{ color, fontWeight: 600 }}>{fmt(pct, 1)}%</span>
                </div>
                <div className="pb"><div className="pb-f" style={{ width: pct + '%', background: color }} /></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>
                  <span>{fmtRON(f.vanzari_luna)}</span>
                  <span>Target: {fmtRON(f.target_lunar)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
