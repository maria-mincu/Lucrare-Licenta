import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { rolColor } from '../utils';
import AccessDenied from '../components/common/AccessDenied';

const ROLE_OPTIONS = [
  'ADMIN_RETEA', 'MANAGER_JUDET', 'FARMACIST_SEF', 'FARMACIST', 'AUDITOR', 'OPERATOR_STOC'
];

export default function Utilizatori() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [farmacii, setFarmacii] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ id: null, email: '', password: '', nume: '', rol: 'FARMACIST', id_farmacie: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const canManage = user?.rol === 'ADMIN_RETEA';
  const allowed = ['ADMIN_RETEA','MANAGER_JUDET'];

  const loadUsers = async () => {
    setLoading(true);
    try {
      const [u, f] = await Promise.all([
        api.get('/utilizatori'),
        api.get('/farmacii')
      ]);
      setUsers(u.data.data || []);
      setFarmacii(f.data.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Nu am putut încărca utilizatorii.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const openNewUser = () => {
    setForm({ id: null, email: '', password: '', nume: '', rol: 'FARMACIST', id_farmacie: '' });
    setMessage('');
    setModalOpen(true);
  };

  const openEditUser = (userItem) => {
    setForm({
      id: userItem.id,
      email: userItem.email,
      password: '',
      nume: userItem.nume,
      rol: userItem.rol,
      id_farmacie: userItem.id_farmacie || ''
    });
    setMessage('');
    setModalOpen(true);
  };

  const saveUser = async () => {
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        email: form.email,
        nume: form.nume,
        rol: form.rol,
        id_farmacie: form.id_farmacie || null
      };
      if (!form.id) payload.password = form.password;
      if (form.id) {
        if (form.password) payload.password = form.password;
        await api.put(`/utilizatori/${form.id}`, payload);
        setMessage('Utilizatorul a fost actualizat.');
      } else {
        await api.post('/utilizatori', payload);
        setMessage('Utilizatorul a fost creat.');
      }
      loadUsers();
      setModalOpen(false);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Eroare la salvarea utilizatorului.');
    } finally { setSaving(false); }
  };

  if (!allowed.includes(user?.rol)) return <AccessDenied message="Doar Admin Rețea și Manager Județ pot accesa această pagină." />;
  if (loading) return <div className="empty-state"><div className="spin">⚕️</div><p>Se încarcă utilizatorii...</p></div>;
  if (error) return <div className="empty-state"><p>{error}</p></div>;

  return (
    <div>
      <div className="tcard-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3>👥 Utilizatori & Roluri</h3>
        {canManage && <button className="btn btn-blue" onClick={openNewUser}>➕ Adaugă utilizator</button>}
      </div>
      <div className="tcard">
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Email</th><th>Nume</th><th>Rol</th><th>Farmacie</th><th>Activ</th><th>Ultima autentificare</th><th>Acțiuni</th></tr></thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20 }}>Nu există utilizatori.</td></tr>
              ) : users.map(userItem => (
                <tr key={userItem.id}>
                  <td>{userItem.email}</td>
                  <td>{userItem.nume}</td>
                  <td><span className={`badge ${rolColor(userItem.rol)}`}>{userItem.rol}</span></td>
                  <td>{userItem.farmacie || '—'}</td>
                  <td>{userItem.activ ? 'Da' : 'Nu'}</td>
                  <td>{userItem.ultima_autentificare ? new Date(userItem.ultima_autentificare).toLocaleString('ro-RO') : '—'}</td>
                  <td>
                    {canManage ? (
                      <button className="btn btn-sm btn-ghost" onClick={() => openEditUser(userItem)}>Editează</button>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>{form.id ? 'Editează utilizator' : 'Creează utilizator nou'}</h3>
            <div className="fg"><label>Email</label><input className="fc" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div className="fg"><label>Nume</label><input className="fc" value={form.nume} onChange={e => setForm({ ...form, nume: e.target.value })} /></div>
            <div className="fg"><label>Rol</label><select className="fc" value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>
              {ROLE_OPTIONS.map(role => <option key={role} value={role}>{role}</option>)}
            </select></div>
            <div className="fg"><label>Farmacie</label><select className="fc" value={form.id_farmacie} onChange={e => setForm({ ...form, id_farmacie: e.target.value })}>
              <option value="">Nicio farmacie</option>
              {farmacii.map(f => <option key={f.id} value={f.id}>{f.cod} - {f.denumire}</option>)}
            </select></div>
            <div className="fg"><label>{form.id ? 'Parolă nouă' : 'Parolă'}</label><input className="fc" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={form.id ? 'Lasă gol pentru păstra parola' : ''} /></div>
            {message && <div className="info-box ib-amber">{message}</div>}
            <div className="modal-actions">
              <button className="btn btn-blue" disabled={saving} onClick={saveUser}>{saving ? 'Se salvează...' : 'Salvează'}</button>
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Anulează</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
