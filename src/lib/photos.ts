// Teammate photos are stored as small JPEG data URLs and served from /team-photo/[id], so lists
// don't repeat the image in every row. photoAt changes on each upload, which busts the cache.

export const MAX_PHOTO_CHARS = 200_000; // a 256px JPEG is usually 15 to 40 KB

export function photoUrl(u: { id: string; photoAt: Date | null }) {
  return u.photoAt ? `/team-photo/${u.id}?v=${u.photoAt.getTime()}` : null;
}

export function decodePhoto(dataUrl: string) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  return m ? { type: m[1]!, bytes: Buffer.from(m[2]!, "base64") } : null;
}
