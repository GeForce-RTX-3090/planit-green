'use client'
import useSWR from 'swr'
const fetcher = (u: string) => fetch(u).then(r => r.json())

export default function Home() {
  const { data, error } = useSWR<any[]>('/api/v1/products', fetcher)
  if (error) return <div>Failed to load</div>
  if (!data) return <div>Loading…</div>
  return (
    <main style={{ padding: 24 }}>
      <h1>PlanIt Green – Oat Milk (UK)</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th align="left">Product</th><th>Retailer</th><th>£/L</th>
            <th>PlanIt</th><th>Health</th><th>Sust.</th><th>Price</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.product_id} onClick={() => (window.location.href = `/product/${r.product_id}`)} style={{ cursor: 'pointer' }}>
              <td>{r.brand} – {r.product_name}</td>
              <td align="center">{r.retailer}</td>
              <td align="center">{r.unit_price_gbp_per_litre?.toFixed?.(2) ?? r.unit_price_gbp_per_litre}</td>
              <td align="center">{r.planit_score}</td>
              <td align="center">{r.health_score}</td>
              <td align="center">{r.sustainability_score}</td>
              <td align="center">{r.price_score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
