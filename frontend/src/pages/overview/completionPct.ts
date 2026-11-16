// Personal fork: the overview's completion percentage, shared by the heatmap, the collection ring and the tier tile.
// Never rounds a gap up to 100% or a single card down to 0%.
export const completionPct = (have: number, total: number) =>
  have === total ? 100 : have > 0 ? Math.max(1, Math.min(99, Math.floor((100 * have) / total))) : 0
