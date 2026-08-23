// Spiegelt de servergrens: boven BODY_SIZE_LIMIT kapt de adapter de request af, en dan
// krijgt de gebruiker een kale 413 in plaats van een leesbare melding.
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

// Uploadt één printscreen ongewijzigd (geen client-normalisatie).
export async function uploadInspiration(file: File): Promise<number> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Afbeelding groter dan 20 MB');
  const fd = new FormData();
  fd.append('kind', 'inspiration');
  fd.append('photo', file, file.name);
  const res = await fetch('/api/outfits', { method: 'POST', body: fd });
  if (!res.ok) throw new Error(await errorMessage(res));
  return ((await res.json()) as { id: number }).id;
}

// SvelteKit's error() levert {message}; val terug op de status.
async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: unknown };
    if (typeof body?.message === 'string' && body.message) return body.message;
  } catch {
    /* geen JSON-body */
  }
  return `upload mislukt (${res.status})`;
}

// Zet notitie of favoriet-markering. Gooit met de servermelding bij een fout.
export async function patchInspiration(
  id: number,
  patch: { note?: string | null; favorite?: boolean }
): Promise<void> {
  const res = await fetch(`/api/outfits/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch)
  });
  if (!res.ok) throw new Error(await errorMessage(res));
}
