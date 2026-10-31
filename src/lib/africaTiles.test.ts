import assert from 'node:assert/strict'
import { AFRICA_TILES, TILE_COLS, TILE_ROWS } from './africaTiles.ts'
import { AFRICA_COUNTRIES } from './africa-countries.ts'

// Every one of the 54 countries has exactly one tile, inside the grid, and no two share a square
assert.deepEqual(Object.keys(AFRICA_TILES).sort(), AFRICA_COUNTRIES.map((c) => c.iso2).sort())
const seen = new Set<string>()
for (const [iso, [c, r]] of Object.entries(AFRICA_TILES)) {
  assert.ok(c >= 0 && c < TILE_COLS && r >= 0 && r < TILE_ROWS, `${iso}: inside the grid`)
  assert.ok(!seen.has(`${c},${r}`), `${iso}: square not shared`)
  seen.add(`${c},${r}`)
}
// Rough geography: north above south, west left of east
const [, maRow] = AFRICA_TILES.MA, [, zaRow] = AFRICA_TILES.ZA, [snCol] = AFRICA_TILES.SN, [soCol] = AFRICA_TILES.SO
assert.ok(maRow < zaRow && snCol < soCol)
console.log('africaTiles.test.ts ok')
