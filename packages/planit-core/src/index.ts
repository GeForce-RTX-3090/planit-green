// ---------- Types ----------
export type ProductBasics = {
  product_id: string
  retailer: string
  brand: string
  product_name: string
  size_ml: number
  unit_price_gbp_per_litre: number
}

export type ProductAttrs = {
  sugar_g_per_100ml: number | null
  sat_fat_g_per_100ml: number | null
  additives_count: number | null
  packaging_materials: string            // e.g., "tetra-pack,plastic-cap"
  recyclability: "widely_recycled" | "check_local" | "not_recycled"
  certifications: string                 // semicolon list e.g., "organic;soil-association"
  country_of_origin: string              // "UK","SE",...
}

export type Scores = {
  health_score: number
  sustainability_score: number
  price_score: number
  planit_score: number
  breakdown: Record<string, number>
  quality_flag: "ok" | "imputed" | "partial"
}

export type Config = {
  version?: string
  weights: {
    overall: { sustainability: number; health: number; price: number }
    health: { sugar: number; sat_fat: number; additives: number }
    sustainability: { packaging: number; origin: number; certs: number }
  }
  packaging_base: Record<string, number>
  recyclability_bonus: Record<"widely_recycled" | "check_local" | "not_recycled", number>
  origin_scale: {
    same_country: number
    neighboring_country: number
    intra_europe: number
    intercontinental: number
  }
}

// Bounds used for normalization
export type Bounds = {
  sugar: { min: number; max: number }
  satfat: { min: number; max: number }
  additives: { min: number; max: number }
  price: { min: number; max: number }
}

export type Stats = { bounds: Bounds }

// ---------- Utils ----------
const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x))

function normalizeLowerBetter(x: number, min: number, max: number) {
  if (max <= min) return 50
  const nx = clamp(x, min, max)
  return ((max - nx) / (max - min)) * 100
}

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return NaN
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx), hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  const w = idx - lo
  return sorted[lo] * (1 - w) + sorted[hi] * w
}

function toNums(xs: Array<number | null | undefined>): number[] {
  return xs.filter((v): v is number => typeof v === "number" && !Number.isNaN(v)).slice().sort((a, b) => a - b)
}

function primaryMaterial(s: string) {
  const first = (s || "").split(",")[0]?.trim().toLowerCase()
  if (!first) return "other"
  // normalize some common spellings
  if (first.includes("tetra")) return "tetra-pack"
  if (first.includes("hdpe")) return "hdpe"
  if (first.includes("glass")) return "glass"
  if (first.includes("pet")) return "pet"
  return first
}

function euLike(code: string) {
  const c = (code || "").toUpperCase()
  const eu = new Set([
    "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"
  ])
  return eu.has(c)
}

// ---------- Dataset-aware stats (optional) ----------
/**
 * Compute bounds (P5..P95) from the dataset. If there isn't enough data,
 * sensible defaults are returned.
 */
export function computeDatasetStats(attrs: ProductAttrs[], basics: ProductBasics[]): Stats {
  const sugars = toNums(attrs.map(a => a.sugar_g_per_100ml))
  const satfats = toNums(attrs.map(a => a.sat_fat_g_per_100ml))
  const adds = toNums(attrs.map(a => a.additives_count))
  const prices = toNums(basics.map(b => b.unit_price_gbp_per_litre))

  const b: Bounds = {
    sugar:   sugars.length  ? { min: percentile(sugars, 5),  max: percentile(sugars, 95) }   : { min: 0,   max: 10 },
    satfat:  satfats.length ? { min: percentile(satfats, 5), max: percentile(satfats, 95) }  : { min: 0,   max: 5  },
    additives: adds.length  ? { min: percentile(adds, 5),    max: percentile(adds, 95) }     : { min: 0,   max: 5  },
    price:   prices.length  ? { min: percentile(prices, 5),  max: percentile(prices, 95) }   : { min: 1,   max: 3  },
  }

  // avoid zero-width ranges
  for (const k of ["sugar","satfat","additives","price"] as const) {
    if (b[k].max <= b[k].min) b[k].max = b[k].min + 1
  }
  return { bounds: b }
}

// ---------- Scoring ----------
const DEFAULT_STATS: Stats = {
  bounds: {
    sugar: { min: 0, max: 10 },
    satfat: { min: 0, max: 5 },
    additives: { min: 0, max: 5 },
    price: { min: 1, max: 3 }
  }
}

/**
 * Score a single product. If you pass `stats`, dataset-aware bounds are used.
 * Otherwise defaults are applied.
 */
export function scoreProduct(
  basics: ProductBasics,
  attrs: ProductAttrs,
  cfg: Config,
  stats?: Stats
): Scores {
  const b = (stats ?? DEFAULT_STATS).bounds

  // handle missing nutrition with midpoint imputation
  let flag: Scores["quality_flag"] = "ok"
  const sugar   = attrs.sugar_g_per_100ml ?? (b.sugar.min + b.sugar.max) / 2
  const satfat  = attrs.sat_fat_g_per_100ml ?? (b.satfat.min + b.satfat.max) / 2
  const add     = attrs.additives_count ?? (b.additives.min + b.additives.max) / 2
  if (attrs.sugar_g_per_100ml == null || attrs.sat_fat_g_per_100ml == null || attrs.additives_count == null) {
    flag = "imputed"
  }

  const health_sugar = normalizeLowerBetter(sugar,  b.sugar.min,  b.sugar.max)
  const health_sat   = normalizeLowerBetter(satfat, b.satfat.min, b.satfat.max)
  const health_add   = normalizeLowerBetter(add,    b.additives.min, b.additives.max)
  const health_score =
    cfg.weights.health.sugar    * health_sugar +
    cfg.weights.health.sat_fat  * health_sat   +
    cfg.weights.health.additives* health_add

  const base = cfg.packaging_base[primaryMaterial(attrs.packaging_materials)] ?? cfg.packaging_base["other"]
  const bonus = cfg.recyclability_bonus[attrs.recyclability] ?? 0
  const packaging = clamp(base + bonus, 0, 100)

  // origin heuristic
  let origin = cfg.origin_scale.intra_europe
  const c = (attrs.country_of_origin || "").toUpperCase()
  if (c === "UK") origin = cfg.origin_scale.same_country
  else if (c === "IE" || c === "GB-IE" /* weird tags */) origin = cfg.origin_scale.neighboring_country
  else if (euLike(c)) origin = cfg.origin_scale.intra_europe
  else origin = cfg.origin_scale.intercontinental

  // simple certification points
  const certsSet = new Set((attrs.certifications || "").split(";").map(s => s.trim().toLowerCase()).filter(Boolean))
  let certs = 0
  if (certsSet.has("organic")) certs += 10
  if (certsSet.has("soil-association")) certs += 10
  if (certsSet.has("bcorp")) certs += 5
  if (certsSet.has("carbon-neutral")) certs += 5
  certs = clamp(certs, 0, 20)

  const sustainability_score =
    cfg.weights.sustainability.packaging * packaging +
    cfg.weights.sustainability.origin * origin +
    cfg.weights.sustainability.certs * certs

  // price (lower is better)
  const price_score = normalizeLowerBetter(basics.unit_price_gbp_per_litre, b.price.min, b.price.max)

  const planit_score =
    cfg.weights.overall.sustainability * sustainability_score +
    cfg.weights.overall.health * health_score +
    cfg.weights.overall.price * price_score

  return {
    health_score: Math.round(health_score),
    sustainability_score: Math.round(sustainability_score),
    price_score: Math.round(price_score),
    planit_score: Math.round(planit_score),
    breakdown: {
      sugar: Math.round(health_sugar),
      sat_fat: Math.round(health_sat),
      additives: Math.round(health_add),
      packaging, origin, certs,
      price_norm: Math.round(price_score)
    },
    quality_flag: flag
  }
}

/**
 * Convenience: score with dataset-aware stats computed on the fly.
 */
export function scoreProductWithStats(
  basics: ProductBasics,
  attrs: ProductAttrs,
  cfg: Config,
  allBasics: ProductBasics[],
  allAttrs: ProductAttrs[]
) {
  const stats = computeDatasetStats(allAttrs, allBasics)
  return scoreProduct(basics, attrs, cfg, stats)
}
