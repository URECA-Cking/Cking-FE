// Lightweight placeholder-image helpers.
// The original Stitch mockups reference temporary Google-hosted preview
// images, so we swap them for deterministic https://picsum.photos seeds
// (same seed -> same image) to keep the look-and-feel without relying on
// URLs that were never meant to be permanent.

export function avatarImage(seed, size = 200) {
  return `https://picsum.photos/seed/${seed}/${size}/${size}`
}

export function bannerImage(seed, width = 640, height = 360) {
  return `https://picsum.photos/seed/${seed}/${width}/${height}`
}
