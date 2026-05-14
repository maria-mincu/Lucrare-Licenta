export const fmt = (n, d = 2) =>
  Number(n || 0).toLocaleString('ro-RO', { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtRON = n => `${fmt(n)} RON`;

export const daysTo = s =>
  Math.ceil((new Date(s) - new Date()) / 86400000);

export const fefoStatus = lot => {
  const z = daysTo(lot.data_expirare || lot.exp);
  if (lot.status === 'EXPIRAT' || z < 0) return 'EXPIRAT';
  if (z < 30) return 'CRITIC';
  if (z < 90) return 'ATENTIE';
  return 'OK';
};

export const fefoClass = s =>
  ({ OK: 'fefo-ok', ATENTIE: 'fefo-warn', CRITIC: 'fefo-crit', EXPIRAT: 'fefo-exp' }[s] || '');

export const fefoLabel = s =>
  ({ OK: '✓ OK', ATENTIE: '⚡ Atenție', CRITIC: '🔴 Critic', EXPIRAT: '💀 Expirat' }[s] || s);

export const regimColor = r =>
  ({ OTC: 'b-green', PRF: 'b-red', 'PRF-S': 'b-dark', P6L: 'b-amber' }[r] || 'b-gray');

export const statusColor = s =>
  ({
    VERDE: 'b-green', GALBEN: 'b-amber', ROSU: 'b-red',
    FINALIZATA: 'b-green', ANULATA: 'b-red',
    TRIMISA: 'b-amber', CONFIRMATA: 'b-blue', LIVRATA: 'b-green', DRAFT: 'b-gray',
    ACTIV: 'b-blue', EXPIRAT: 'b-gray', ACCEPTAT: 'b-green', GENERAT: 'b-amber', TRIMIS: 'b-blue',
    ACTIVA: 'b-blue', UTILIZATA: 'b-green'
  }[s] || 'b-gray');

export const rolColor = r =>
  ({
    ADMIN_RETEA: 'b-red', MANAGER_JUDET: 'b-purple',
    FARMACIST_SEF: 'b-blue', FARMACIST: 'b-green',
    OPERATOR_STOC: 'b-amber', AUDITOR: 'b-gray'
  }[r] || 'b-gray');

export const downloadCsv = (filename, rows) => {
  if (!rows || !rows.length) return;
  const header = Object.keys(rows[0]).join(',');
  const csv = [header, ...rows.map(r => Object.values(r).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
