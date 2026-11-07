/** Display form of a saved API key: bullets plus the last 4 characters, or the full key when `reveal` is set. */
export function maskKey(key: string, reveal = false): string {
  const k = key.trim();
  if (!k) return '';
  if (reveal) return k;
  return k.length <= 8 ? '••••••••' : `••••••••${k.slice(-4)}`;
}
