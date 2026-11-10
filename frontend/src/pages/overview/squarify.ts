// Personal fork: squarified treemap layout (Bruls, Huizing & van Wijk), for the overview's pack value map. Lays values
// out in rows along the rect's shorter side, adding to a row while that keeps its tiles closer to square.

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

// The most stretched tile's aspect ratio if `row` (areas) fills a strip along a side of length `side`
function worst(row: number[], side: number) {
  const sum = row.reduce((a, b) => a + b, 0)
  const max = Math.max(...row)
  const min = Math.min(...row)
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min))
}

/** One rect per value, in input order; zero values get an empty rect. Sorting values descending gives the squarest tiles. */
export function squarify(values: number[], rect: Rect): Rect[] {
  const total = values.reduce((a, b) => a + b, 0)
  const out: Rect[] = values.map(() => ({ x: rect.x, y: rect.y, w: 0, h: 0 }))
  if (total <= 0 || rect.w <= 0 || rect.h <= 0) {
    return out
  }
  const scale = (rect.w * rect.h) / total
  const items = values.map((v, i) => ({ i, area: v * scale })).filter((it) => it.area > 0)

  let { x, y, w, h } = rect
  let row: typeof items = []
  const flush = () => {
    const sum = row.reduce((a, it) => a + it.area, 0)
    if (w >= h) {
      // a column on the left
      const colW = sum / h
      let cy = y
      for (const it of row) {
        out[it.i] = { x, y: cy, w: colW, h: it.area / colW }
        cy += it.area / colW
      }
      x += colW
      w -= colW
    } else {
      // a row along the top
      const rowH = sum / w
      let cx = x
      for (const it of row) {
        out[it.i] = { x: cx, y, w: it.area / rowH, h: rowH }
        cx += it.area / rowH
      }
      y += rowH
      h -= rowH
    }
    row = []
  }

  for (const it of items) {
    const side = Math.min(w, h)
    const areas = row.map((r) => r.area)
    if (row.length > 0 && worst([...areas, it.area], side) > worst(areas, side)) {
      flush()
    }
    row.push(it)
  }
  if (row.length > 0) {
    flush()
  }
  return out
}
