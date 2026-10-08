#!/usr/bin/env node
/**
 * port-athlas-skills.mjs
 * ---------------------------------------------------------------------------
 * Membangun `lib/ai-skills.ts` — "Pustaka Skill" Kantor AI Homy Property —
 * dari paket skill milik bot Athlas (workspace-scoped skills).
 *
 * Sumber default: /data/.openclaw/workspace-athlas/skills
 * Pemakaian:      node scripts/port-athlas-skills.mjs [srcDir]
 *
 * Semua data (kategori, emoji, skill per-karyawan, daftar pengecualian)
 * didefinisikan di file ini agar hasilnya dapat direproduksi.
 * Skill trading/kripto dikecualikan (tidak relevan untuk platform properti).
 */
import fs from 'node:fs'
import path from 'node:path'

const SRC = process.argv[2] || '/data/.openclaw/workspace-athlas/skills'
const OUT = path.resolve(process.cwd(), 'lib/ai-skills.ts')
const BODY_CAP = 6000

/** Skill yang sengaja dikecualikan (trading/kripto & infra — tidak relevan untuk Homy). */
const EXCLUDE = new Set([
  'binance-spot-openapi-skill', 'openclaw-quant-skill', 'nofx', 'polyclaw',
  'claw-drive', 'hhmail',
])

/** Kategori (urutan tampil) + emoji. */
const CATEGORIES = [
  ['Strategi & Brand', '🧭'],
  ['Sosial & Konten', '📝'],
  ['SEO & Trafik', '🔎'],
  ['Pertumbuhan & Adopsi', '🚀'],
  ['Konversi & Monetisasi', '🎯'],
  ['Penjualan & CRM', '🤝'],
  ['Iklan Berbayar', '📣'],
  ['Desain & Visual', '🎨'],
  ['Analitik & Data', '📊'],
  ['Panduan Tim', '🧠'],
]
const CAT_OF_CAT = Object.fromEntries(CATEGORIES)

/** slug → kategori */
const CATEGORY = {
  'athlas-marketing': 'Panduan Tim', 'product-marketing': 'Strategi & Brand', 'marketing-ideas': 'Strategi & Brand',
  'marketing-psychology': 'Strategi & Brand', 'competitor-profiling': 'Strategi & Brand', 'competitors': 'Strategi & Brand',
  social: 'Sosial & Konten', 'content-strategy': 'Sosial & Konten', 'content-matrix': 'Sosial & Konten',
  copywriting: 'Sosial & Konten', 'copy-editing': 'Sosial & Konten', 'post-writer': 'Sosial & Konten',
  'post-formatter': 'Sosial & Konten', 'hook-generator': 'Sosial & Konten', 'quote-post': 'Sosial & Konten',
  'pinned-comment': 'Sosial & Konten', 'reels-scripting': 'Sosial & Konten', video: 'Sosial & Konten',
  'newsletter-voice': 'Sosial & Konten', 'voice-builder': 'Sosial & Konten', 'news-cog': 'Sosial & Konten',
  viralevo: 'Sosial & Konten', 'profile-optimizer': 'Sosial & Konten',
  'seo-audit': 'SEO & Trafik', 'ai-seo': 'SEO & Trafik', 'programmatic-seo': 'SEO & Trafik', schema: 'SEO & Trafik',
  'site-architecture': 'SEO & Trafik', 'directory-submissions': 'SEO & Trafik', 'niche-research': 'SEO & Trafik',
  'free-tools': 'SEO & Trafik',
  onboarding: 'Pertumbuhan & Adopsi', signup: 'Pertumbuhan & Adopsi', referrals: 'Pertumbuhan & Adopsi',
  'co-marketing': 'Pertumbuhan & Adopsi', launch: 'Pertumbuhan & Adopsi', 'lead-magnets': 'Pertumbuhan & Adopsi',
  'churn-prevention': 'Pertumbuhan & Adopsi', 'community-marketing': 'Pertumbuhan & Adopsi',
  cro: 'Konversi & Monetisasi', pricing: 'Konversi & Monetisasi', paywalls: 'Konversi & Monetisasi',
  popups: 'Konversi & Monetisasi', 'ab-testing': 'Konversi & Monetisasi', aso: 'Konversi & Monetisasi',
  prospecting: 'Penjualan & CRM', 'cold-email': 'Penjualan & CRM', emails: 'Penjualan & CRM', sms: 'Penjualan & CRM',
  'sales-enablement': 'Penjualan & CRM', revops: 'Penjualan & CRM', 'customer-research': 'Penjualan & CRM',
  ads: 'Iklan Berbayar', 'ad-creative': 'Iklan Berbayar',
  image: 'Desain & Visual', 'graphic-designer': 'Desain & Visual', 'gemini-carousel': 'Desain & Visual',
  'gemini-infographic': 'Desain & Visual',
  analytics: 'Analitik & Data', 'analytics-dashboard': 'Analitik & Data',
}

/** Skill yang dikuasai tiap karyawan AI Homy (slug karyawan → slug skill). */
const EMPLOYEE_SKILLS = {
  coo: ['athlas-marketing', 'product-marketing', 'analytics', 'marketing-psychology', 'ab-testing', 'revops', 'cro'],
  analyst: ['analytics', 'analytics-dashboard', 'ab-testing', 'customer-research'],
  sales: ['prospecting', 'cold-email', 'sales-enablement', 'emails', 'sms', 'copywriting', 'cro'],
  marketing: ['athlas-marketing', 'product-marketing', 'marketing-ideas', 'marketing-psychology', 'ads', 'ad-creative',
    'launch', 'co-marketing', 'pricing', 'community-marketing', 'competitor-profiling', 'referrals', 'lead-magnets', 'cro'],
  design: ['image', 'graphic-designer', 'gemini-carousel', 'gemini-infographic', 'ad-creative'],
  growth: ['onboarding', 'signup', 'referrals', 'lead-magnets', 'cro', 'popups', 'paywalls', 'churn-prevention',
    'ab-testing', 'community-marketing', 'launch', 'programmatic-seo', 'free-tools', 'directory-submissions'],
  content: ['social', 'content-strategy', 'content-matrix', 'copywriting', 'copy-editing', 'post-writer', 'post-formatter',
    'hook-generator', 'quote-post', 'pinned-comment', 'reels-scripting', 'video', 'newsletter-voice', 'voice-builder',
    'news-cog', 'viralevo', 'profile-optimizer', 'ai-seo', 'seo-audit'],
  listing: ['schema', 'site-architecture', 'programmatic-seo', 'niche-research', 'copywriting'],
}

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!m) return {}
  const out = {}
  let key = null
  let block = null
  for (const raw of m[1].split('\n')) {
    const line = raw.replace(/\r$/, '')
    const bs = line.match(/^(\w[\w-]*):\s*([>|])\s*$/)
    if (bs) { key = bs[1]; block = []; out[key] = ''; continue }
    if (block) {
      if (/^\s+\S/.test(line) || line.trim() === '') { block.push(line.replace(/^\s{2}/, '')); continue }
      out[key] = block.join(' ').replace(/\s+/g, ' ').trim(); block = null; key = null
    }
    const mm = line.match(/^(\w[\w-]*):\s*(.*)$/)
    if (mm) {
      let v = mm[2].trim().replace(/^["']|["']$/g, '')
      out[mm[1]] = v
    }
  }
  if (block) out[key] = block.join(' ').replace(/\s+/g, ' ').trim()
  return out
}

function deriveSummary(body, fm) {
  let s = (fm.description || '').trim()
  if (!s || s === '>' || s === '|') {
    const stripped = body.replace(/^#.*$/m, '').trim()
    const para = stripped.split(/\n\s*\n/).find((p) => p.trim() && !p.trim().startsWith('#')) || ''
    s = para.replace(/\s+/g, ' ').trim()
  }
  if (s.length > 300) s = s.slice(0, 297).trimEnd() + '…'
  return s
}

function deriveTitle(body, fm, slug) {
  if (fm.name && fm.name !== '>') return fm.name
  const h = body.match(/^#\s+(.+)$/m)
  return h ? h[1].trim() : slug
}

const entries = []
for (const dir of fs.readdirSync(SRC).sort()) {
  if (EXCLUDE.has(dir)) continue
  const file = path.join(SRC, dir, 'SKILL.md')
  if (!fs.existsSync(file)) continue
  const body = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  const fm = parseFrontmatter(body)
  const cat = CATEGORY[dir] || 'Strategi & Brand'
  let b = body.trim()
  if (b.length > BODY_CAP) b = b.slice(0, BODY_CAP).trimEnd() + '\n\n…(diringkas)'
  entries.push({
    slug: dir,
    name: dir === 'athlas-marketing' ? 'Panduan Pemasaran & Adopsi (Athlas)' : deriveTitle(body, fm, dir),
    category: cat,
    emoji: CAT_OF_CAT[cat] || '✨',
    summary: deriveSummary(body, fm),
    body: b,
    source: 'athlas',
  })
}

// urutkan: kategori (sesuai CATEGORIES) → nama
const catOrder = Object.fromEntries(CATEGORIES.map(([c], i) => [c, i]))
entries.sort((a, b) => (catOrder[a.category] - catOrder[b.category]) || a.name.localeCompare(b.name))

const header = `/**
 * lib/ai-skills.ts — GENERATED. Jangan edit manual.
 * Dibuat oleh scripts/port-athlas-skills.mjs dari paket skill bot Athlas.
 * Total ${entries.length} skill. Regenerasi: \`node scripts/port-athlas-skills.mjs\`.
 */
/* eslint-disable */
export type AiSkill = {
  slug: string
  name: string
  category: string
  emoji: string
  summary: string
  body: string
  source: string
}

export const SKILL_CATEGORIES: string[] = ${JSON.stringify(CATEGORIES.map((c) => c[0]))}

export const AI_SKILLS: AiSkill[] = ${JSON.stringify(entries, null, 2)}

/** Skill yang dikuasai tiap karyawan (slug karyawan → slug skill). */
export const EMPLOYEE_SKILLS: Record<string, string[]> = ${JSON.stringify(EMPLOYEE_SKILLS, null, 2)}

const SKILL_BY_SLUG = new Map(AI_SKILLS.map((s) => [s.slug, s]))
export function skillBySlug(slug: string): AiSkill | undefined { return SKILL_BY_SLUG.get(slug) }
export function skillsForEmployee(employeeSlug: string): AiSkill[] {
  return (EMPLOYEE_SKILLS[employeeSlug] ?? []).map((s) => SKILL_BY_SLUG.get(s)).filter(Boolean) as AiSkill[]
}

/** Brief ringkas berisi skill yang dikuasai seorang karyawan, untuk disuntik ke prompt. */
export function skillBriefFor(employeeSlug: string): string {
  const list = skillsForEmployee(employeeSlug)
  if (!list.length) return ''
  const lines = list.map((s) => \`- \${s.name}: \${s.summary}\`)
  return [
    'PUSTAKA SKILL KANTOR AI (kamu menguasai skill kelas dunia ini — terapkan bila relevan):',
    ...lines,
    'Gunakan prinsip & playbook skill di atas untuk menghasilkan kerja bermutu tinggi. Jika tugas butuh panduan mendalam, ikuti kerangka kerjanya.',
  ].join('\\n')
}
`

fs.writeFileSync(OUT, header)
const bytes = fs.statSync(OUT).size
console.log(`OK: ${OUT} — ${entries.length} skill, ${(bytes / 1024).toFixed(1)} KB`)
console.log('Kategori:', CATEGORIES.map((c) => c[0]).join(', '))
const missing = AI_SKILLS_missing()
function AI_SKILLS_missing() {
  const have = new Set(entries.map((e) => e.slug))
  const want = Object.values(EMPLOYEE_SKILLS).flat()
  return want.filter((s) => !have.has(s))
}
if (missing.length) console.warn('WARN: skill karyawan tidak ditemukan:', [...new Set(missing)].join(', '))
