import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import Loturi from './pages/Loturi';
import Transfer from './pages/Transfer';
import Comenzi from './pages/Comenzi';
import Analytics from './pages/Analytics';
import CNAS from './pages/CNAS';
import Farmacii from './pages/Farmacii';
import Produse from './pages/Produse';
import Distribuitori from './pages/Distribuitori';
import Utilizatori from './pages/Utilizatori';
import Audit from './pages/Audit';
import Export from './pages/Export';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a', color: '#fff', fontSize: 15 }}>⚕️ Se încarcă PharmaNET...</div>;
  return user ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a', color: '#fff', fontSize: 15 }}>⚕️ PharmaNET Pro...</div>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route path="dashboard"   element={<Dashboard />} />
          <Route path="pos"         element={<POS />} />
          <Route path="inventory"   element={<Inventory />} />
          <Route path="loturi"      element={<Loturi />} />
          <Route path="transfer"    element={<Transfer />} />
          <Route path="comenzi"     element={<Comenzi />} />
          <Route path="analytics"   element={<Analytics />} />
          <Route path="cnas"        element={<CNAS />} />
          <Route path="farmacii"    element={<Farmacii />} />
          <Route path="produse"     element={<Produse />} />
          <Route path="distribuitori" element={<Distribuitori />} />
          <Route path="utilizatori" element={<Utilizatori />} />
          <Route path="audit"       element={<Audit />} />
          <Route path="export"      element={<Export />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
