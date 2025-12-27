export type ProductBasics = {
  product_id: string;
  retailer: string;
  brand: string;
  product_name: string;
  size_ml: number;
  unit_price_gbp_per_litre: number;
};

export type ProductAttrs = {
  sugar_g_per_100ml: number | null;
  sat_fat_g_per_100ml: number | null;
  additives_count: number | null;
  packaging_materials: string; // e.g., "tetra-pack,plastic-cap"
  recyclability: "widely_recycled" | "check_local" | "not_recycled";
  certifications: string; // semicolon list e.g., "organic;soil-association"
  country_of_origin: string; // e.g., "UK", "SE"
};

export type Scores = {
  health_score: number;
  sustainability_score: number;
  price_score: number;
  planit_score: number;
  breakdown: Record<string, number>;
  quality_flag: "ok" | "imputed" | "partial";
};

// Keep Config local to avoid cross-package type import issues for tsup
export type Config = {
  weights: {
    overall: { sustainability: number; health: number; price: number };
    health: { sugar: number; sat_fat: number; additives: number };
    sustainability: { packaging: number; origin: number; certs: number };
  };
  packaging_base: Record<string, number>;
  recyclability_bonus: Record<"widely_recycled" | "check_local" | "not_recycled", number>;
  origin_scale: {
    same_country: number;
    neighboring_country: number;
    intra_europe: number;
    intercontinental: number;
  };
};

const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

function normalizeLowerBetter(x: number, min: number, max: number) {
  const nx = clamp(x, min, max);
  return ((max - nx) / (max - min)) * 100;
}

function normalizeHigherBetter(x: number, min: number, max: number) {
  const nx = clamp(x, min, max);
  return ((nx - min) / (max - min)) * 100;
}

export function scoreProduct(
  basics: ProductBasics,
  attrs: ProductAttrs,
  cfg: Config
): Scores {
  // Bounds for MVP; you can tune later or compute from dataset
  const bounds = {
    sugar: { min: 0, max: 10 },    // g/100ml
    satfat: { min: 0, max: 5 },    // g/100ml
    additives: { min: 0, max: 5 },
    price: { min: 1, max: 3 }      // GBP per litre
  };

  // Handle missing values (impute to midpoint and mark flag)
  let flag: Scores["quality_flag"] = "ok";
  const sugar = attrs.sugar_g_per_100ml ?? ((bounds.sugar.min + bounds.sugar.max) / 2);
  const satfat = attrs.sat_fat_g_per_100ml ?? ((bounds.satfat.min + bounds.satfat.max) / 2);
  const additives = attrs.additives_count ?? ((bounds.additives.min + bounds.additives.max) / 2);
  if (
    attrs.sugar_g_per_100ml === null ||
    attrs.sat_fat_g_per_100ml === null ||
    attrs.additives_count === null
  ) {
    flag = "imputed";
  }

  const health_sugar = normalizeLowerBetter(sugar, bounds.sugar.min, bounds.sugar.max);
  const health_satfat = normalizeLowerBetter(satfat, bounds.satfat.min, bounds.satfat.max);
  const health_add = normalizeLowerBetter(additives, bounds.additives.min, bounds.additives.max);
  const health_score =
    cfg.weights.health.sugar * health_sugar +
    cfg.weights.health.sat_fat * health_satfat +
    cfg.weights.health.additives * health_add;

  // Sustainability
  const materials = (attrs.packaging_materials || "").split(",").map(s => s.trim()).filter(Boolean);
  const primary = materials[0] || "other";
  const base = (cfg.packaging_base as any)[primary] ?? cfg.packaging_base["other"];
  const bonus = cfg.recyclability_bonus[attrs.recyclability] ?? 0;
  const packaging = clamp(base + bonus, 0, 100);

  const originMap: Record<string, number> = {
    UK: cfg.origin_scale.same_country,
    IE: cfg.origin_scale.neighboring_country,
    FR: cfg.origin_scale.intra_europe,
    SE: cfg.origin_scale.intra_europe
  };
  const origin = originMap[attrs.country_of_origin] ?? cfg.origin_scale.intra_europe;

  const certsSet = new Set(
    (attrs.certifications || "").split(";").map(s => s.trim().toLowerCase()).filter(Boolean)
  );
  let certs = 0;
  if (certsSet.has("organic")) certs += 10;
  if (certsSet.has("soil-association")) certs += 10;
  if (certsSet.has("bcorp")) certs += 5;
  if (certsSet.has("carbon-neutral")) certs += 5;
  certs = clamp(certs, 0, 20);

  const sustainability_score =
    cfg.weights.sustainability.packaging * packaging +
    cfg.weights.sustainability.origin * origin +
    cfg.weights.sustainability.certs * certs;

  // Price
  const price = basics.unit_price_gbp_per_litre;
  const price_score = normalizeLowerBetter(price, bounds.price.min, bounds.price.max);

  const planit_score =
    cfg.weights.overall.sustainability * sustainability_score +
    cfg.weights.overall.health * health_score +
    cfg.weights.overall.price * price_score;

  return {
    health_score: Math.round(health_score),
    sustainability_score: Math.round(sustainability_score),
    price_score: Math.round(price_score),
    planit_score: Math.round(planit_score),
    breakdown: {
      sugar: Math.round(health_sugar),
      sat_fat: Math.round(health_satfat),
      additives: Math.round(health_add),
      packaging,
      origin,
      certs,
      price_norm: Math.round(price_score)
    },
    quality_flag: flag
  };
}
