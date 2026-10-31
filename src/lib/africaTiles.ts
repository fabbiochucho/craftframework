// A tile map of Africa: every country as one square, placed roughly where it sits on the continent (column, row).
// Needs no boundary data, reads at phone width, and gives small countries the same weight as large ones.
// Self-check: `node src/lib/africaTiles.test.ts`.
export const AFRICA_TILES: Record<string, [number, number]> = {
  MA: [2, 0], DZ: [3, 0], TN: [4, 0], LY: [5, 0], EG: [6, 0],
  CV: [0, 1], MR: [1, 1], ML: [2, 1], NE: [3, 1], TD: [4, 1], SD: [5, 1], ER: [6, 1],
  SN: [0, 2], GM: [1, 2], BF: [2, 2], NG: [3, 2], CF: [4, 2], SS: [5, 2], ET: [6, 2], DJ: [7, 2],
  GW: [0, 3], GN: [1, 3], CI: [2, 3], BJ: [3, 3], CM: [4, 3], UG: [5, 3], KE: [6, 3], SO: [7, 3],
  SL: [0, 4], LR: [1, 4], GH: [2, 4], TG: [3, 4], GA: [4, 4], CD: [5, 4], RW: [6, 4],
  ST: [2, 5], GQ: [3, 5], CG: [4, 5], BI: [5, 5], TZ: [6, 5], KM: [7, 5], SC: [8, 5],
  AO: [4, 6], ZM: [5, 6], MW: [6, 6], MZ: [7, 6], MG: [8, 6],
  NA: [4, 7], BW: [5, 7], ZW: [6, 7], MU: [8, 7],
  ZA: [5, 8], SZ: [6, 8],
  LS: [5, 9],
}
export const TILE_COLS = 9
export const TILE_ROWS = 10
