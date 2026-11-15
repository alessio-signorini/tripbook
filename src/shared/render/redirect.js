import { escapeHtml as esc } from '../format.js';

export function renderRedirect(toUrl) {
  const u = esc(toUrl);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Redirecting…</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${u}">
<meta http-equiv="refresh" content="0; url=${u}">
</head>
<body>
<p>This page has moved to <a href="${u}">${u}</a>.</p>
</body>
</html>
`;
}
