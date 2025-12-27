'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'

type Row = {
  product_id: string
  retailer: string
  brand: string
  product_name: string
  unit_price_gbp_per_litre: number
  planit_score: number
  health_score: number
  sustainability_score: number
  price_score: number
}

const fetcher = (u: string) => fetch(u).then(r => r.json())

type SortKey = 'planit_score' | 'health_score' | 'sustainability_score' | 'price_score' | 'unit_price_gbp_per_litre'

export default function Home() {
  const { data, error, isLoading, mutate } = useSWR<Row[]>('/api/v1/products', fetcher)
  const [q, setQ] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('planit_score')
  const [dir, setDir] = useState<'desc' | 'asc'>('desc')

  function onSort(next: SortKey) {
    if (next === sortKey) setDir(d => (d === 'desc' ? 'asc' : 'desc'))
    else {
      setSortKey(next)
      setDir(next === 'unit_price_gbp_per_litre' ? 'asc' : 'desc') // cheapest first for price
    }
  }

  const rows = useMemo(() => {
    if (!data) return []
    const term = q.trim().toLowerCase()
    const filtered = term
      ? data.filter(r =>
          `${r.brand} ${r.product_name} ${r.retailer}`.toLowerCase().includes(term),
        )
      : data.slice()

    const factor = dir === 'desc' ? -1 : 1
    filtered.sort((a, b) => {
      const av = (a as any)[sortKey] ?? 0
      const bv = (b as any)[sortKey] ?? 0
      // numeric compare
      if (av < bv) return 1 * factor
      if (av > bv) return -1 * factor
      // tie-break by name
      return `${a.brand} ${a.product_name}`.localeCompare(`${b.brand} ${b.product_name}`) * factor
    })

    return filtered
  }, [data, q, sortKey, dir])

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1>PlanIt Green – Oat Milk (UK)</h1>
        <p role="alert">Failed to load. <button onClick={() => mutate()} style={{ textDecoration: 'underline' }}>Retry</button></p>
      </main>
    )
  }
  if (isLoading) return <main style={{ padding: 24 }}>Loading…</main>

  return (
    <main className="wrap">
      <header className="bar">
        <div>
          <h1>PlanIt Green – Oat Milk (UK)</h1>
          <p className="sub">Transparent, reproducible scoring for a single category MVP.</p>
        </div>
        <div className="controls">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search brand or product…"
            aria-label="Search products"
          />
          <div className="legend">
            <span className="pill">PlanIt</span>
            <span className="pill">Health</span>
            <span className="pill">Sust.</span>
            <span className="pill">Price</span>
          </div>
        </div>
      </header>

      <div className="meta">
        <span>{rows.length} item{rows.length === 1 ? '' : 's'}</span>
      </div>

      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <Th text="Product" />
              <Th text="Retailer" center />
              <Th text="£/L" center sortKey="unit_price_gbp_per_litre" activeKey={sortKey} dir={dir} onSort={onSort} />
              <Th text="PlanIt" center sortKey="planit_score" activeKey={sortKey} dir={dir} onSort={onSort} />
              <Th text="Health" center sortKey="health_score" activeKey={sortKey} dir={dir} onSort={onSort} />
              <Th text="Sust." center sortKey="sustainability_score" activeKey={sortKey} dir={dir} onSort={onSort} />
              <Th text="Price" center sortKey="price_score" activeKey={sortKey} dir={dir} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 24 }}>No matches for “{q}”. Try a different search.</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.product_id} className="row">
                <td>
                  <Link href={`/product/${r.product_id}`} className="link">
                    {r.brand} – {r.product_name}
                  </Link>
                </td>
                <td className="center">{r.retailer}</td>
                <td className="center">{fmtMoney(r.unit_price_gbp_per_litre)}</td>
                <td className="center strong">{r.planit_score}</td>
                <td className="center">{r.health_score}</td>
                <td className="center">{r.sustainability_score}</td>
                <td className="center">{r.price_score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .wrap { padding: 24px; max-width: 1100px; margin: 0 auto; }
        .bar { display: flex; flex-wrap: wrap; align-items: end; gap: 16px; justify-content: space-between; }
        h1 { margin: 0; font-size: 24px; }
        .sub { margin: 4px 0 0; color: #666; font-size: 13px; }
        .controls { display: flex; gap: 12px; align-items: center; }
        input { padding: 8px 10px; min-width: 240px; border: 1px solid #ccc; border-radius: 8px; }
        .legend { display: none; gap: 6px; }
        .pill { padding: 4px 8px; border-radius: 999px; border: 1px solid #ddd; font-size: 12px; }
        .meta { margin: 10px 0; color: #555; font-size: 13px; }
        .table-wrap { overflow: auto; border: 1px solid #eee; border-radius: 10px; }
        table.grid { width: 100%; border-collapse: collapse; font-size: 14px; }
        thead th { position: sticky; top: 0; background: #fafafa; z-index: 1; }
        th, td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; }
        .row:hover { background: #fcfcfc; }
        .center { text-align: center; }
        .strong { font-weight: 600; }
        .link { color: inherit; text-decoration: none; }
        .link:hover { text-decoration: underline; }
        @media (max-width: 640px) {
          input { min-width: 160px; }
          .legend { display: flex; }
          .sub { display: none; }
        }
      `}</style>
    </main>
  )
}

function fmtMoney(x: number | undefined) {
  if (x === undefined || x === null || Number.isNaN(x)) return '—'
  // show £/L to 2dp
  return x.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function Th(props: {
  text: string
  sortKey?: SortKey
  activeKey?: SortKey
  dir?: 'asc' | 'desc'
  center?: boolean
  onSort?: (k: SortKey) => void
}) {
  const { text, sortKey, activeKey, dir, onSort, center } = props
  const isSortable = !!sortKey && !!onSort
  const isActive = isSortable && activeKey === sortKey
  const arrow = isActive ? (dir === 'desc' ? ' ↓' : ' ↑') : ''
  return (
    <th
      scope="col"
      className={center ? 'center' : undefined}
      onClick={isSortable ? () => onSort!(sortKey!) : undefined}
      style={{ cursor: isSortable ? 'pointer' : 'default', whiteSpace: 'nowrap' }}
      aria-sort={isActive ? (dir === 'desc' ? 'descending' : 'ascending') : 'none'}
      title={isSortable ? `Sort by ${text}` : undefined}
    >
      {text}{arrow}
    </th>
  )
}
