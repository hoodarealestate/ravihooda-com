// api/crm/parse-file/route.ts
// Accepts .xlsx, .xls, or .csv and returns parsed rows as JSON
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import * as XLSX from 'xlsx'

const CRM_SECRET = new TextEncoder().encode(process.env.CRM_JWT_SECRET || 'hooda-crm-jwt-secret-2026')

async function authCheck(req: NextRequest) {
  const token = req.cookies.get('crm_token')?.value
  if (!token) return false
  try { await jwtVerify(token, CRM_SECRET); return true } catch { return false }
}

export async function POST(req: NextRequest) {
  if (!await authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const fileName = file.name.toLowerCase()
    const isExcel  = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
    const isCSV    = fileName.endsWith('.csv') || fileName.endsWith('.txt')

    if (!isExcel && !isCSV) {
      return NextResponse.json({ error: 'Unsupported file type. Please upload .xlsx, .xls, or .csv' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })

    // Process ALL sheets and combine rows
    const sheetNames = workbook.SheetNames
    const allRows: Record<string, string>[] = []
    const sheetSummary: Record<string, number> = {}

    for (const sheetName of sheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, {
        raw: false,
        defval: '',
        blankrows: false,
      })

      if (!rows.length) {
        sheetSummary[sheetName] = 0
        continue
      }

      // Clean up keys and add sheet name as source hint
      const cleanRows = rows.map(row => {
        const clean: Record<string, string> = {}
        for (const [k, v] of Object.entries(row)) {
          clean[k.trim()] = String(v ?? '').trim()
        }
        // If no source column, tag with sheet name so import knows where it came from
        if (!clean['Source'] && !clean['source'] && !clean['lead source']) {
          clean['_sheet'] = sheetName
        }
        return clean
      })

      sheetSummary[sheetName] = cleanRows.length
      allRows.push(...cleanRows)
    }

    if (!allRows.length) return NextResponse.json({ error: 'File appears to be empty' }, { status: 400 })

    // Remove completely empty rows first (Excel often has thousands of blank rows)
    const nonEmpty = allRows.filter(row => {
      const vals = Object.values(row).filter(v => String(v).trim())
      return vals.length > 1  // at least 2 non-empty fields
    })

    // Deduplicate by email across sheets (keep first occurrence)
    const seen = new Set<string>()
    const deduped = nonEmpty.filter(row => {
      const emailKey = Object.keys(row).find(k => k.toLowerCase().includes('email'))
      const email = emailKey ? row[emailKey].toLowerCase().trim() : ''
      if (!email || seen.has(email)) return false
      seen.add(email)
      return true
    })

    const validCount = deduped.filter(r => {
      const emailKey = Object.keys(r).find(k => k.toLowerCase().includes('email'))
      return emailKey && r[emailKey] && r[emailKey].includes('@')
    }).length

    return NextResponse.json({
      success: true,
      rows: deduped,
      total: deduped.length,
      valid: validCount,
      invalid: deduped.length - validCount,
      crossSheetDuplicates: nonEmpty.length - deduped.length,
      columns: Object.keys(deduped[0] || {}),
      fileName: file.name,
      sheets: sheetNames,
      sheetSummary,
    })
  } catch (err: any) {
    console.error('File parse error:', err)
    return NextResponse.json({ error: 'Failed to parse file: ' + (err.message || 'Unknown error') }, { status: 500 })
  }
}
