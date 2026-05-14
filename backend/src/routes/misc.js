const router  = require('express').Router();
const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
const db      = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

// ── ANALYTICS ────────────────────────────────────────
router.get('/analytics/dashboard', authenticate, async (req, res) => {
  try {
    const fId = req.query.id_farmacie || req.user.id_farmacie;
    const w = fId ? `AND t.id_farmacie=${parseInt(fId)}` : '';
    const wa = fId ? `AND id_farmacie=${parseInt(fId)}` : '';
    const [azi, luna, stoc, alerte, trend, farmacii, topP] = await Promise.all([
      db.query(`SELECT COALESCE(SUM(valoare_bruta),0) tot, COUNT(*) nr FROM tranzactii t WHERE anulata=FALSE AND DATE(data_tranzactie)=CURRENT_DATE ${w}`),
      db.query(`SELECT COALESCE(SUM(valoare_bruta),0) tot, COUNT(*) nr, COALESCE(SUM(valoare_compensata),0) cnas FROM tranzactii t WHERE anulata=FALSE AND DATE_TRUNC('month',data_tranzactie)=DATE_TRUNC('month',CURRENT_DATE) ${w}`),
      db.query(`SELECT COALESCE(SUM(valoare_totala),0) tot FROM stoc_curent WHERE 1=1 ${wa}`),
      db.query(`SELECT COUNT(*) nr FROM loturi WHERE status='ACTIV' AND cantitate_curenta>0 AND data_expirare < CURRENT_DATE+INTERVAL '90 days' ${wa}`),
      db.query(`SELECT DATE(data_tranzactie) zi, SUM(valoare_bruta) total, SUM(valoare_compensata) cnas, COUNT(*) nr FROM tranzactii t WHERE anulata=FALSE AND data_tranzactie>=CURRENT_DATE-INTERVAL '30 days' ${w} GROUP BY DATE(data_tranzactie) ORDER BY zi`),
      db.query(`SELECT f.id,f.cod,f.denumire,f.localitate,f.judet,f.target_lunar,
        COALESCE(SUM(CASE WHEN DATE_TRUNC('month',t.data_tranzactie)=DATE_TRUNC('month',CURRENT_DATE) THEN t.valoare_bruta END),0) vanzari_luna,
        COALESCE(SUM(CASE WHEN DATE(t.data_tranzactie)=CURRENT_DATE THEN t.valoare_bruta END),0) vanzari_azi,
        COUNT(CASE WHEN DATE(t.data_tranzactie)=CURRENT_DATE THEN 1 END) tranzactii_azi
        FROM farmacii f LEFT JOIN tranzactii t ON t.id_farmacie=f.id AND t.anulata=FALSE WHERE f.activa=TRUE GROUP BY f.id ORDER BY f.id`),
      db.query(`SELECT lt.id_produs, p.denumire_comerciala, SUM(lt.valoare_linie) val, SUM(lt.cantitate) qty FROM linii_tranzactie lt JOIN tranzactii t ON t.id=lt.id_tranzactie JOIN produse p ON p.id=lt.id_produs WHERE t.anulata=FALSE AND t.data_tranzactie>=CURRENT_DATE-INTERVAL '30 days' ${w.replace('t.id_farmacie','t.id_farmacie')} GROUP BY lt.id_produs,p.denumire_comerciala ORDER BY val DESC LIMIT 6`)
    ]);
    res.json({ success: true, data: {
      vanzari_azi: { total: +azi.rows[0].tot, nr: +azi.rows[0].nr },
      vanzari_luna: { total: +luna.rows[0].tot, nr: +luna.rows[0].nr, cnas: +luna.rows[0].cnas },
      valoare_stoc: +stoc.rows[0].tot,
      alerte_fefo: +alerte.rows[0].nr,
      trend_30_zile: trend.rows,
      farmacii: farmacii.rows,
      top_produse: topP.rows
    }});
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/analytics/ewma', authenticate, async (req, res) => {
  try {
    const fId = parseInt(req.query.id_farmacie || req.user.id_farmacie || 1);
    const alpha = parseFloat(req.query.alpha) || 0.3;
    const { rows } = await db.query(`
      SELECT DATE(data_tranzactie) zi, SUM(valoare_bruta) total
      FROM tranzactii WHERE id_farmacie=$1 AND anulata=FALSE
        AND data_tranzactie >= CURRENT_DATE-INTERVAL '30 days'
      GROUP BY DATE(data_tranzactie) ORDER BY zi
    `, [fId]);
    let ewma = rows[0] ? +rows[0].total : 0;
    const result = rows.map((r, i) => {
      if (i > 0) ewma = alpha * +r.total + (1 - alpha) * ewma;
      return { zi: r.zi, vanzari: +r.total, ewma: Math.round(ewma * 100) / 100 };
    });
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/analytics/abc-xyz', authenticate, async (req, res) => {
  try {
    const fId = parseInt(req.query.id_farmacie || req.user.id_farmacie || 1);
    const { rows } = await db.query(`
      WITH saptamani AS (
        SELECT lt.id_produs, DATE_TRUNC('week',t.data_tranzactie) s,
               SUM(lt.cantitate) cant, SUM(lt.valoare_linie) val
        FROM linii_tranzactie lt JOIN tranzactii t ON t.id=lt.id_tranzactie
        WHERE t.id_farmacie=$1 AND t.anulata=FALSE AND t.data_tranzactie>=CURRENT_DATE-INTERVAL '52 weeks'
        GROUP BY lt.id_produs, DATE_TRUNC('week',t.data_tranzactie)
      ),
      stats AS (
        SELECT id_produs, AVG(cant) medie, COALESCE(STDDEV(cant),0) sigma, SUM(val) val_tot
        FROM saptamani GROUP BY id_produs
      ),
      ranked AS (
        SELECT *, CASE WHEN medie>0 THEN sigma/medie ELSE 0 END cv,
               SUM(val_tot) OVER (ORDER BY val_tot DESC) cumul,
               SUM(val_tot) OVER () tot_all
        FROM stats
      )
      SELECT r.*, p.denumire_comerciala, p.dci, p.regim_eliberare, p.este_compensat,
             COALESCE(sc.cantitate_totala,0) stoc_curent,
             CASE WHEN tot_all>0 AND cumul/tot_all<=0.8 THEN 'A' WHEN tot_all>0 AND cumul/tot_all<=0.95 THEN 'B' ELSE 'C' END abc,
             CASE WHEN (CASE WHEN medie>0 THEN sigma/medie ELSE 0 END)<0.5 THEN 'X' WHEN (CASE WHEN medie>0 THEN sigma/medie ELSE 0 END)<1.0 THEN 'Y' ELSE 'Z' END xyz
      FROM ranked r JOIN produse p ON p.id=r.id_produs
      LEFT JOIN stoc_curent sc ON sc.id_produs=r.id_produs AND sc.id_farmacie=$1
      ORDER BY val_tot DESC
    `, [fId]);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── CNAS ─────────────────────────────────────────────
router.get('/cnas/sumar/:luna/:an/:fId', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT COUNT(*) nr, COALESCE(SUM(valoare_compensata),0) comp, COALESCE(SUM(valoare_incasata),0) incasat
      FROM tranzactii
      WHERE id_farmacie=$1 AND EXTRACT(MONTH FROM data_tranzactie)=$2 AND EXTRACT(YEAR FROM data_tranzactie)=$3
        AND valoare_compensata>0 AND anulata=FALSE
    `, [req.params.fId, req.params.luna, req.params.an]);
    res.json({ success: true, data: rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/cnas/drdm/:luna/:an/:fId', authenticate, authorize('ADMIN_RETEA','FARMACIST_SEF','MANAGER_JUDET'), async (req, res) => {
  const { luna, an, fId } = req.params;
  try {
    const { rows: [farm] } = await db.query('SELECT * FROM farmacii WHERE id=$1', [fId]);
    if (!farm) return res.status(404).json({ success: false, message: 'Farmacie negăsită' });
    const { rows: retete } = await db.query(`
      SELECT t.id, t.numar_bon, t.data_tranzactie, t.valoare_compensata, t.valoare_incasata,
             t.modalitate_plata,
             STRING_AGG(DISTINCT pd.denumire_comerciala, ', ') produse_den,
             STRING_AGG(DISTINCT pd.dci, ', ') produse_dci,
             SUM(lt.cantitate) cant_tot
      FROM tranzactii t
      JOIN linii_tranzactie lt ON lt.id_tranzactie=t.id AND lt.este_compensat=TRUE
      JOIN produse pd ON pd.id=lt.id_produs
      WHERE t.id_farmacie=$1 AND EXTRACT(MONTH FROM t.data_tranzactie)=$2
        AND EXTRACT(YEAR FROM t.data_tranzactie)=$3 AND t.valoare_compensata>0 AND t.anulata=FALSE
      GROUP BY t.id ORDER BY t.data_tranzactie
    `, [fId, luna, an]);
    const hashCNP = (s) => crypto.createHash('sha256').update(s + (process.env.CNAS_SALT || 'salt')).digest('hex');
    const totalComp = retete.reduce((s, r) => s + +r.valoare_compensata, 0);
    const totalCopl = retete.reduce((s, r) => s + Math.max(0, +r.valoare_incasata - +r.valoare_compensata), 0);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DRDM xmlns="http://cnas.ro/drdm/v2.0" versiune="2.0" luna="${luna}" an="${an}" dataGenerare="${new Date().toISOString().slice(0,10)}">
  <Farmacie cod="${farm.cod}" denumire="${farm.denumire}">
    <Localitate>${farm.localitate}</Localitate>
    <Judet>${farm.judet}</Judet>
  </Farmacie>
  <Sumar>
    <NrRetete>${retete.length}</NrRetete>
    <ValoareTotalaCompensata>${totalComp.toFixed(2)}</ValoareTotalaCompensata>
    <ValoareTotalaCoplata>${totalCopl.toFixed(2)}</ValoareTotalaCoplata>
  </Sumar>
  <Retete>
${retete.map((r, i) => `    <Reteta nr="${i+1}">
      <CodReteta>${r.numar_bon}</CodReteta>
      <DataEliberare>${new Date(r.data_tranzactie).toISOString().slice(0,10)}</DataEliberare>
      <PacientHash>${hashCNP('PACIENT_' + r.id)}</PacientHash>
      <Produse>${r.produse_den}</Produse>
      <DCI>${r.produse_dci}</DCI>
      <ValoareCompensata>${parseFloat(r.valoare_compensata).toFixed(2)}</ValoareCompensata>
      <Coplata>${Math.max(0, +r.valoare_incasata - +r.valoare_compensata).toFixed(2)}</Coplata>
    </Reteta>`).join('\n')}
  </Retete>
</DRDM>`;
    await db.query(`INSERT INTO dosare_cnas(id_farmacie,luna,an,nr_retete,valoare_compensata,valoare_coplata,status)
      VALUES($1,$2,$3,$4,$5,$6,'GENERAT') ON CONFLICT(id_farmacie,luna,an) DO UPDATE SET nr_retete=$4,valoare_compensata=$5,valoare_coplata=$6,data_generare=NOW()`,
      [fId, luna, an, retete.length, totalComp.toFixed(2), totalCopl.toFixed(2)]);
    await db.query("INSERT INTO audit_log(id_utilizator,actiune,entitate,detalii,ip_client) VALUES($1,'DRDM_GENERAT','dosare_cnas',$2,$3)",
      [req.user.id, JSON.stringify({ luna, an, fId }), req.ip]);
    res.setHeader('Content-Type', 'application/xml;charset=UTF-8');
    res.setHeader('Content-Disposition', `attachment; filename="DRDM_${an}_${String(luna).padStart(2,'0')}_${farm.cod}.xml"`);
    res.send(xml);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/cnas/dosare', authenticate, async (req, res) => {
  const fId = req.query.id_farmacie || req.user.id_farmacie;
  try {
    let q = `SELECT dc.*, f.denumire farmacie, f.cod cod_farmacie FROM dosare_cnas dc JOIN farmacii f ON f.id=dc.id_farmacie WHERE 1=1`;
    const p = [];
    if (fId) { q += ` AND dc.id_farmacie=$1`; p.push(fId); }
    q += ' ORDER BY dc.an DESC, dc.luna DESC';
    const { rows } = await db.query(q, p);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── FARMACII ─────────────────────────────────────────
router.get('/farmacii', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT f.*,
        COALESCE(SUM(CASE WHEN DATE_TRUNC('month',t.data_tranzactie)=DATE_TRUNC('month',CURRENT_DATE) THEN t.valoare_bruta END),0) vanzari_luna,
        COALESCE(SUM(CASE WHEN DATE(t.data_tranzactie)=CURRENT_DATE THEN t.valoare_bruta END),0) vanzari_azi,
        COUNT(CASE WHEN DATE(t.data_tranzactie)=CURRENT_DATE THEN 1 END) tranzactii_azi
      FROM farmacii f LEFT JOIN tranzactii t ON t.id_farmacie=f.id AND t.anulata=FALSE
      WHERE f.activa=TRUE GROUP BY f.id ORDER BY f.id`);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── COMENZI ──────────────────────────────────────────
router.get('/comenzi', authenticate, async (req, res) => {
  const fId = req.query.id_farmacie || req.user.id_farmacie;
  try {
    let q = `SELECT c.*,f.denumire farmacie,d.denumire distribuitor FROM comenzi_aprovizionare c JOIN farmacii f ON f.id=c.id_farmacie LEFT JOIN distribuitori d ON d.id=c.id_distribuitor WHERE 1=1`;
    const p = [];
    if (fId) { q += ` AND c.id_farmacie=$1`; p.push(fId); }
    q += ' ORDER BY c.created_at DESC';
    const { rows } = await db.query(q, p);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/comenzi', authenticate, async (req, res) => {
  const { id_farmacie, id_distribuitor, data_livrare_estimata, valoare_totala } = req.body;
  if (!id_farmacie) return res.status(400).json({ success: false, message: 'Farmacia lipsă' });
  try {
    const numar = `CMD-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const { rows } = await db.query(
      `INSERT INTO comenzi_aprovizionare(numar_comanda,id_farmacie,id_distribuitor,id_utilizator,data_livrare_estimata,valoare_totala,status)
       VALUES($1,$2,$3,$4,$5,$6,'TRIMISA') RETURNING id`,
      [numar, id_farmacie, id_distribuitor||null, req.user.id, data_livrare_estimata||null, valoare_totala||0]
    );
    await db.query("INSERT INTO audit_log(id_utilizator,actiune,entitate,detalii,ip_client) VALUES($1,'COMANDA_CREATA','comenzi',$2,$3)",
      [req.user.id, JSON.stringify({ id: rows[0].id, numar }), req.ip]);
    res.status(201).json({ success: true, data: { id: rows[0].id, numar_comanda: numar } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.patch('/comenzi/:id/status', authenticate, async (req, res) => {
  const { status } = req.body;
  try {
    const extra = status === 'LIVRATA' ? ',data_livrare_efectiva=CURRENT_DATE' : '';
    await db.query(`UPDATE comenzi_aprovizionare SET status=$1${extra} WHERE id=$2`, [status, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── DISTRIBUITORI ────────────────────────────────────
router.get('/distribuitori', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM distribuitori WHERE activ=TRUE ORDER BY denumire');
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/distribuitori', authenticate, authorize('ADMIN_RETEA','MANAGER_JUDET'), async (req, res) => {
  const { denumire, contact, telefon, activ } = req.body;
  if (!denumire) return res.status(400).json({ success: false, message: 'Denumire distribuitor lipsă' });
  try {
    const { rows } = await db.query(
      'INSERT INTO distribuitori(denumire,contact,telefon,activ) VALUES($1,$2,$3,$4) RETURNING id',
      [denumire, contact||null, telefon||null, activ===false ? false : true]
    );
    await db.query("INSERT INTO audit_log(id_utilizator,actiune,entitate,detalii,ip_client) VALUES($1,'DISTRIBUITOR_CREAT','distribuitori',$2,$3)",
      [req.user.id, JSON.stringify({ id: rows[0].id, denumire }), req.ip]);
    res.status(201).json({ success: true, data: { id: rows[0].id } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/distribuitori/:id', authenticate, authorize('ADMIN_RETEA','MANAGER_JUDET'), async (req, res) => {
  const { denumire, contact, telefon, activ } = req.body;
  if (!denumire) return res.status(400).json({ success: false, message: 'Denumire distribuitor lipsă' });
  try {
    await db.query(
      'UPDATE distribuitori SET denumire=$1, contact=$2, telefon=$3, activ=$4 WHERE id=$5',
      [denumire, contact||null, telefon||null, activ===false ? false : true, req.params.id]
    );
    await db.query("INSERT INTO audit_log(id_utilizator,actiune,entitate,detalii,ip_client) VALUES($1,'DISTRIBUITOR_ACTUALIZAT','distribuitori',$2,$3)",
      [req.user.id, JSON.stringify({ id: req.params.id, denumire, activ }), req.ip]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── UTILIZATORI ──────────────────────────────────────
router.get('/utilizatori', authenticate, authorize('ADMIN_RETEA','MANAGER_JUDET'), async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT u.id,u.email,u.nume,u.rol,u.id_farmacie,u.activ,u.ultima_autentificare,f.denumire farmacie FROM utilizatori u LEFT JOIN farmacii f ON f.id=u.id_farmacie ORDER BY u.id`);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/utilizatori', authenticate, authorize('ADMIN_RETEA'), async (req, res) => {
  const { email, password, nume, rol, id_farmacie } = req.body;
  if (!email || !password || !nume || !rol) return res.status(400).json({ success: false, message: 'Date incomplete' });
  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
      'INSERT INTO utilizatori(email,password_hash,nume,rol,id_farmacie) VALUES($1,$2,$3,$4,$5) RETURNING id',
      [email.toLowerCase(), hash, nume, rol, id_farmacie||null]
    );
    await db.query("INSERT INTO audit_log(id_utilizator,actiune,entitate,detalii,ip_client) VALUES($1,'UTILIZATOR_CREAT','utilizatori',$2,$3)",
      [req.user.id, JSON.stringify({ id: rows[0].id, email, rol }), req.ip]);
    res.status(201).json({ success: true, data: { id: rows[0].id } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'Email deja existent' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/utilizatori/:id', authenticate, authorize('ADMIN_RETEA'), async (req, res) => {
  const { email, password, nume, rol, id_farmacie, activ } = req.body;
  const updates = [];
  const values = [];
  let idx = 1;

  if (!email || !nume || !rol) return res.status(400).json({ success: false, message: 'Date incomplete' });
  values.push(email.toLowerCase()); updates.push(`email=$${idx++}`);
  values.push(nume); updates.push(`nume=$${idx++}`);
  values.push(rol); updates.push(`rol=$${idx++}`);
  values.push(id_farmacie || null); updates.push(`id_farmacie=$${idx++}`);
  if (activ !== undefined) { values.push(activ); updates.push(`activ=$${idx++}`); }
  if (password) {
    const hash = await bcrypt.hash(password, 12);
    values.push(hash); updates.push(`password_hash=$${idx++}`);
  }
  values.push(req.params.id);
  const q = `UPDATE utilizatori SET ${updates.join(', ')} WHERE id=$${idx}`;
  try {
    await db.query(q, values);
    await db.query("INSERT INTO audit_log(id_utilizator,actiune,entitate,detalii,ip_client) VALUES($1,'UTILIZATOR_ACTUALIZAT','utilizatori',$2,$3)",
      [req.user.id, JSON.stringify({ id: req.params.id, email, rol, activ }), req.ip]);
    res.json({ success: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'Email deja existent' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── ALERTE ───────────────────────────────────────────
router.get('/alerte', authenticate, async (req, res) => {
  const fId = req.query.id_farmacie || req.user.id_farmacie;
  try {
    let q = `SELECT a.*,p.denumire_comerciala,f.denumire farmacie FROM alerte a LEFT JOIN produse p ON p.id=a.id_produs JOIN farmacii f ON f.id=a.id_farmacie WHERE a.rezolvata=FALSE`;
    const pa = []; if (fId) { q += ` AND a.id_farmacie=$1`; pa.push(fId); }
    q += ' ORDER BY a.created_at DESC';
    const { rows } = await db.query(q, pa);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── AUDIT ────────────────────────────────────────────
router.get('/audit', authenticate, authorize('ADMIN_RETEA','AUDITOR','MANAGER_JUDET'), async (req, res) => {
  try {
    const { search, actiune, entitate, user, from, to } = req.query;
    let q = `SELECT al.*,u.email,u.rol,u.nume FROM audit_log al LEFT JOIN utilizatori u ON u.id=al.id_utilizator WHERE 1=1`;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      q += ` AND (al.actiune ILIKE $${params.length} OR al.entitate ILIKE $${params.length} OR al.detalii::text ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.nume ILIKE $${params.length})`;
    }
    if (actiune) {
      params.push(actiune);
      q += ` AND al.actiune = $${params.length}`;
    }
    if (entitate) {
      params.push(entitate);
      q += ` AND al.entitate = $${params.length}`;
    }
    if (user) {
      params.push(`%${user}%`);
      q += ` AND (u.email ILIKE $${params.length} OR u.nume ILIKE $${params.length})`;
    }
    if (from) {
      params.push(from);
      q += ` AND al.created_at >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      q += ` AND al.created_at <= $${params.length}`;
    }

    params.push(parseInt(req.query.limit) || 300);
    q += ` ORDER BY al.created_at DESC LIMIT $${params.length}`;

    const { rows } = await db.query(q, params);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── HEALTH ───────────────────────────────────────────
router.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ success: true, status: 'OK', db: 'connected', ts: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, status: 'DB_ERROR', message: err.message });
  }
});

module.exports = router;
