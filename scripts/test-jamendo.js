// Simple Jamendo API test runner
// Run with: node scripts/test-jamendo.js

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function loadEnv() {
  try {
    const content = readFileSync(join(process.cwd(), '.env'), 'utf8')
    return Object.fromEntries(
      content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
          const [key, ...rest] = line.split('=')
          return [key, rest.join('=')]
        })
    )
  } catch {
    return {}
  }
}

const env = loadEnv()
const CLIENT_ID =
  process.env.VITE_JAMENDO_CLIENT_ID ||
  env.VITE_JAMENDO_CLIENT_ID ||
  process.env.JAMENDO_CLIENT_ID ||
  env.JAMENDO_CLIENT_ID ||
  'b6747d04'
const BASE = 'https://api.jamendo.com/v3.0'

async function run() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    format: 'json',
    limit: '5',
    tags: 'ambient',
    audioformat: 'mp32',
    imagesize: '300',
    boost: 'popularity_week',
  })

  const url = `${BASE}/tracks/?${params}`
  console.log('Using CLIENT_ID:', CLIENT_ID)
  console.log('Fetching', url)

  const res = await fetch(url)
  if (!res.ok) {
    console.error('HTTP error', res.status, res.statusText)
    process.exit(1)
  }

  const json = await res.json()
  console.log('Got results:', json.results?.length)
  if (json.results?.length) {
    console.log('First track:', json.results[0])
  }
}

run().catch((err) => {
  console.error('Failed', err)
  process.exit(1)
})
