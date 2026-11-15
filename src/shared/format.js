export function formatMinutes(n) {
  if (!n || n <= 0) return '';
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export function sectionLetter(i) {
  let n = i;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export function totalMinutes(stops) {
  return stops.reduce((sum, s) => sum + (s.minutes || 0), 0);
}
