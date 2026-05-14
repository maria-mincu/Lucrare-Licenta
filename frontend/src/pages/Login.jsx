import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DEMO = [
  { email: 'admin@pharmanet.ro',     rol: 'Admin Rețea' },
  { email: 'sef@pharmanet.ro',       rol: 'Farmacist Șef' },
  { email: 'farmacist@pharmanet.ro', rol: 'Farmacist' },
  { email: 'manager@pharmanet.ro',   rol: 'Manager Județ' },
  { email: 'auditor@pharmanet.ro',   rol: 'Auditor' },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [pass, setPass]   = useState('');
  const [err, setErr]     = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  const doLogin = async () => {
    if (!email || !pass) { setErr('Completați email-ul și parola'); return; }
    setLoading(true); setErr('');
    try {
      await login(email, pass);
      nav('/dashboard');
    } catch (e) {
      setErr(e.response?.data?.message || 'Eroare de autentificare');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #1e1b4b 100%)' }}>
      <div style={{ background: 'rgba(255,255,255,.06)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 20, padding: '44px', width: 420, maxWidth: '95vw' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 60, height: 60, background: '#2563eb', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 14px' }}>⚕️</div>
          <h1 style={{ color: '#60a5fa', fontSize: 24, fontWeight: 800, letterSpacing: -1 }}>PharmaNET Pro</h1>
          <p style={{ color: '#64748b', fontSize: 12, marginTop: 5 }}>Management avansat rețea farmacii · ASE București 2025</p>
        </div>
        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#64748b', marginBottom: 5 }}>Email</label>
        <input
          style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none', marginBottom: 14 }}
          type="email" placeholder="email@pharmanet.ro"
          value={email} onChange={e => setEmail(e.target.value)}
        />
        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#64748b', marginBottom: 5 }}>Parolă</label>
        <input
          style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none' }}
          type="password" placeholder="••••••••"
          value={pass} onChange={e => setPass(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doLogin()}
        />
        {err && <div style={{ background: 'rgba(220,38,38,.2)', border: '1px solid rgba(220,38,38,.4)', color: '#fca5a5', padding: '9px 12px', borderRadius: 8, fontSize: 12, marginTop: 10 }}>{err}</div>}
        <button
          onClick={doLogin} disabled={loading}
          style={{ width: '100%', padding: 13, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 20, opacity: loading ? .7 : 1 }}
        >
          {loading ? '⏳ Se autentifică...' : '🔐 Autentificare'}
        </button>
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.07)' }}>
          <p style={{ color: '#475569', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', textAlign: 'center', marginBottom: 10 }}>Conturi demo (parolă: pharma123)</p>
          {DEMO.map(d => (
            <button key={d.email} onClick={() => { setEmail(d.email); setPass('pharma123'); }}
              style={{ display: 'block', width: '100%', padding: '8px 12px', marginBottom: 5, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: '#94a3b8', fontSize: 11, cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ color: '#60a5fa', fontWeight: 700 }}>{d.email}</span>
              <span style={{ float: 'right', color: '#475569' }}>{d.rol}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
