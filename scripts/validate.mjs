import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert'

const ROOT = process.cwd()
function head(p){ return fs.readFileSync(p,'utf8').split('\n')[0].trim() }

assert.equal(head(path.join(ROOT,'data','products.csv')),
'product_id,retailer,brand,product_name,size_ml,price_gbp,unit_price_gbp_per_litre,url,barcode,last_seen_at_utc')

assert.equal(head(path.join(ROOT,'data','attributes.csv')),
'product_id,off_code,ingredients_short,sugar_g_per_100ml,sat_fat_g_per_100ml,additives_count,packaging_materials,recyclability,certifications,country_of_origin,notes,source_links')

console.log('CSV headers OK')
