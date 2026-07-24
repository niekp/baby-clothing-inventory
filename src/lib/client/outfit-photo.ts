import { fileToNormalizedJpeg } from './capture';

// Maakt een foto-outfit: normaliseer de foto → multipart POST. Geeft het id terug; gooit bij fout.
export async function createPhotoOutfit(name: string, size: string, file: File): Promise<number> {
  const blob = await fileToNormalizedJpeg(file);
  const fd = new FormData();
  fd.append('name', name);
  if (size) fd.append('size', size);
  fd.append('photo', blob, 'outfit.jpg');
  const res = await fetch('/api/outfits', { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`aanmaken mislukt (${res.status})`);
  return ((await res.json()) as { id: number }).id;
}
