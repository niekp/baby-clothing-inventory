import { describe, expect, it } from 'vitest';
import { cutoutState, photoCardSources } from './images';
import type { OutfitDTO } from '$lib/server/serialize';

function dto(over: Partial<OutfitDTO> = {}): OutfitDTO {
  return {
    id: 1,
    kind: 'own',
    name: 'Look',
    note: null,
    favorite: 0,
    size: null,
    thumb_path: null,
    created_at: '2026-08-22T00:00:00.000Z',
    cutout_status: 'none',
    is_photo: false,
    is_sharp: false,
    cutout_busy: false,
    thumb_url: null,
    thumb_small_url: null,
    orig_download_url: null,
    ...over
  };
}

describe('cutoutState', () => {
  it('een canvas-outfit heeft geen cutout-toestand', () => {
    expect(cutoutState(dto({ is_photo: false, cutout_status: 'failed' }))).toBe('ready');
  });

  it('geslaagde cutout is ready', () => {
    expect(cutoutState(dto({ is_photo: true, cutout_status: 'done' }))).toBe('ready');
  });

  it('mislukte cutout is failed', () => {
    expect(cutoutState(dto({ is_photo: true, cutout_status: 'failed' }))).toBe('failed');
  });

  it('nog geen cutout is busy', () => {
    expect(cutoutState(dto({ is_photo: true, cutout_status: 'none' }))).toBe('busy');
  });
});

describe('photoCardSources', () => {
  it('canvas-outfit: alleen de canvas-thumb', () => {
    expect(photoCardSources(dto({ thumb_url: '/t.png' }))).toEqual(['/t.png']);
  });

  it('canvas-outfit zonder thumb: leeg', () => {
    expect(photoCardSources(dto())).toEqual([]);
  });

  it('geslaagde cutout: webp → png → origineel', () => {
    const sources = photoCardSources(
      dto({
        is_photo: true,
        cutout_status: 'done',
        thumb_small_url: '/s.webp',
        thumb_url: '/c.png',
        orig_download_url: '/o.jpg'
      })
    );
    expect(sources).toEqual(['/s.webp', '/c.png', '/o.jpg']);
  });

  it('geslaagde cutout zonder webp-thumb: png → origineel', () => {
    const sources = photoCardSources(
      dto({
        is_photo: true,
        cutout_status: 'done',
        thumb_small_url: null,
        thumb_url: '/c.png',
        orig_download_url: '/o.jpg'
      })
    );
    expect(sources).toEqual(['/c.png', '/o.jpg']);
  });

  // de cutout-URL's bestaan dan nog niet op schijf; een onerror-terugval komt bij het
  // SSR-laden te laat, dus de eerste bron moet meteen goed zijn
  for (const status of ['none', 'failed'] as const) {
    it(`cutout ${status}: meteen het origineel, geen cutout-URL's`, () => {
      const sources = photoCardSources(
        dto({
          is_photo: true,
          cutout_status: status,
          thumb_small_url: '/s.webp',
          thumb_url: '/c.png',
          orig_download_url: '/o.jpg'
        })
      );
      expect(sources).toEqual(['/o.jpg']);
    });
  }
});
