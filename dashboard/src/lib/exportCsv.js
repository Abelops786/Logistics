export function exportCSV(rows, filename) {
  if (!rows || rows.length === 0) return;

  const escape = (v) => {
    if (v == null) return '';
    const str = String(v).replace(/"/g, '""');
    return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
  };

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
