async function getProduct(id: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/v1/products?id=${id}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const data = await getProduct(params.id)
  return (
    <main style={{ padding: 24 }}>
      <a href="/">← Back</a>
      <h1>{data.brand} – {data.product_name}</h1>
      <p><strong>Retailer:</strong> {data.retailer} • <strong>£/L:</strong> {data.unit_price_gbp_per_litre}</p>
      <h3>Scores</h3>
      <ul>
        <li>PlanIt: {data.planit_score}</li>
        <li>Health: {data.health_score} (sugar {data.breakdown.sugar}, sat fat {data.breakdown.sat_fat}, additives {data.breakdown.additives})</li>
        <li>Sustainability: {data.sustainability_score} (packaging {data.breakdown.packaging}, origin {data.breakdown.origin}, certs {data.breakdown.certs})</li>
        <li>Price: {data.price_score}</li>
      </ul>
    </main>
  )
}
