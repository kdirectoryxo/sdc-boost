/** 6-char interests string for speeddating signup (aligned with `summary_int` couple / SF / SM / trans positions). */

export function buildSpeedDateInterests(o: {
  couple: boolean;
  woman: boolean;
  man: boolean;
  trans: boolean;
}): string {
  const c = ['0', '0', '0', '0', '0', '0'];
  if (o.couple) c[0] = '1';
  if (o.woman) c[3] = '1';
  if (o.man) c[4] = '1';
  if (o.trans) c[5] = '1';
  return c.join('');
}

export function parseSpeedDateInterests(s: string | undefined): {
  couple: boolean;
  woman: boolean;
  man: boolean;
  trans: boolean;
} {
  const pad = (s ?? '000000').padEnd(6, '0').slice(0, 6);
  return {
    couple: pad[0] === '1',
    woman: pad[3] === '1',
    man: pad[4] === '1',
    trans: pad[5] === '1',
  };
}

export function formatDaysForApi(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

export function parseLocationParts(raw: string): { country: string; state: string; city: string } {
  const t = raw.trim();
  if (!t) return { country: 'NL', state: '', city: '' };
  const parts = t.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return {
      city: parts[0] ?? '',
      state: parts[1] ?? '',
      country: parts[2] ?? 'NL',
    };
  }
  if (parts.length === 2) {
    return { city: parts[0] ?? '', state: '', country: parts[1] ?? 'NL' };
  }
  return { city: parts[0] ?? '', state: '', country: 'NL' };
}
