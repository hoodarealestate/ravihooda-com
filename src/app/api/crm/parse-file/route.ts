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

    // Use first sheet
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]

    // Convert to JSON — raw: false gives formatted values, defval: '' fills empty cells
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, {
      raw: false,
      defval: '',
      blankrows: false,
    })

    if (!rows.length) return NextResponse.json({ error: 'File appears to be empty' }, { status: 400 })

    // Clean up keys — trim whitespace from column headers
    const cleanRows = rows.map(row => {
      const clean: Record<string, string> = {}
      for (const [k, v] of Object.entries(row)) {
        clean[k.trim()] = String(v ?? '').trim()
      }
      return clean
    })

    // Preview stats
    const validCount = cleanRows.filter(r => {
      const emailKey = Object.keys(r).find(k => k.toLowerCase().includes('email'))
      return emailKey && r[emailKey] && r[emailKey].includes('@')
    }).length

    return NextResponse.json({
      success: true,
      rows: cleanRows,
      total: cleanRows.length,
      valid: validCount,
      invalid: cleanRows.length - validCount,
      columns: Object.keys(cleanRows[0] || {}),
      fileName: file.name,
      sheetName,
    })
  } catch (err: any) {
    console.error('File parse error:', err)
    return NextResponse.json({ error: 'Failed to parse file: ' + (err.message || 'Unknown error') }, { status: 500 })
  }
}
