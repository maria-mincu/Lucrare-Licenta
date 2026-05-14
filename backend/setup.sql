-- ============================================================
-- PharmaNET Pro - Setup complet PostgreSQL
-- Rulare: psql -U postgres -f setup.sql
-- ============================================================

DROP DATABASE IF EXISTS pharmanet;
CREATE DATABASE pharmanet WITH ENCODING='UTF8' LC_COLLATE='en_US.UTF-8' LC_CTYPE='en_US.UTF-8' TEMPLATE=template0;
\c pharmanet
SET client_encoding TO 'UTF8';

-- TIPURI
CREATE TYPE regim_eliberare AS ENUM ('OTC','PRF','PRF-S','P6L','STUPEFIANT');
CREATE TYPE status_lot AS ENUM ('ACTIV','QUARANTA','RETRAS','EXPIRAT','RETURNAT');
CREATE TYPE rol_utilizator AS ENUM ('ADMIN_RETEA','MANAGER_JUDET','FARMACIST_SEF','FARMACIST','OPERATOR_STOC','AUDITOR');
CREATE TYPE status_comanda AS ENUM ('DRAFT','TRIMISA','CONFIRMATA','LIVRATA','ANULATA');
CREATE TYPE tip_miscare AS ENUM ('INTRARE','IESIRE','AJ_PLUS','AJ_MINUS','TRANSFER_IN','TRANSFER_OUT','CASARE');

-- FARMACII
CREATE TABLE farmacii (
  id SERIAL PRIMARY KEY,
  cod VARCHAR(10) NOT NULL UNIQUE,
  denumire VARCHAR(100) NOT NULL,
  localitate VARCHAR(100) NOT NULL,
  judet VARCHAR(50) NOT NULL,
  adresa VARCHAR(200),
  telefon VARCHAR(20),
  email VARCHAR(100),
  target_lunar DECIMAL(12,2) DEFAULT 0,
  nr_angajati INT DEFAULT 3,
  suprafata_mp INT DEFAULT 80,
  activa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- UTILIZATORI
CREATE TABLE utilizatori (
  id SERIAL PRIMARY KEY,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  nume VARCHAR(100) NOT NULL,
  rol rol_utilizator NOT NULL DEFAULT 'FARMACIST',
  id_farmacie INT REFERENCES farmacii(id),
  activ BOOLEAN DEFAULT TRUE,
  ultima_autentificare TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- CATEGORII ATC
CREATE TABLE categorii_atc (
  id SERIAL PRIMARY KEY,
  cod VARCHAR(10) NOT NULL UNIQUE,
  denumire VARCHAR(200) NOT NULL
);

-- PRODUCATORI
CREATE TABLE producatori (
  id SERIAL PRIMARY KEY,
  denumire VARCHAR(150) NOT NULL,
  tara VARCHAR(50),
  activ BOOLEAN DEFAULT TRUE
);

-- DISTRIBUITORI
CREATE TABLE distribuitori (
  id SERIAL PRIMARY KEY,
  denumire VARCHAR(150) NOT NULL,
  cui VARCHAR(20),
  telefon VARCHAR(20),
  email VARCHAR(100),
  activ BOOLEAN DEFAULT TRUE
);

-- PRODUSE
CREATE TABLE produse (
  id SERIAL PRIMARY KEY,
  cod_bare_ean VARCHAR(20) UNIQUE,
  denumire_comerciala VARCHAR(200) NOT NULL,
  dci VARCHAR(200) NOT NULL,
  forma_farmaceutica VARCHAR(100),
  concentratie VARCHAR(50),
  cod_atc VARCHAR(10),
  id_producator INT REFERENCES producatori(id),
  regim_eliberare regim_eliberare NOT NULL DEFAULT 'OTC',
  cota_tva DECIMAL(4,2) DEFAULT 9.00,
  este_compensat BOOLEAN DEFAULT FALSE,
  necesita_reteta BOOLEAN DEFAULT FALSE,
  este_stupefiant BOOLEAN DEFAULT FALSE,
  stoc_minim_implicit INT DEFAULT 10,
  activ BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- LOTURI
CREATE TABLE loturi (
  id SERIAL PRIMARY KEY,
  id_produs INT NOT NULL REFERENCES produse(id),
  id_farmacie INT NOT NULL REFERENCES farmacii(id),
  numar_lot VARCHAR(50) NOT NULL,
  data_fabricatie DATE,
  data_expirare DATE NOT NULL,
  cantitate_initiala INT NOT NULL,
  cantitate_curenta INT NOT NULL,
  pret_achizitie DECIMAL(10,4) DEFAULT 0,
  pret_vanzare DECIMAL(10,4) DEFAULT 0,
  id_distribuitor INT REFERENCES distribuitori(id),
  status status_lot NOT NULL DEFAULT 'ACTIV',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- INDEX FEFO
CREATE INDEX idx_loturi_fefo ON loturi(id_produs, id_farmacie, data_expirare ASC)
  WHERE status='ACTIV' AND cantitate_curenta>0;

-- STOC CURENT
CREATE TABLE stoc_curent (
  id_farmacie INT NOT NULL REFERENCES farmacii(id),
  id_produs INT NOT NULL REFERENCES produse(id),
  cantitate_totala INT NOT NULL DEFAULT 0,
  valoare_totala DECIMAL(12,4) DEFAULT 0,
  data_ultima_miscare TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (id_farmacie, id_produs)
);

-- STOC MINIM
CREATE TABLE stoc_minim_farmacie (
  id_farmacie INT NOT NULL REFERENCES farmacii(id),
  id_produs INT NOT NULL REFERENCES produse(id),
  stoc_minim INT NOT NULL DEFAULT 10,
  stoc_maxim INT DEFAULT 500,
  PRIMARY KEY (id_farmacie, id_produs)
);

-- MISCARI STOC
CREATE TABLE miscari_stoc (
  id SERIAL PRIMARY KEY,
  id_lot INT NOT NULL REFERENCES loturi(id),
  id_farmacie INT NOT NULL REFERENCES farmacii(id),
  tip_miscare tip_miscare NOT NULL,
  cantitate INT NOT NULL,
  pret_unitar DECIMAL(10,4) DEFAULT 0,
  valoare_totala DECIMAL(12,4) DEFAULT 0,
  id_utilizator INT REFERENCES utilizatori(id),
  observatii TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- PACIENTI
CREATE TABLE pacienti (
  id SERIAL PRIMARY KEY,
  cnp_hash VARCHAR(64) NOT NULL UNIQUE,
  nr_card_sanatate VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- PRESCRIPTII
CREATE TABLE prescriptii (
  id SERIAL PRIMARY KEY,
  cod_reteta VARCHAR(50) NOT NULL UNIQUE,
  id_pacient INT REFERENCES pacienti(id),
  cod_medic VARCHAR(20),
  data_prescrierii DATE NOT NULL,
  id_farmacie INT REFERENCES farmacii(id),
  valoare_totala DECIMAL(10,2) DEFAULT 0,
  valoare_compensata DECIMAL(10,2) DEFAULT 0,
  coplata DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'ACTIVA',
  created_at TIMESTAMP DEFAULT NOW()
);

-- TRANZACTII
CREATE TABLE tranzactii (
  id SERIAL PRIMARY KEY,
  numar_bon VARCHAR(40) UNIQUE,
  id_farmacie INT NOT NULL REFERENCES farmacii(id),
  id_utilizator INT REFERENCES utilizatori(id),
  id_prescriptie INT REFERENCES prescriptii(id),
  data_tranzactie TIMESTAMP NOT NULL DEFAULT NOW(),
  valoare_bruta DECIMAL(10,2) NOT NULL DEFAULT 0,
  valoare_tva DECIMAL(10,2) DEFAULT 0,
  valoare_compensata DECIMAL(10,2) DEFAULT 0,
  valoare_incasata DECIMAL(10,2) NOT NULL DEFAULT 0,
  modalitate_plata VARCHAR(20) DEFAULT 'NUMERAR',
  anulata BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tranzactii_farmacie_data ON tranzactii(id_farmacie, data_tranzactie DESC)
  WHERE anulata=FALSE;

-- LINII TRANZACTIE
CREATE TABLE linii_tranzactie (
  id SERIAL PRIMARY KEY,
  id_tranzactie INT NOT NULL REFERENCES tranzactii(id),
  id_produs INT NOT NULL REFERENCES produse(id),
  id_lot INT NOT NULL REFERENCES loturi(id),
  cantitate INT NOT NULL,
  pret_vanzare_unitar DECIMAL(10,4) NOT NULL,
  valoare_linie DECIMAL(10,2) NOT NULL,
  valoare_tva DECIMAL(10,2) DEFAULT 0,
  este_compensat BOOLEAN DEFAULT FALSE,
  valoare_compensata DECIMAL(10,2) DEFAULT 0,
  coplata DECIMAL(10,2) DEFAULT 0
);

-- COMENZI
CREATE TABLE comenzi_aprovizionare (
  id SERIAL PRIMARY KEY,
  numar_comanda VARCHAR(30) UNIQUE,
  id_farmacie INT NOT NULL REFERENCES farmacii(id),
  id_distribuitor INT REFERENCES distribuitori(id),
  id_utilizator INT REFERENCES utilizatori(id),
  data_comanda DATE NOT NULL DEFAULT CURRENT_DATE,
  data_livrare_estimata DATE,
  data_livrare_efectiva DATE,
  valoare_totala DECIMAL(12,2) DEFAULT 0,
  status status_comanda NOT NULL DEFAULT 'DRAFT',
  observatii TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- DOSARE CNAS
CREATE TABLE dosare_cnas (
  id SERIAL PRIMARY KEY,
  id_farmacie INT NOT NULL REFERENCES farmacii(id),
  luna INT NOT NULL,
  an INT NOT NULL,
  nr_retete INT DEFAULT 0,
  valoare_compensata DECIMAL(12,2) DEFAULT 0,
  valoare_coplata DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'GENERAT',
  data_generare TIMESTAMP DEFAULT NOW(),
  UNIQUE(id_farmacie, luna, an)
);

-- ALERTE
CREATE TABLE alerte (
  id SERIAL PRIMARY KEY,
  id_farmacie INT NOT NULL REFERENCES farmacii(id),
  tip VARCHAR(50) NOT NULL,
  severitate VARCHAR(20) DEFAULT 'WARNING',
  mesaj TEXT NOT NULL,
  id_lot INT REFERENCES loturi(id),
  id_produs INT REFERENCES produse(id),
  rezolvata BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- AUDIT LOG
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  id_utilizator INT REFERENCES utilizatori(id),
  actiune VARCHAR(100) NOT NULL,
  entitate VARCHAR(100),
  detalii JSONB,
  ip_client VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW()
);

-- TRIGGER STOC CURENT
CREATE OR REPLACE FUNCTION fn_sync_stoc() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO stoc_curent(id_farmacie, id_produs, cantitate_totala, valoare_totala, data_ultima_miscare)
  SELECT NEW.id_farmacie, NEW.id_produs,
    COALESCE(SUM(cantitate_curenta),0),
    COALESCE(SUM(cantitate_curenta*pret_achizitie),0),
    NOW()
  FROM loturi
  WHERE id_farmacie=NEW.id_farmacie AND id_produs=NEW.id_produs AND status='ACTIV'
  ON CONFLICT(id_farmacie,id_produs) DO UPDATE
    SET cantitate_totala=EXCLUDED.cantitate_totala,
        valoare_totala=EXCLUDED.valoare_totala,
        data_ultima_miscare=NOW();
  RETURN NEW;
END;$$;

CREATE TRIGGER trg_sync_stoc
AFTER INSERT OR UPDATE ON loturi
FOR EACH ROW EXECUTE FUNCTION fn_sync_stoc();

-- ============================================================
-- DATE DEMO
-- ============================================================

INSERT INTO farmacii(cod,denumire,localitate,judet,adresa,telefon,email,target_lunar,nr_angajati,suprafata_mp) VALUES
('PH-001','Farmacia Centrală','București','Ilfov','Str. Victoriei 12','021-111-2222','central@pharmanet.ro',90000,5,120),
('PH-002','Farmacia Nord','Cluj-Napoca','Cluj','Bd. Eroilor 45','0264-333-4444','nord@pharmanet.ro',70000,4,95),
('PH-003','Farmacia Vest','Timișoara','Timiș','Str. Republicii 8','0256-555-6666','vest@pharmanet.ro',65000,3,80),
('PH-004','Farmacia Sud','Craiova','Dolj','Calea București 22','0251-777-8888','sud@pharmanet.ro',55000,4,105),
('PH-005','Farmacia Est','Iași','Iași','Str. Păcurari 15','0232-999-0000','est@pharmanet.ro',60000,3,75),
('PH-006','Farmacia Brașov','Brașov','Brașov','Str. Lungă 33','0268-222-3333','brasov@pharmanet.ro',68000,4,90);

-- Utilizatori (parola: pharma123)
INSERT INTO utilizatori(email,password_hash,nume,rol,id_farmacie) VALUES
('admin@pharmanet.ro','$2a$12$qN2NkPDrcw/rtM8BOrN99OmgPMbiBkyKepug.JhZMcejrfdi.1PNa','Maria Mincu','ADMIN_RETEA',NULL),
('sef@pharmanet.ro','$2a$12$qN2NkPDrcw/rtM8BOrN99OmgPMbiBkyKepug.JhZMcejrfdi.1PNa','Ion Popescu','FARMACIST_SEF',1),
('farmacist@pharmanet.ro','$2a$12$qN2NkPDrcw/rtM8BOrN99OmgPMbiBkyKepug.JhZMcejrfdi.1PNa','Ana Ionescu','FARMACIST',1),
('manager@pharmanet.ro','$2a$12$qN2NkPDrcw/rtM8BOrN99OmgPMbiBkyKepug.JhZMcejrfdi.1PNa','Elena Constantin','MANAGER_JUDET',NULL),
('auditor@pharmanet.ro','$2a$12$qN2NkPDrcw/rtM8BOrN99OmgPMbiBkyKepug.JhZMcejrfdi.1PNa','Mihai Dumitrescu','AUDITOR',NULL);

INSERT INTO distribuitori(denumire,cui,telefon,email) VALUES
('Mediplus Exim','RO14947180','021-200-2200','comenzi@mediplus.ro'),
('Farmexpert','RO14947181','021-300-3300','comenzi@farmexpert.ro'),
('Relad Pharma','RO14947182','021-400-4400','comenzi@relad.ro'),
('Fildas Trading','RO14947183','021-500-5500','comenzi@fildas.ro');

INSERT INTO produse(cod_bare_ean,denumire_comerciala,dci,forma_farmaceutica,cod_atc,regim_eliberare,este_compensat,necesita_reteta,stoc_minim_implicit) VALUES
('5000023047856','Augmentin 875mg','Amoxicillin+Clavulanat','Comprimate filmate','J01CR02','PRF',TRUE,TRUE,50),
('5060190051783','Nurofen Express 200mg','Ibuprofen','Capsule moi','M01AE01','OTC',FALSE,FALSE,100),
('5012267018498','Amoxicilina 500mg','Amoxicillin','Capsule','J01CA04','PRF',TRUE,TRUE,40),
('4056381047806','Metformin 850mg','Metformin','Comprimate','A10BA02','PRF',TRUE,TRUE,60),
('3400938001025','Lisinopril 10mg','Lisinopril','Comprimate','C09AA03','PRF',TRUE,TRUE,35),
('5099627189568','Paracetamol 500mg','Paracetamol','Comprimate','N02BE01','OTC',FALSE,FALSE,150),
('3400937954119','Claritromicina 500mg','Clarithromycin','Comprimate filmate','J01FA09','PRF',TRUE,TRUE,30),
('5099627010423','Omeprazol 20mg','Omeprazole','Capsule gastro.','A02BC01','P6L',TRUE,TRUE,80),
('4056381001488','Alprazolam 0.5mg','Alprazolam','Comprimate','N05BA12','PRF-S',FALSE,TRUE,10),
('5012267052345','Atorvastatina 20mg','Atorvastatin','Comprimate filmate','C10AA05','PRF',TRUE,TRUE,70),
('3400937001259','Amlodipina 5mg','Amlodipine','Comprimate','C08CA01','PRF',TRUE,TRUE,60),
('5099627234001','Vitamina C 1000mg','Acid ascorbic','Comprimate efervescente','A11GA01','OTC',FALSE,FALSE,120),
('5060190099845','Diclofenac 100mg','Diclofenac','Supozitoare','M01AB05','PRF',FALSE,TRUE,40),
('4056381078901','Furosemid 40mg','Furosemide','Comprimate','C03CA01','PRF',TRUE,TRUE,80),
('5099627345678','Xarelto 20mg','Rivaroxaban','Comprimate filmate','B01AF01','PRF',TRUE,TRUE,15);

-- Stoc minim per farmacie
INSERT INTO stoc_minim_farmacie(id_farmacie,id_produs,stoc_minim,stoc_maxim)
SELECT f.id,p.id,p.stoc_minim_implicit,p.stoc_minim_implicit*8 FROM farmacii f CROSS JOIN produse p;

-- Loturi initiale
INSERT INTO loturi(id_produs,id_farmacie,numar_lot,data_fabricatie,data_expirare,cantitate_initiala,cantitate_curenta,pret_achizitie,pret_vanzare,id_distribuitor) VALUES
(1,1,'LOT2024-001A','2024-02-15','2026-08-15',100,85,38.50,52.80,1),
(1,2,'LOT2024-001B','2024-02-15','2025-09-20',80,60,38.50,52.80,1),
(2,1,'LOT2024-003','2024-03-10','2026-11-30',300,200,12.80,18.50,2),
(3,1,'LOT2024-004','2024-01-20','2025-06-10',50,28,16.20,24.30,1),
(5,2,'LOT2024-005','2024-01-10','2025-07-05',30,5,15.40,22.40,2),
(6,1,'LOT2024-006','2024-05-01','2027-03-22',500,320,5.60,8.90,3),
(7,3,'LOT2024-007','2024-03-15','2025-08-10',60,40,26.40,38.20,1),
(9,1,'LOT2024-008','2023-08-01','2024-05-01',20,15,31.20,45.60,2),
(10,4,'LOT2024-009','2024-04-10','2026-06-18',200,150,22.10,31.80,3),
(4,5,'LOT2024-010','2024-04-20','2026-09-25',120,89,10.80,15.60,1),
(15,1,'LOT2024-011','2024-06-01','2027-01-12',50,32,142.00,198.50,4),
(8,1,'LOT2024-012','2024-03-01','2027-02-28',200,120,19.80,28.70,2),
(11,2,'LOT2024-013','2024-05-10','2026-10-15',150,98,13.40,19.40,1),
(14,4,'LOT2024-014','2024-04-05','2026-04-30',200,140,8.40,12.50,3),
(6,3,'LOT2024-015','2024-04-01','2026-08-20',200,130,5.60,8.90,2),
(2,3,'LOT2024-016','2024-03-20','2026-12-10',150,112,12.80,18.50,2),
(4,2,'LOT2024-017','2024-05-01','2026-11-15',100,75,10.80,15.60,1),
(10,1,'LOT2024-018','2024-04-15','2026-05-20',100,72,22.10,31.80,3),
(12,1,'LOT2024-019','2024-06-01','2027-06-01',300,220,9.10,14.20,2),
(13,2,'LOT2024-020','2024-03-10','2026-09-10',80,55,11.60,17.30,1);

-- Tranzactii demo (30 zile)
DO $$
DECLARE
  v_data DATE; v_fId INT; v_pId INT; v_lot INT; v_qty INT;
  v_pret DECIMAL; v_bon VARCHAR; v_tId INT;
  v_comp BOOLEAN; v_val DECIMAL; v_cv DECIMAL; v_plata VARCHAR;
BEGIN
  FOR zi IN 0..29 LOOP
    v_data := CURRENT_DATE - zi;
    FOR v IN 1..FLOOR(RANDOM()*8+4)::INT LOOP
      v_fId := FLOOR(RANDOM()*6+1)::INT;
      v_pId := FLOOR(RANDOM()*15+1)::INT;
      v_qty := FLOOR(RANDOM()*3+1)::INT;
      SELECT l.id, l.pret_vanzare INTO v_lot, v_pret FROM loturi l
      WHERE l.id_produs=v_pId AND l.id_farmacie=v_fId AND l.status='ACTIV' AND l.cantitate_curenta>=v_qty
      ORDER BY l.data_expirare ASC LIMIT 1;
      IF v_lot IS NOT NULL THEN
        v_val := ROUND((v_pret*v_qty)::NUMERIC,2);
        v_comp := (RANDOM()>0.45 AND EXISTS(SELECT 1 FROM produse WHERE id=v_pId AND este_compensat=TRUE));
        v_cv := CASE WHEN v_comp THEN ROUND((v_val*0.7)::NUMERIC,2) ELSE 0 END;
        v_plata := CASE WHEN RANDOM()>0.35 THEN 'CARD' ELSE 'NUMERAR' END;
        v_bon := 'BON-'||TO_CHAR(v_data,'YYYYMMDD')||'-'||LPAD(v::TEXT,4,'0')||'-'||v_fId;
        INSERT INTO tranzactii(numar_bon,id_farmacie,id_utilizator,data_tranzactie,valoare_bruta,valoare_tva,valoare_compensata,valoare_incasata,modalitate_plata)
        VALUES(v_bon,v_fId,2,v_data+(RANDOM()*8+8||' hours')::INTERVAL,v_val,ROUND((v_val*0.09)::NUMERIC,2),v_cv,ROUND((v_val-v_cv)::NUMERIC,2),v_plata)
        RETURNING id INTO v_tId;
        INSERT INTO linii_tranzactie(id_tranzactie,id_produs,id_lot,cantitate,pret_vanzare_unitar,valoare_linie,valoare_tva,este_compensat,valoare_compensata,coplata)
        VALUES(v_tId,v_pId,v_lot,v_qty,v_pret,v_val,ROUND((v_val*0.09)::NUMERIC,2),v_comp,v_cv,ROUND((v_val-v_cv)::NUMERIC,2));
        UPDATE loturi SET cantitate_curenta=cantitate_curenta-v_qty WHERE id=v_lot AND cantitate_curenta>=v_qty;
      END IF;
    END LOOP;
  END LOOP;
END;$$;

-- Alerte FEFO
INSERT INTO alerte(id_farmacie,tip,severitate,mesaj,id_lot,id_produs)
SELECT l.id_farmacie,'FEFO_EXPIRARE',
  CASE WHEN (l.data_expirare-CURRENT_DATE)<30 THEN 'CRITICAL' ELSE 'WARNING' END,
  'Lot '||l.numar_lot||' pentru '||p.denumire_comerciala||' expira in '||(l.data_expirare-CURRENT_DATE)||' zile',
  l.id, l.id_produs
FROM loturi l JOIN produse p ON p.id=l.id_produs
WHERE l.status='ACTIV' AND l.cantitate_curenta>0 AND l.data_expirare<=CURRENT_DATE+INTERVAL '90 days';

-- Comenzi demo
INSERT INTO comenzi_aprovizionare(numar_comanda,id_farmacie,id_distribuitor,id_utilizator,data_comanda,data_livrare_estimata,valoare_totala,status) VALUES
('CMD-2025-001',1,1,2,'2025-05-08','2025-05-15',4520.50,'TRIMISA'),
('CMD-2025-002',2,2,2,'2025-05-09','2025-05-18',3280.00,'CONFIRMATA'),
('CMD-2025-003',3,3,2,'2025-05-10','2025-05-14',2807.50,'LIVRATA'),
('CMD-2025-004',4,1,2,'2025-05-11','2025-05-20',1842.00,'DRAFT');

-- Dosare CNAS demo
INSERT INTO dosare_cnas(id_farmacie,luna,an,nr_retete,valoare_compensata,valoare_coplata,status) VALUES
(1,4,2025,52,14210.50,6089.50,'ACCEPTAT'),
(1,3,2025,48,13420.00,5751.43,'ACCEPTAT'),
(2,4,2025,38,9870.20,4230.09,'TRIMIS');

-- Audit initial
INSERT INTO audit_log(id_utilizator,actiune,entitate,detalii,ip_client) VALUES
(1,'SETUP_COMPLET','sistem','{"versiune":"2.0","data":"2025"}','127.0.0.1');

\echo ''
\echo '✅ PharmaNET baza de date creata cu succes!'
\echo '   Conturi: admin@pharmanet.ro / pharma123'
\echo ''
