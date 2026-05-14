import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const NAV = [
  { path: '/dashboard',   ic: '📊', lbl: 'Dashboard',             sec: 'Principal' },
  { path: '/pos',         ic: '🛒', lbl: 'POS Vânzări' },
  { path: '/inventory',   ic: '📦', lbl: 'Stocuri',               sec: 'Stocuri' },
  { path: '/loturi',      ic: '🏷️', lbl: 'Loturi FEFO' },
  { path: '/transfer',    ic: '🔄', lbl: 'Transfer Inter-Farmacii', roles: ['ADMIN_RETEA','FARMACIST_SEF'] },
  { path: '/comenzi',     ic: '📋', lbl: 'Comenzi & NIR',         sec: 'Management' },
  { path: '/analytics',   ic: '📈', lbl: 'Analytics BI' },
  { path: '/cnas',        ic: '🏥', lbl: 'Raportare CNAS' },
  { path: '/farmacii',      ic: '🏪', lbl: 'Rețea Farmacii',        sec: 'Administrare' },
  { path: '/produse',       ic: '💊', lbl: 'Catalog Produse' },
  { path: '/distribuitori', ic: '🚚', lbl: 'Distribuitori',        roles: ['ADMIN_RETEA','MANAGER_JUDET'] },
  { path: '/utilizatori',   ic: '👥', lbl: 'Utilizatori & Roluri', roles: ['ADMIN_RETEA','MANAGER_JUDET'] },
  { path: '/audit',         ic: '🔍', lbl: 'Jurnal Audit', roles: ['ADMIN_RETEA','AUDITOR','MANAGER_JUDET'] },
  { path: '/export',        ic: '📄', lbl: 'Export Rapoarte' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [clock, setClock] = useState('');
  const [alerte, setAlerte] = useState(0);

  useEffect(() => {
    setClock(new Date().toLocaleTimeString('ro-RO'));
    const t = setInterval(() => setClock(new Date().toLocaleTimeString('ro-RO')), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    api.get('/alerte', { params: user.id_farmacie ? { id_farmacie: user.id_farmacie } : {} })
      .then(r => setAlerte(r.data.data?.length || 0))
      .catch(() => {});
  }, [loc.pathname]);

  const pageTitle = NAV.find(n => loc.pathname.startsWith(n.path))?.lbl || 'PharmaNET';
  const initials = user?.nume?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'PN';
  const colors = ['#2563eb','#16a34a','#7c3aed','#d97706','#0891b2','#dc2626'];
  const userColor = colors[user?.id % 6 || 0];

  let seenSec = {};

  const canAccess = (roles) => {
    if (!roles || !roles.length) return true;
    return roles.includes(user?.rol);
  };

  return (
    <div className="app">
      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="sb-logo">
          <div className="sb-logo-icon">⚕️</div>
          <div><h2>PharmaNET</h2><small>Pro Edition v2.0</small></div>
        </div>
        <div className="sb-user">
          <div className="sb-av" style={{ background: userColor }}>{initials}</div>
          <div>
            <div className="sb-nm">{user?.nume}</div>
            <div className="sb-rl">{user?.rol}</div>
          </div>
        </div>
        <nav className="sb-nav">
          {NAV.filter(item => canAccess(item.roles)).map(item => {
            const secEl = item.sec && !seenSec[item.sec]
              ? (seenSec[item.sec] = 1, <div className="sb-sec" key={'sec-'+item.sec}>{item.sec}</div>)
              : null;
            return (
              <div key={item.path}>
                {secEl}
                <button
                  className={`sb-item${loc.pathname.startsWith(item.path) ? ' active' : ''}`}
                  onClick={() => nav(item.path)}
                >
                  <span className="sb-ic">{item.ic}</span>
                  {item.lbl}
                  {item.path === '/loturi' && alerte > 0 && (
                    <span className="sb-badge">{alerte}</span>
                  )}
                </button>
              </div>
            );
          })}
        </nav>
        <div className="sb-foot">
          <button className="sb-logout" onClick={() => { logout(); nav('/'); }}>
            🚪 Deconectare
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div className="main">
        <div className="topbar">
          <h2>{pageTitle}</h2>
          <div className="tb-clock">{clock}</div>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            {new Date().toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          {alerte > 0 && (
            <button className="btn btn-red btn-sm" onClick={() => nav('/loturi')}>
              ⚠️ {alerte} alerte FEFO
            </button>
          )}
        </div>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
