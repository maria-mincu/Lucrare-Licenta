const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const { search, id_farmacie } = req.query;
    const fId = parseInt(id_farmacie || req.user.id_farmacie || 1);
    let q = `
      SELECT p.id, p.cod_bare_ean, p.denumire_comerciala, p.dci,
             p.forma_farmaceutica, p.regim_eliberare, p.cod_atc,
             p.este_compensat, p.necesita_reteta, p.stoc_minim_implicit,
             COALESCE(sc.cantitate_totala,0)  AS stoc_curent,
             COALESCE(smf.stoc_minim, p.stoc_minim_implicit) AS stoc_minim,
             COALESCE(smf.stoc_maxim, p.stoc_minim_implicit*8) AS stoc_maxim,
             (SELECT l.pret_vanzare FROM loturi l
              WHERE l.id_produs=p.id AND l.id_farmacie=$1
                AND l.status='ACTIV' AND l.cantitate_curenta>0
              ORDER BY l.data_expirare ASC LIMIT 1) AS pret_vanzare,
             (SELECT l.pret_achizitie FROM loturi l
              WHERE l.id_produs=p.id AND l.id_farmacie=$1
                AND l.status='ACTIV' AND l.cantitate_curenta>0
              ORDER BY l.data_expirare ASC LIMIT 1) AS pret_achizitie,
             (SELECT MIN(l.data_expirare) FROM loturi l
              WHERE l.id_produs=p.id AND l.id_farmacie=$1
                AND l.status='ACTIV' AND l.cantitate_curenta>0) AS expirare_urmatoare
      FROM produse p
      LEFT JOIN stoc_curent sc  ON sc.id_produs=p.id  AND sc.id_farmacie=$1
      LEFT JOIN stoc_minim_farmacie smf ON smf.id_produs=p.id AND smf.id_farmacie=$1
      WHERE p.activ=TRUE
    `;
    const params = [fId];
    if (search) { q += ` AND (p.denumire_comerciala ILIKE $2 OR p.dci ILIKE $2 OR p.cod_bare_ean ILIKE $2)`; params.push(`%${search}%`); }
    q += ' ORDER BY p.denumire_comerciala LIMIT 200';
    const { rows } = await db.query(q, params);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', authenticate, authorize('ADMIN_RETEA','FARMACIST_SEF'), async (req, res) => {
  const { denumire_comerciala, dci, forma_farmaceutica, regim_eliberare, cod_atc, este_compensat, necesita_reteta, stoc_minim_implicit, cod_bare_ean } = req.body;
  if (!denumire_comerciala || !dci || !regim_eliberare)
    return res.status(400).json({ success: false, message: 'Câmpuri obligatorii lipsă' });
  try {
    const { rows } = await db.query(
      `INSERT INTO produse(cod_bare_ean,denumire_comerciala,dci,forma_farmaceutica,regim_eliberare,cod_atc,este_compensat,necesita_reteta,stoc_minim_implicit)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [cod_bare_ean||null, denumire_comerciala, dci, forma_farmaceutica||'Comprimate', regim_eliberare, cod_atc||null, este_compensat||false, necesita_reteta||false, stoc_minim_implicit||10]
    );
    await db.query("INSERT INTO audit_log(id_utilizator,actiune,entitate,detalii,ip_client) VALUES($1,'PRODUS_CREAT','produse',$2,$3)",
      [req.user.id, JSON.stringify({ id: rows[0].id, denumire: denumire_comerciala }), req.ip]);
    res.status(201).json({ success: true, data: { id: rows[0].id } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id', authenticate, authorize('ADMIN_RETEA','FARMACIST_SEF'), async (req, res) => {
  const { stoc_minim, id_farmacie } = req.body;
  const fId = parseInt(id_farmacie || req.user.id_farmacie || 1);
  try {
    if (stoc_minim !== undefined) {
      await db.query(
        `INSERT INTO stoc_minim_farmacie(id_farmacie,id_produs,stoc_minim)
         VALUES($1,$2,$3) ON CONFLICT(id_farmacie,id_produs) DO UPDATE SET stoc_minim=$3`,
        [fId, req.params.id, stoc_minim]
      );
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
