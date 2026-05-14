# PharmaNET Pro v2.0
## Platformă Web pentru Managementul Rețelei de Farmacii
### MINCU Maria — Informatică Economică — ASE București 2025

---

## 🚀 PORNIRE RAPIDĂ (Windows)

### Cerințe prealabile
1. **Node.js 18+** — https://nodejs.org (descarcați LTS)
2. **PostgreSQL 14+** — https://www.postgresql.org/download/windows/

### Pași de instalare

**Opțiunea 1 — Script automat (recomandat):**
```
Double-click pe PORNESTE.bat
```

**Opțiunea 2 — Manual:**
```bash
# 1. Creați baza de date
psql -U postgres -f backend/setup.sql

# 2. Instalați dependențele backend
cd backend && npm install

# 3. Porniți backend-ul
node src/app.js
# → rulează pe http://localhost:3001

# 4. (Terminal nou) Instalați și porniți frontend-ul
cd frontend && npm install && npm start
# → se deschide automat pe http://localhost:3000
```

---

## 🔐 Conturi Demo

| Email | Parolă | Rol |
|-------|--------|-----|
| admin@pharmanet.ro | pharma123 | Admin Rețea |
| sef@pharmanet.ro | pharma123 | Farmacist Șef |
| farmacist@pharmanet.ro | pharma123 | Farmacist |
| manager@pharmanet.ro | pharma123 | Manager Județ |
| auditor@pharmanet.ro | pharma123 | Auditor |

---

## 🏗 Arhitectură

```
pharmanet/
├── backend/               # Node.js + Express API
│   ├── src/
│   │   ├── app.js         # Entry point
│   │   ├── config/
│   │   │   └── db.js      # PostgreSQL connection pool
│   │   ├── middleware/
│   │   │   └── auth.js    # JWT + RBAC middleware
│   │   └── routes/
│   │       ├── auth.js    # Login, me, change-password
│   │       ├── products.js # CRUD produse
│   │       ├── inventory.js# Stoc, loturi FEFO, NIR, transfer
│   │       └── misc.js    # Analytics, CNAS, farmacii, audit
│   ├── setup.sql          # Schema + date demo PostgreSQL
│   └── .env               # Configurare
│
├── frontend/              # React 18 + Recharts
│   └── src/
│       ├── App.jsx        # Router principal
│       ├── context/       # AuthContext (JWT)
│       ├── pages/         # 13 pagini funcționale
│       ├── components/    # Layout, componente reutilizabile
│       ├── services/      # Axios API client
│       └── hooks/         # useToast, etc.
│
└── PORNESTE.bat           # Script instalare & pornire
```

---

## 💊 Funcționalități Implementate

### Backend (REST API — 35+ endpoint-uri)
- **JWT Authentication** + RBAC (5 roluri)
- **FEFO** implementat ca CTE PostgreSQL cu window function
- **Vânzări atomice** cu tranzacții PostgreSQL BEGIN/COMMIT
- **Transfer inter-farmacii** atomic (TRANSFER_OUT + TRANSFER_IN)
- **Analytics BI** — dashboard KPI, EWMA α=0.3, ABC/XYZ
- **CNAS** — generare XML DRDM v2.0, pseudoanonimizare SHA-256 (GDPR)
- **Audit log** complet cu IP, timestamp, acțiune, detalii JSON
- **Trigger PostgreSQL** pentru sincronizare stoc_curent
- Rate limiting, CORS, Helmet security

### Frontend (React 18)
- **Dashboard live** — Recharts (Line, Bar, Pie)
- **POS Vânzări** — căutare cu debounce, coș interactiv, compensare CNAS automată
- **Loturi FEFO** — codificare cromatică, recepție NIR, marcare lot
- **13 pagini** cu navigare React Router v6
- **Responsive** sidebar navigation

### Baza de Date (PostgreSQL 16)
- **16 tabele** cu relații, indexuri și triggere
- **Index FEFO** partial pe loturi active cu stoc > 0
- **Trigger** sincronizare automată stoc_curent
- **Date demo** — 6 farmacii, 15 produse, 30 zile vânzări (generate procedural PL/pgSQL)

---

## 📊 Schema Baza de Date (principalele tabele)

```
farmacii ←── utilizatori
    ↓
  loturi ───→ stoc_curent (trigger)
    ↓              ↑
miscari_stoc   stoc_minim_farmacie
    
tranzactii ←── linii_tranzactie ←── produse
    ↓
prescriptii ←── pacienti (CNP hash SHA-256)

comenzi_aprovizionare → distribuitori
dosare_cnas ← farmacii
audit_log ← utilizatori
alerte ← farmacii + loturi + produse
```

---

## 🔧 Configurare .env (backend/)

```env
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pharmanet
DB_USER=postgres
DB_PASSWORD=postgres          # Schimbați cu parola PostgreSQL
JWT_SECRET=pharmanet_ase_2025_secret_key
CNAS_SALT=cnas_gdpr_salt_2025
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

---

## 🎓 Utilizare în prezentarea licenței

1. **Deschideți 2 terminale:**
   - Terminal 1: `cd backend && node src/app.js`
   - Terminal 2: `cd frontend && npm start`

2. **Demonstrați în browser (http://localhost:3000):**
   - Login cu `admin@pharmanet.ro` / `pharma123`
   - Dashboard — grafice live cu date din PostgreSQL
   - POS — vânzare cu FEFO automat (verificați în terminal că se execută SQL-ul)
   - Loturi — alertele FEFO cu codificare cromatică
   - CNAS — generare XML DRDM și descărcare

3. **La întrebări tehnice:**
   - "Unde e baza de date?" → `setup.sql` — schema completă, trigger, index FEFO
   - "Cum funcționează FEFO?" → `inventory.js` linia 7-15 — CTE cu SUM() OVER
   - "GDPR?" → `misc.js` → `hashCNP` → SHA-256 + salt
   - "Cum rulați?" → `node src/app.js` + `npm start`
