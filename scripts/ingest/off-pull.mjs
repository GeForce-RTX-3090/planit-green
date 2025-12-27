// Node 18+ has global fetch. Run: node scripts/ingest/off-pull.mjs
import fs from 'node:fs'; import path from 'node:path'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'

const ROOT = path.resolve(process.cwd())
const productsPath = path.join(ROOT, 'data', 'products.csv')
const attrsPath = path.join(ROOT, 'data', 'attributes.csv')

const products = parse(fs.readFileSync(productsPath, 'utf8'), { columns: true, skip_empty_lines: true })
const attrs = parse(fs.readFileSync(attrsPath, 'utf8'), { columns: true, skip_empty_lines: true })
const attrById = new Map(attrs.map(a => [a.product_id, a]))

async function fetchOFF(barcode) {
  if (!barcode) return null
  const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}`
  const res = await fetch(url); if (!res.ok) return null
  const j = await res.json(); return j.product || null
}

function coalesce(x, fallback){ return (x===undefined||x===null||x==='') ? fallback : x }

for (const p of products) {
  const id = p.product_id
  const a = attrById.get(id) || {
    product_id: id, off_code: '', ingredients_short: '', sugar_g_per_100ml: '', sat_fat_g_per_100ml: '',
    additives_count: '', packaging_materials: '', recyclability: '', certifications: '',
    country_of_origin: '', notes: '', source_links: ''
  }
  const off = await fetchOFF(p.barcode)
  if (off) {
    a.off_code = coalesce(a.off_code, off.code)
    a.ingredients_short = coalesce(a.ingredients_short, off.ingredients_text || off.ingredients_text_en || '')
    a.sugar_g_per_100ml = coalesce(a.sugar_g_per_100ml, off.nutriments?.sugars_100g ?? '')
    a.sat_fat_g_per_100ml = coalesce(a.sat_fat_g_per_100ml, off.nutriments?.['saturated-fat_100g'] ?? '')
    a.additives_count = coalesce(a.additives_count, off.additives_n ?? '')
    // Basic packaging guess; feel free to tweak
    a.packaging_materials = coalesce(a.packaging_materials, (off.packaging || '').toLowerCase().includes('tetra') ? 'tetra-pack' : '')
    a.recyclability = coalesce(a.recyclability, 'check_local')
    a.certifications = coalesce(a.certifications, (off.labels || '').toLowerCase().includes('organic') ? 'organic' : '')
    a.country_of_origin = coalesce(a.country_of_origin, (off.countries_tags?.[0] || '').split(':').pop()?.toUpperCase() || '')
    const src = `https://world.openfoodfacts.org/product/${off.code}`
    a.source_links = [a.source_links, src].filter(Boolean).join(';')
  }
  attrById.set(id, a)
}

// Write back
const header = Object.keys(attrById.values().next().value)
const out = stringify(Array.from(attrById.values()), { header: true, columns: header })
fs.writeFileSync(attrsPath, out, 'utf8')
console.log('Updated', attrsPath)
