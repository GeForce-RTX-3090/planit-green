import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'csv-parse/sync'
import { scoreProduct } from '@planit/core'
import config from "@planit/config"
type Basics = import('@planit/core').ProductBasics
type Attrs = import('@planit/core').ProductAttrs

function loadCSV<T>(p: string): T[] {
  const csv = fs.readFileSync(p, 'utf8')
  return parse(csv, { columns: true, skip_empty_lines: true }) as T[]
}
function datasetRoot() {
  return path.resolve(process.cwd(), '..', '..', 'data')
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  const basics = loadCSV<Basics>(path.join(datasetRoot(), 'products.csv'))
  const attrs = loadCSV<(Attrs & { product_id: string })>(path.join(datasetRoot(), 'attributes.csv'))
  const byId = Object.fromEntries(attrs.map(a => [a.product_id, a]))

  if (id) {
    const b = basics.find(x => x.product_id === id)
    if (!b) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    const a = byId[id]
    const scored = scoreProduct(b, a, config as any)
    return NextResponse.json({ ...b, ...a, ...scored })
  }

  const rows = basics.map(b => {
    const a = byId[b.product_id]
    const s = scoreProduct(b, a, config as any)
    return { ...b, planit_score: s.planit_score, health_score: s.health_score, sustainability_score: s.sustainability_score, price_score: s.price_score }
  })
  rows.sort((x, y) => y.planit_score - x.planit_score)
  return NextResponse.json(rows)
}
