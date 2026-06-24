// Tijdelijke, apparaat-lokale verzameling item-id's om outfits van te bouwen.
// Bewaart enkel id's (items worden her-getagd; id's zijn stabiel) in localStorage.
const KEY = 'bci.stack';

function read(): number[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((n) => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

let ids = $state<number[]>(read());

function save() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* private mode / quota → in-memory blijft werken */
  }
}

export const stack = {
  get ids() {
    return ids;
  },
  get count() {
    return ids.length;
  },
  has(id: number) {
    return ids.includes(id);
  },
  add(id: number) {
    if (!ids.includes(id)) {
      ids = [...ids, id];
      save();
    }
  },
  remove(id: number) {
    if (ids.includes(id)) {
      ids = ids.filter((x) => x !== id);
      save();
    }
  },
  toggle(id: number) {
    ids.includes(id) ? this.remove(id) : this.add(id);
  },
  addMany(many: number[]) {
    const next = [...ids];
    for (const id of many) if (!next.includes(id)) next.push(id);
    if (next.length !== ids.length) {
      ids = next;
      save();
    }
  },
  clear() {
    if (ids.length) {
      ids = [];
      save();
    }
  },
  // verwijder id's die niet meer bestaan (bv. verwijderde items)
  prune(validIds: number[]) {
    const valid = new Set(validIds);
    const next = ids.filter((id) => valid.has(id));
    if (next.length !== ids.length) {
      ids = next;
      save();
    }
  }
};
