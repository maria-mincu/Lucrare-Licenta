const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

// ── FEFO helper ───────────────────────────────────────
const fefoLots = async (client, id_produs, id_farmacie, qty) => {
  const { rows } = await client.query(`
    WITH fefo AS (
      SELECT id, cantitate_curenta, data_expirare, pret_achizitie, pret_vanzare,
             SUM(cantitate_curenta) OVER (ORDER BY data_expirare ASC) AS cumul
      FROM loturi
      WHERE id_produs=$1 AND id_farmacie=$2 AND status='ACTIV' AND cantitate_curenta>0
    )
    SELECT * FROM fefo WHERE cumul - cantitate_curenta < $3
    ORDER BY data_expirare ASC
  `, [id_produs, id_farmacie, qty]);
  return rows;
};

// ── STOC ─────────────────────────────────────────────
router.get('/stoc', authenticate, async (req, res) => {
  const fId = parseInt(req.query.id_farmacie || req.user.id_farmacie || 1);
  try {
    const { rows } = await db.query(`
      SELECT sc.*, p.denumire_comerciala, p.dci, p.regim_eliberare, p.este_compensat, p.cod_atc,
             COALESCE(smf.stoc_minim, p.stoc_minim_implicit) AS stoc_minim,
             COALESCE(smf.stoc_maxim, p.stoc_minim_implicit*8) AS stoc_maxim,
             (sc.cantitate_totala < COALESCE(smf.stoc_minim,p.stoc_minim_implicit)) AS sub_minim,
             (SELECT MIN(l.data_expirare) FROM loturi l WHERE l.id_produs=sc.id_produs AND l.id_farmacie=$1 AND l.status='ACTIV' AND l.cantitate_curenta>0) AS expirare_next,
             (SELECT l.pret_vanzare FROM loturi l WHERE l.id_produs=sc.id_produs AND l.id_farmacie=$1 AND l.status='ACTIV' AND l.cantitate_curenta>0 ORDER BY l.data_expirare ASC LIMIT 1) AS pret_vanzare,
             (SELECT l.pret_achizitie FROM loturi l WHERE l.id_produs=sc.id_produs AND l.id_farmacie=$1 AND l.status='ACTIV' AND l.cantitate_curenta>0 ORDER BY l.data_expirare ASC LIMIT 1) AS pret_achizitie
      FROM stoc_curent sc
      JOIN produse p ON p.id=sc.id_produs
      LEFT JOIN stoc_minim_farmacie smf ON smf.id_produs=sc.id_produs AND smf.id_farmacie=$1
      WHERE sc.id_farmacie=$1
      ORDER BY p.denumire_comerciala
    `, [fId]);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── LOTURI ───────────────────────────────────────────
router.get('/loturi', authenticate, async (req, res) => {
  const fId = req.query.id_farmacie || req.user.id_farmacie;
  try {
    let q = `
      SELECT l.*, (l.data_expirare - CURRENT_DATE) AS zile_exp,
             (l.cantitate_curenta * l.pret_achizitie) AS valoare_risc,
             p.denumire_comerciala, p.dci, p.regim_eliberare,
             f.denumire AS farmacie, f.cod AS cod_farmacie
      FROM loturi l
      JOIN produse p ON p.id=l.id_produs
      JOIN farmacii f ON f.id=l.id_farmacie
      WHERE 1=1
    `;
    const params = [];
    if (fId) { q += ` AND l.id_farmacie=$1`; params.push(fId); }
    q += ' ORDER BY l.data_expirare ASC';
    const { rows } = await db.query(q, params);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── NIR ──────────────────────────────────────────────
router.post('/nir', authenticate, authorize('ADMIN_RETEA','FARMACIST_SEF','OPERATOR_STOC'), async (req, res) => {
  const { id_produs, id_farmacie, numar_lot, data_expirare, cantitate, pret_achizitie, pret_vanzare, id_distribuitor } = req.body;
  if (!id_produs || !id_farmacie || !numar_lot || !data_expirare || !cantitate)
    return res.status(400).json({ success: false, message: 'Date incomplete' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: [lot] } = await client.query(
      `INSERT INTO loturi(id_produs,id_farmacie,numar_lot,data_expirare,cantitate_initiala,cantitate_curenta,pret_achizitie,pret_vanzare,id_distribuitor)
       VALUES($1,$2,$3,$4,$5,$5,$6,$7,$8) RETURNING id`,
      [id_produs, id_farmacie, numar_lot, data_expirare, cantitate, pret_achizitie||0, pret_vanzare||0, id_distribuitor||null]
    );
    await client.query(
      `INSERT INTO miscari_stoc(id_lot,id_farmacie,tip_miscare,cantitate,pret_unitar,valoare_totala,id_utilizator)
       VALUES($1,$2,'INTRARE',$3,$4,$5,$6)`,
      [lot.id, id_farmacie, cantitate, pret_achizitie||0, (pret_achizitie||0)*cantitate, req.user.id]
    );
    await client.query("INSERT INTO audit_log(id_utilizator,actiune,entitate,detalii,ip_client) VALUES($1,'NIR_CREAT','loturi',$2,$3)",
      [req.user.id, JSON.stringify({ lot_id: lot.id, cantitate }), req.ip]);
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: { id_lot: lot.id } });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: err.message });
  } finally { client.release(); }
});

// ── TRANSFER ─────────────────────────────────────────
router.post('/transfer', authenticate, authorize('ADMIN_RETEA','FARMACIST_SEF'), async (req, res) => {
  const { id_produs, id_farmacie_sursa, id_farmacie_dest, cantitate } = req.body;
  if (!id_produs || !id_farmacie_sursa || !id_farmacie_dest || !cantitate)
    return res.status(400).json({ success: false, message: 'Date incomplete' });
  if (id_farmacie_sursa === id_farmacie_dest)
    return res.status(400).json({ success: false, message: 'Sursa = destinația' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const lots = await fefoLots(client, id_produs, id_farmacie_sursa, cantitate);
    if (!lots.length) { await client.query('ROLLBACK'); return res.status(409).json({ success: false, message: 'Stoc insuficient' }); }
    let remaining = cantitate;
    for (const lot of lots) {
      const q = Math.min(remaining, lot.cantitate_curenta);
      await client.query('UPDATE loturi SET cantitate_curenta=cantitate_curenta-$1 WHERE id=$2', [q, lot.id]);
      await client.query(`INSERT INTO miscari_stoc(id_lot,id_farmacie,tip_miscare,cantitate,pret_unitar,valoare_totala,id_utilizator) VALUES($1,$2,'TRANSFER_OUT',$3,$4,$5,$6)`,
        [lot.id, id_farmacie_sursa, q, lot.pret_achizitie, lot.pret_achizitie*q, req.user.id]);
      const { rows: [nl] } = await client.query(
        `INSERT INTO loturi(id_produs,id_farmacie,numar_lot,data_expirare,cantitate_initiala,cantitate_curenta,pret_achizitie,pret_vanzare)
         VALUES($1,$2,$3,$4,$5,$5,$6,$7) RETURNING id`,
        [id_produs, id_farmacie_dest, lot.numar_lot+'-TR', lot.data_expirare, q, lot.pret_achizitie, lot.pret_vanzare]
      );
      await client.query(`INSERT INTO miscari_stoc(id_lot,id_farmacie,tip_miscare,cantitate,pret_unitar,valoare_totala,id_utilizator) VALUES($1,$2,'TRANSFER_IN',$3,$4,$5,$6)`,
        [nl.id, id_farmacie_dest, q, lot.pret_achizitie, lot.pret_achizitie*q, req.user.id]);
      remaining -= q;
      if (remaining <= 0) break;
    }
    await client.query("INSERT INTO audit_log(id_utilizator,actiune,entitate,detalii,ip_client) VALUES($1,'TRANSFER_STOC','stocuri',$2,$3)",
      [req.user.id, JSON.stringify({ id_produs, cantitate, sursa: id_farmacie_sursa, dest: id_farmacie_dest }), req.ip]);
    await client.query('COMMIT');
    res.json({ success: true, message: `Transfer OK: ${cantitate} buc` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: err.message });
  } finally { client.release(); }
});

// ── STATUS LOT ───────────────────────────────────────
router.patch('/lot/:id/status', authenticate, authorize('ADMIN_RETEA','FARMACIST_SEF'), async (req, res) => {
  const { status } = req.body;
  try {
    await db.query('UPDATE loturi SET status=$1 WHERE id=$2', [status, req.params.id]);
    await db.query("INSERT INTO audit_log(id_utilizator,actiune,entitate,detalii,ip_client) VALUES($1,'LOT_STATUS','loturi',$2,$3)",
      [req.user.id, JSON.stringify({ id: req.params.id, status }), req.ip]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── VANZARI ──────────────────────────────────────────
router.get('/vanzari', authenticate, async (req, res) => {
  const { id_farmacie, limit } = req.query;
  const fId = id_farmacie || req.user.id_farmacie;
  try {
    let q = `SELECT t.id, t.numar_bon, t.id_farmacie, t.data_tranzactie,
               t.valoare_bruta, t.valoare_compensata, t.valoare_incasata,
               t.modalitate_plata, t.anulata,
               f.denumire AS farmacie, u.nume AS utilizator,
               (SELECT COUNT(*) FROM linii_tranzactie lt WHERE lt.id_tranzactie=t.id) AS nr_produse
             FROM tranzactii t
             JOIN farmacii f ON f.id=t.id_farmacie
             LEFT JOIN utilizatori u ON u.id=t.id_utilizator
             WHERE t.anulata=FALSE`;
    const params = [];
    if (fId) { q += ` AND t.id_farmacie=$1`; params.push(fId); }
    q += ` ORDER BY t.data_tranzactie DESC LIMIT $${params.length+1}`;
    params.push(parseInt(limit)||100);
    const { rows } = await db.query(q, params);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/vanzari', authenticate, authorize('ADMIN_RETEA','FARMACIST_SEF','FARMACIST'), async (req, res) => {
  const { id_farmacie, linii, modalitate_plata } = req.body;
  if (!id_farmacie || !linii?.length)
    return res.status(400).json({ success: false, message: 'Date incomplete' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    let val_bruta = 0, val_comp = 0;
    const liniiOK = [];
    for (const l of linii) {
      const lots = await fefoLots(client, l.id_produs, id_farmacie, l.cantitate);
      if (!lots.length) { await client.query('ROLLBACK'); return res.status(409).json({ success: false, message: `Stoc insuficient produs ${l.id_produs}` }); }
      let rem = l.cantitate;
      for (const lot of lots) {
        const q = Math.min(rem, lot.cantitate_curenta);
        const pret = l.pret_vanzare || lot.pret_vanzare || 0;
        const val = parseFloat((pret * q).toFixed(2));
        const comp = l.este_compensat ? parseFloat((val * 0.7).toFixed(2)) : 0;
        val_bruta += val; val_comp += comp;
        liniiOK.push({ id_lot: lot.id, id_produs: l.id_produs, qty: q, pret, val, comp, coplata: val - comp, este_comp: l.este_compensat||false });
        await client.query('UPDATE loturi SET cantitate_curenta=cantitate_curenta-$1 WHERE id=$2', [q, lot.id]);
        rem -= q; if (rem <= 0) break;
      }
    }
    const bon = `BON-${Date.now()}`;
    const { rows: [tr] } = await client.query(
      `INSERT INTO tranzactii(numar_bon,id_farmacie,id_utilizator,data_tranzactie,valoare_bruta,valoare_tva,valoare_compensata,valoare_incasata,modalitate_plata)
       VALUES($1,$2,$3,NOW(),$4,$5,$6,$7,$8) RETURNING id`,
      [bon, id_farmacie, req.user.id,
       parseFloat(val_bruta.toFixed(2)), parseFloat((val_bruta*0.09).toFixed(2)),
       parseFloat(val_comp.toFixed(2)), parseFloat((val_bruta-val_comp).toFixed(2)),
       modalitate_plata||'NUMERAR']
    );
    for (const l of liniiOK) {
      await client.query(
        `INSERT INTO linii_tranzactie(id_tranzactie,id_produs,id_lot,cantitate,pret_vanzare_unitar,valoare_linie,valoare_tva,este_compensat,valoare_compensata,coplata)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [tr.id, l.id_produs, l.id_lot, l.qty, l.pret, l.val, l.val*0.09, l.este_comp, l.comp, l.coplata]
      );
      await client.query(
        `INSERT INTO miscari_stoc(id_lot,id_farmacie,tip_miscare,cantitate,pret_unitar,valoare_totala,id_utilizator)
         VALUES($1,$2,'IESIRE',$3,$4,$5,$6)`,
        [l.id_lot, id_farmacie, l.qty, l.pret, l.val, req.user.id]
      );
    }
    await client.query("INSERT INTO audit_log(id_utilizator,actiune,entitate,detalii,ip_client) VALUES($1,'VANZARE_FINALIZATA','tranzactii',$2,$3)",
      [req.user.id, JSON.stringify({ bon, total: val_bruta }), req.ip]);
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: { id: tr.id, numar_bon: bon, total: parseFloat(val_bruta.toFixed(2)) } });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: err.message });
  } finally { client.release(); }
});

module.exports = router;
