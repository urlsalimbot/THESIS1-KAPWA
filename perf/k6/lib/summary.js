function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function metricRow(name, metric) {
  const values = metric.values || {};
  let value = '';
  if (metric.type === 'rate') value = `${((values.rate ?? 0) * 100).toFixed(2)}%`;
  else if (metric.type === 'trend') value = values['p(95)'] !== undefined ? `${Number(values['p(95)']).toFixed(1)} ms` : '';
  else if (metric.type === 'gauge') value = `${values.value ?? ''}`;
  else value = `${values.count ?? ''}${values.rate !== undefined ? ` (${Number(values.rate).toFixed(1)}/s)` : ''}`;
  return `<tr><td>${esc(name)}</td><td>${esc(metric.type)}</td><td>${esc(value)}</td><td>${esc(values.avg !== undefined ? Number(values.avg).toFixed(1) : '')}</td></tr>`;
}

export function renderHtml(data) {
  const metrics = data.metrics || {};
  const thresholdRows = Object.entries(metrics).flatMap(([name, metric]) =>
    Object.entries(metric.thresholds || {}).map(([expr, t]) => ({ name, expr, ok: t.ok !== undefined ? t.ok : !t.fails })),
  );
  const keyMetrics = ['http_reqs', 'http_req_failed', 'http_req_duration', 'checks', 'iterations', 'vus_max']
    .filter(name => metrics[name]);

  const thresholdTable = thresholdRows.length
    ? thresholdRows.map(t => `<tr class="${t.ok ? 'ok' : 'fail'}"><td>${esc(t.name)}</td><td>${esc(t.expr)}</td><td>${t.ok ? 'PASS' : 'FAIL'}</td></tr>`).join('')
    : '<tr><td colspan="3">no thresholds</td></tr>';

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>KAPWA k6 run</title>
<style>
body{font-family:system-ui,sans-serif;margin:2rem;color:#111}
table{border-collapse:collapse;margin:1rem 0;width:100%;max-width:900px}
th,td{border:1px solid #ddd;padding:6px 10px;text-align:left;font-size:14px}
th{background:#f5f5f5}
tr.ok td:last-child{color:#0a7d32;font-weight:600}
tr.fail td:last-child{color:#b42318;font-weight:600}
h2{margin-top:2rem}
</style></head>
<body>
<h1>KAPWA performance run</h1>
<p>Generated ${esc(new Date().toISOString())} by k6.</p>
<h2>Thresholds</h2>
<table><thead><tr><th>Metric</th><th>Threshold</th><th>Result</th></tr></thead><tbody>${thresholdTable}</tbody></table>
<h2>Key metrics</h2>
<table><thead><tr><th>Metric</th><th>Type</th><th>Value</th><th>Avg</th></tr></thead><tbody>${keyMetrics.map(name => metricRow(name, metrics[name])).join('')}</tbody></table>
</body></html>`;
}
