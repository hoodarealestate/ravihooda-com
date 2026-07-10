'use client'
import { useState, useEffect, useCallback } from 'react'

// ─── Types ───────────────────────────────────────────────────
type Contact = {
  id: string; name: string; email: string; phone: string | null
  status: string; source: string | null; notes: string | null; created_at: string
}
type Campaign = {
  id: string; subject: string; segment: string
  recipient_count: number; failed_count: number; sent_at: string
}
type View = 'dashboard' | 'contacts' | 'import' | 'compose' | 'campaigns'

const STATUSES = ['Lead','Buyer','Seller','Past Client','VOW Lead','POS Lead','Unsubscribed']
const TEMPLATES: Record<string, {subject:string; body:string}> = {
  market: {
    subject: 'GTA Market Update — {{month}} {{year}}',
    body: `Hi {{firstName}},\n\nI wanted to share a quick update on the Greater Toronto Area real estate market.\n\nIf you're thinking about buying or selling, now is a great time to have a conversation. Reply to this email or call me directly.\n\nWould you like a free market analysis for your specific neighbourhood?\n\nWarm regards,\nRavi & Rashmi Hooda\nThe Hooda Team — Century 21 Red Star Realty Inc.\nRavi: 416-825-5032 | Rashmi: 647-766-5040`,
  },
  checkin: {
    subject: 'Checking in — How are things?',
    body: `Hi {{firstName}},\n\nI hope you're doing well! I just wanted to reach out and check in.\n\nIf you have any questions about the real estate market, are thinking about buying or selling, or just want to chat — I'm always here to help.\n\nWarmly,\nRavi & Rashmi Hooda\nThe Hooda Team — Century 21 Red Star Realty Inc.\nRavi: 416-825-5032 | Rashmi: 647-766-5040`,
  },
  newlisting: {
    subject: 'New Listing Alert — Just Listed in the GTA',
    body: `Hi {{firstName}},\n\nI wanted to give you a heads-up about a property that just came to market.\n\n[Property details here — address, price, bedrooms, features]\n\nProperties like this are moving quickly. If you'd like to book a private showing, reply to this email or call me at 416-825-5032.\n\nBest,\nRavi & Rashmi Hooda\nThe Hooda Team — Century 21 Red Star Realty Inc.`,
  },
  seasonal: {
    subject: "Season's Greetings from The Hooda Team",
    body: `Hi {{firstName}},\n\nWishing you and your family a wonderful season filled with joy, warmth, and happiness.\n\nIt's been a pleasure serving the GTA community this year, and we're grateful for clients like you.\n\nWith gratitude,\nRavi & Rashmi Hooda\nThe Hooda Team — Century 21 Red Star Realty Inc.`,
  },
}

// ─── Styles ──────────────────────────────────────────────────
const S = {
  app: { display:'flex', minHeight:'100vh', fontFamily:"'Inter','DM Sans',system-ui,sans-serif", background:'#F5F3EF', fontSize:'14px' } as React.CSSProperties,
  sidebar: { width:220, background:'#1C3557', display:'flex', flexDirection:'column' as const, minHeight:'100vh', position:'sticky' as const, top:0 },
  main: { flex:1, display:'flex', flexDirection:'column' as const, overflow:'hidden' },
  topbar: { background:'#fff', borderBottom:'1px solid #E2E4E8', padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap' as const, gap:12 },
  content: { flex:1, padding:24, overflowY:'auto' as const },
  card: { background:'#fff', borderRadius:10, boxShadow:'0 2px 12px rgba(28,53,87,.08)', overflow:'hidden' },
  btn: (color='#1C3557') => ({ padding:'9px 18px', background:color, color:'#fff', border:'none', borderRadius:8, fontWeight:600, cursor:'pointer', fontSize:13, display:'inline-flex', alignItems:'center', gap:6 }) as React.CSSProperties,
  btnSm: (color='#1C3557') => ({ padding:'6px 12px', background:color, color:'#fff', border:'none', borderRadius:6, fontWeight:600, cursor:'pointer', fontSize:12 }) as React.CSSProperties,
  btnOutline: { padding:'8px 16px', background:'#fff', color:'#1C3557', border:'1.5px solid #E2E4E8', borderRadius:8, fontWeight:600, cursor:'pointer', fontSize:13 } as React.CSSProperties,
  input: { width:'100%', padding:'10px 12px', border:'1.5px solid #E2E4E8', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const },
  label: { display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:5 },
  navItem: (active:boolean) => ({ display:'flex', alignItems:'center', gap:9, padding:'9px 14px', borderRadius:7, color:active?'#fff':'rgba(255,255,255,.65)', background:active?'rgba(168,137,74,.25)':'transparent', cursor:'pointer', fontSize:13, fontWeight:active?600:400, marginBottom:2, border:'none', width:'100%', textAlign:'left' as const, borderLeft:active?'3px solid #D4B97A':'3px solid transparent' }),
  badge: (color='#1C3557') => ({ display:'inline-block', padding:'2px 8px', borderRadius:50, fontSize:11, fontWeight:600, background:color==='#1C3557'?'#EEF4FA':color==='green'?'#E8F5EE':color==='gold'?'#FFF8E6':'#F3F4F6', color:color==='#1C3557'?'#1C3557':color==='green'?'#2E7D5E':color==='gold'?'#A8894A':'#4A5568' }),
}

const statusColor = (s:string) => s==='Buyer'?'green':s==='Seller'?'gold':s==='Past Client'?'gray':s==='VOW Lead'?'gold':s==='POS Lead'?'gold':'#1C3557'

// ─── Main Component ───────────────────────────────────────────
export default function CRMDashboard() {
  const [authed, setAuthed]     = useState(false)
  const [loading, setLoading]   = useState(true)
  const [view, setView]         = useState<View>('dashboard')
  const [email, setEmail]       = useState('')
  const [pass, setPass]         = useState('')
  const [loginErr, setLoginErr] = useState('')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [campaigns, setCampaigns]       = useState<Campaign[]>([])
  const [stats, setStats]               = useState({ total:0, buyers:0, sellers:0, vow:0 })
  const [detail, setDetail]             = useState<Contact|null>(null)
  const [csvFile, setCsvFile]           = useState<File|null>(null)
  const [importing, setImporting]       = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const [compSubject, setCompSubject]   = useState('')
  const [compBody, setCompBody]         = useState('')
  const [compSegment, setCompSegment]   = useState('all')
  const [sending, setSending]           = useState(false)
  const [sendResult, setSendResult]     = useState<any>(null)
  const [toast, setToast]               = useState('')

  // Check auth on load
  useEffect(() => {
    fetch('/api/admin').then(r => r.json()).then(d => {
      setAuthed(d.authenticated)
      setLoading(false)
    })
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  const doLogin = async () => {
    setLoginErr('')
    const r = await fetch('/api/admin', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email, password:pass}) })
    if (r.ok) { setAuthed(true); loadDashboard() }
    else setLoginErr('Invalid email or password.')
  }

  // ── Data loaders ──────────────────────────────────────────
  const loadContacts = useCallback(async () => {
    const p = new URLSearchParams({ page:String(page), limit:'20', search, status:statusFilter })
    const r = await fetch('/api/crm/contacts?' + p)
    const d = await r.json()
    setContacts(d.contacts || [])
    setTotal(d.total || 0)
  }, [page, search, statusFilter])

  const loadCampaigns = async () => {
    const r = await fetch('/api/crm/campaigns')
    const d = await r.json()
    setCampaigns(d.campaigns || [])
  }

  const loadDashboard = async () => {
    const r = await fetch('/api/crm/contacts?limit=100')
    const d = await r.json()
    const all = d.contacts || []
    setStats({
      total: d.total || 0,
      buyers: all.filter((c:Contact) => c.status==='Buyer').length,
      sellers: all.filter((c:Contact) => c.status==='Seller').length,
      vow: all.filter((c:Contact) => c.status==='VOW Lead' || c.status==='POS Lead').length,
    })
  }

  useEffect(() => { if (authed) loadDashboard() }, [authed])
  useEffect(() => { if (authed && view==='contacts') loadContacts() }, [authed, view, page, search, statusFilter, loadContacts])
  useEffect(() => { if (authed && view==='campaigns') loadCampaigns() }, [authed, view])

  // ── Handlers ─────────────────────────────────────────────
  const handleImport = async () => {
    if (!csvFile) return
    setImporting(true); setImportResult(null)
    const text = await csvFile.text()
    const lines = text.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''))
    const rows = lines.slice(1).filter(l => l.trim()).map(l => {
      const vals = l.split(',').map(v => v.trim().replace(/^"|"$/g,''))
      const obj: Record<string,string> = {}
      headers.forEach((h,i) => { obj[h] = vals[i] || '' })
      return obj
    })
    const r = await fetch('/api/crm/import', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({contacts:rows}) })
    const d = await r.json()
    setImportResult(d); setImporting(false)
    if (d.imported) { showToast(`✅ ${d.imported} contacts imported!`); loadDashboard() }
  }

  const sendCampaign = async () => {
    if (!compSubject || !compBody) { showToast('Please fill in subject and body.'); return }
    setSending(true); setSendResult(null)
    const now = new Date()
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
    const body = compBody.replace(/\{\{month\}\}/g, months[now.getMonth()]).replace(/\{\{year\}\}/g, String(now.getFullYear()))
    const r = await fetch('/api/crm/campaigns', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({subject:compSubject, body, segment:compSegment}) })
    const d = await r.json()
    setSendResult(d); setSending(false)
    if (d.success) { showToast(`✅ Sent to ${d.sent} contacts!`); setCompSubject(''); setCompBody(''); loadCampaigns() }
  }

  const saveDetail = async () => {
    if (!detail) return
    await fetch(`/api/crm/contacts`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(detail) })
    showToast('Contact saved.')
    loadContacts()
  }

  // ── Loading / Login ───────────────────────────────────────
  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#1C3557'}}>
      <div style={{color:'#D4B97A',fontFamily:'Georgia,serif',fontSize:'1.2rem'}}>Loading…</div>
    </div>
  )

  if (!authed) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'linear-gradient(135deg,#1C3557,#142844)'}}>
      <div style={{background:'#fff',borderRadius:14,padding:40,maxWidth:400,width:'90%',boxShadow:'0 12px 48px rgba(0,0,0,.2)',borderTop:'3px solid #A8894A'}}>
        <div style={{fontFamily:'Georgia,serif',fontSize:'1.3rem',fontWeight:700,color:'#1A1F2E',marginBottom:4}}>The Hooda Team</div>
        <div style={{fontSize:12,color:'#A8894A',fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',marginBottom:28}}>CRM Dashboard</div>
        <label style={S.label}>Email</label>
        <input style={{...S.input,marginBottom:12}} type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doLogin()} placeholder="admin@ravihooda.com"/>
        <label style={S.label}>Password</label>
        <input style={{...S.input,marginBottom:16}} type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doLogin()} placeholder="••••••••"/>
        {loginErr && <div style={{color:'#dc2626',fontSize:12,marginBottom:12}}>{loginErr}</div>}
        <button style={{...S.btn(),width:'100%',justifyContent:'center'}} onClick={doLogin}>Sign In</button>
      </div>
    </div>
  )

  // ── App Shell ─────────────────────────────────────────────
  const navItems: Array<{key:View; label:string}> = [
    {key:'dashboard',label:'Dashboard'},
    {key:'contacts', label:`Contacts (${stats.total})`},
    {key:'import',   label:'Import CSV'},
    {key:'compose',  label:'Compose Email'},
    {key:'campaigns',label:'Sent Campaigns'},
  ]

  return (
    <div style={S.app}>
      {/* Sidebar */}
      <div style={S.sidebar}>
        <div style={{padding:'22px 16px 14px',borderBottom:'1px solid rgba(255,255,255,.1)'}}>
          <div style={{fontFamily:'Georgia,serif',fontSize:'1rem',color:'#fff',fontWeight:700}}>Hooda Team</div>
          <div style={{fontSize:11,color:'#D4B97A',marginTop:2,fontWeight:600,letterSpacing:'.05em'}}>CRM DASHBOARD</div>
        </div>
        <div style={{padding:'10px 10px',flex:1}}>
          {navItems.map(({key,label}) => (
            <button key={key} style={S.navItem(view===key)} onClick={()=>setView(key)}>{label}</button>
          ))}
        </div>
        <div style={{padding:14,borderTop:'1px solid rgba(255,255,255,.1)'}}>
          <div style={{fontSize:12,color:'rgba(255,255,255,.5)',marginBottom:8}}>Ravi & Rashmi Hooda</div>
          <button style={{...S.btnOutline,fontSize:12,padding:'7px 14px'}} onClick={async()=>{await fetch('/api/admin',{method:'DELETE'}); setAuthed(false)}}>Sign Out</button>
        </div>
      </div>

      {/* Main */}
      <div style={S.main}>
        <div style={S.topbar}>
          <div style={{fontFamily:'Georgia,serif',fontSize:'1.15rem',fontWeight:700,color:'#1A1F2E'}}>
            {navItems.find(n=>n.key===view)?.label || 'Dashboard'}
          </div>
          {view==='contacts' && (
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <input style={{...S.input,width:200}} placeholder="Search name, email, phone…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/>
              <select style={{...S.input,width:150}} value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1)}}>
                <option value="">All Statuses</option>
                {STATUSES.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>

        <div style={S.content}>

          {/* ── DASHBOARD ── */}
          {view==='dashboard' && (
            <div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:16,marginBottom:24}}>
                {[['Total Contacts',stats.total,'#1C3557'],['Buyers',stats.buyers,'#2E7D5E'],['Sellers',stats.sellers,'#A8894A'],['Web Leads',stats.vow,'#7C3AED']].map(([label,val,color])=>(
                  <div key={String(label)} style={{...S.card,padding:18,borderLeft:`4px solid ${color}`}}>
                    <div style={{fontSize:11,fontWeight:700,color:'#6B7280',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:8}}>{label}</div>
                    <div style={{fontFamily:'Georgia,serif',fontSize:'1.8rem',fontWeight:700,color:'#1A1F2E'}}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                <div style={S.card}>
                  <div style={{padding:'14px 18px',borderBottom:'1px solid #E2E4E8',fontWeight:600,color:'#1A1F2E'}}>Quick Actions</div>
                  <div style={{padding:16,display:'flex',flexDirection:'column',gap:8}}>
                    <button style={S.btn()} onClick={()=>setView('compose')}>✉ Send Email Campaign</button>
                    <button style={{...S.btn('#2E7D5E')}} onClick={()=>setView('import')}>⬆ Import CSV Contacts</button>
                    <button style={{...S.btn('#6B7280')}} onClick={()=>setView('contacts')}>👥 View All Contacts</button>
                    <a href="/" style={{...S.btn('#A8894A'),textDecoration:'none',display:'inline-flex'}}>🏠 View Website</a>
                  </div>
                </div>
                <div style={S.card}>
                  <div style={{padding:'14px 18px',borderBottom:'1px solid #E2E4E8',fontWeight:600,color:'#1A1F2E'}}>Recent Campaigns</div>
                  <div style={{padding:campaigns.length?0:16}}>
                    {campaigns.slice(0,4).map(c=>(
                      <div key={c.id} style={{padding:'10px 16px',borderBottom:'1px solid #F3F4F6'}}>
                        <div style={{fontWeight:500,color:'#1A1F2E',fontSize:13}}>{c.subject}</div>
                        <div style={{fontSize:11,color:'#9CA3AF',marginTop:2}}>{new Date(c.sent_at).toLocaleDateString('en-CA',{month:'short',day:'numeric'})} · {c.recipient_count} sent</div>
                      </div>
                    ))}
                    {!campaigns.length && <div style={{color:'#9CA3AF',fontSize:13}}>No campaigns yet.</div>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── CONTACTS ── */}
          {view==='contacts' && (
            <div style={S.card}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{background:'#F9FAFB'}}>
                      {['Name','Email','Phone','Status','Source','Added','Actions'].map(h=>(
                        <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:700,color:'#6B7280',letterSpacing:'.06em',textTransform:'uppercase',borderBottom:'1px solid #E2E4E8',whiteSpace:'nowrap'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map(c=>(
                      <tr key={c.id} style={{borderBottom:'1px solid #F3F4F6'}}>
                        <td style={{padding:'11px 14px',fontWeight:600,color:'#1A1F2E',whiteSpace:'nowrap'}}>{c.name}</td>
                        <td style={{padding:'11px 14px',color:'#6B7280',fontSize:12}}>{c.email}</td>
                        <td style={{padding:'11px 14px',color:'#6B7280',fontSize:12}}>{c.phone||'—'}</td>
                        <td style={{padding:'11px 14px'}}><span style={S.badge(statusColor(c.status))}>{c.status}</span></td>
                        <td style={{padding:'11px 14px',color:'#9CA3AF',fontSize:12}}>{c.source||'—'}</td>
                        <td style={{padding:'11px 14px',color:'#9CA3AF',fontSize:12,whiteSpace:'nowrap'}}>{new Date(c.created_at).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'2-digit'})}</td>
                        <td style={{padding:'11px 14px'}}><button style={S.btnSm()} onClick={()=>setDetail(c)}>View</button></td>
                      </tr>
                    ))}
                    {!contacts.length && (
                      <tr><td colSpan={7} style={{textAlign:'center',padding:40,color:'#9CA3AF'}}>No contacts found. Import your CSV to get started.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              <div style={{padding:'12px 16px',borderTop:'1px solid #E2E4E8',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
                <div style={{fontSize:12,color:'#6B7280'}}>Showing {contacts.length} of {total} contacts</div>
                <div style={{display:'flex',gap:4}}>
                  {Array.from({length:Math.ceil(total/20)},(_,i)=>(
                    <button key={i} style={{...S.btnSm(page===i+1?'#1C3557':'#E2E4E8'),color:page===i+1?'#fff':'#1A1F2E'}} onClick={()=>setPage(i+1)}>{i+1}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── IMPORT ── */}
          {view==='import' && (
            <div style={{...S.card,padding:28}}>
              <h3 style={{fontFamily:'Georgia,serif',color:'#1A1F2E',marginBottom:6}}>Import Contacts from CSV</h3>
              <p style={{color:'#6B7280',fontSize:13,marginBottom:22}}>Upload your Excel/CSV file. Supported columns: Name, Email, Phone, Status, Notes. Duplicates (same email) will be updated, not duplicated.</p>
              <div
                style={{border:'2px dashed #E2E4E8',borderRadius:10,padding:40,textAlign:'center',cursor:'pointer',marginBottom:20,background:csvFile?'#EEF4FA':'transparent'}}
                onClick={()=>document.getElementById('csvInput')?.click()}
                onDragOver={e=>{e.preventDefault()}}
                onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)setCsvFile(f)}}
              >
                <div style={{fontSize:32,marginBottom:8}}>📄</div>
                <div style={{fontWeight:600,color:'#1A1F2E',marginBottom:4}}>{csvFile?csvFile.name:'Drop your CSV file here'}</div>
                <div style={{fontSize:12,color:'#9CA3AF',marginBottom:12}}>or click to browse — supports .csv, .xlsx</div>
                <button style={S.btnOutline} onClick={e=>{e.stopPropagation();document.getElementById('csvInput')?.click()}}>Choose File</button>
                <input id="csvInput" type="file" accept=".csv,.txt" style={{display:'none'}} onChange={e=>{if(e.target.files?.[0]) setCsvFile(e.target.files[0])}}/>
              </div>
              {csvFile && (
                <button style={{...S.btn(),marginBottom:16}} onClick={handleImport} disabled={importing}>
                  {importing ? 'Importing…' : `Import ${csvFile.name}`}
                </button>
              )}
              {importResult && (
                <div style={{background:importResult.imported?'#E8F5EE':'#FEF2F2',borderRadius:8,padding:'14px 18px',border:`1px solid ${importResult.imported?'#BBF7D0':'#FECACA'}`,fontSize:13}}>
                  {importResult.imported ? `✅ ${importResult.imported} contacts imported successfully.` : ''}
                  {importResult.failed ? ` ${importResult.failed} failed.` : ''}
                  {importResult.skipped ? ` ${importResult.skipped} skipped (missing email).` : ''}
                  {importResult.error && `❌ ${importResult.error}`}
                </div>
              )}
              <div style={{background:'#FFF8E6',borderRadius:8,padding:'12px 16px',fontSize:12,color:'#7A6230',marginTop:16}}>
                <strong>Expected format:</strong><br/>
                <code>Name, Email, Phone, Status, Notes</code><br/>
                <code>John Smith, john@email.com, 647-000-0000, Buyer, Met at open house</code>
              </div>
            </div>
          )}

          {/* ── COMPOSE ── */}
          {view==='compose' && (
            <div>
              <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
                {Object.entries(TEMPLATES).map(([key,t])=>(
                  <button key={key} style={S.btnOutline} onClick={()=>{setCompSubject(t.subject);setCompBody(t.body)}}>
                    {key==='market'?'📊':key==='checkin'?'👋':key==='newlisting'?'🏠':'🎉'} {key.charAt(0).toUpperCase()+key.slice(1)}
                  </button>
                ))}
              </div>
              <div style={S.card}>
                <div style={{padding:'12px 18px',borderBottom:'1px solid #E2E4E8',display:'flex',alignItems:'center',gap:12}}>
                  <span style={{fontSize:12,fontWeight:600,color:'#6B7280',width:60}}>From</span>
                  <span style={{fontSize:13,color:'#1A1F2E'}}>Ravi & Rashmi Hooda — The Hooda Team</span>
                </div>
                <div style={{padding:'12px 18px',borderBottom:'1px solid #E2E4E8',display:'flex',alignItems:'center',gap:12}}>
                  <span style={{fontSize:12,fontWeight:600,color:'#6B7280',width:60}}>To</span>
                  <select style={{...S.input,border:'none',padding:0,flex:1,fontSize:13}} value={compSegment} onChange={e=>setCompSegment(e.target.value)}>
                    <option value="all">All Contacts</option>
                    {STATUSES.filter(s=>s!=='Unsubscribed').map(s=><option key={s} value={s}>{s}s</option>)}
                  </select>
                </div>
                <div style={{padding:'12px 18px',borderBottom:'1px solid #E2E4E8',display:'flex',alignItems:'center',gap:12}}>
                  <span style={{fontSize:12,fontWeight:600,color:'#6B7280',width:60}}>Subject</span>
                  <input style={{...S.input,border:'none',padding:0,flex:1,fontSize:13}} placeholder="Enter subject…" value={compSubject} onChange={e=>setCompSubject(e.target.value)}/>
                </div>
                <div style={{padding:18}}>
                  <textarea style={{...S.input,minHeight:240,resize:'vertical',lineHeight:1.7}} placeholder="Write your email here…&#10;&#10;Use {{firstName}} and {{fullName}} for personalisation." value={compBody} onChange={e=>setCompBody(e.target.value)}/>
                </div>
                <div style={{padding:'14px 18px',borderTop:'1px solid #E2E4E8',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
                  <div style={{fontSize:12,color:'#9CA3AF'}}>Unsubscribe link + office address added automatically (CASL compliant)</div>
                  <div style={{display:'flex',gap:8}}>
                    <button style={S.btnOutline} onClick={()=>{
                      const w=window.open('','_blank','width=640,height=700')
                      w?.document.write(`<html><body style="font-family:Arial;padding:24px;max-width:600px;margin:auto"><h2>${compSubject}</h2><pre style="white-space:pre-wrap;line-height:1.7">${compBody.replace(/{{firstName}}/g,'[First Name]').replace(/{{fullName}}/g,'[Full Name]')}</pre></body></html>`)
                    }}>Preview</button>
                    <button style={S.btn('#A8894A')} onClick={sendCampaign} disabled={sending}>
                      {sending?'Sending…':'Send Campaign ✉'}
                    </button>
                  </div>
                </div>
              </div>
              {sendResult && (
                <div style={{marginTop:16,background:sendResult.success?'#E8F5EE':'#FEF2F2',borderRadius:8,padding:'14px 18px',fontSize:13}}>
                  {sendResult.success?`✅ Sent to ${sendResult.sent} contacts!${sendResult.failed?` (${sendResult.failed} failed)`:''}`:`❌ ${sendResult.error}`}
                </div>
              )}
            </div>
          )}

          {/* ── CAMPAIGNS ── */}
          {view==='campaigns' && (
            <div>
              {campaigns.map(c=>(
                <div key={c.id} style={{...S.card,padding:'16px 20px',marginBottom:12,display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
                  <div style={{width:44,height:44,borderRadius:10,background:'#EEF4FA',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>✉</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,color:'#1A1F2E'}}>{c.subject}</div>
                    <div style={{fontSize:12,color:'#9CA3AF',marginTop:2}}>{new Date(c.sent_at).toLocaleDateString('en-CA',{year:'numeric',month:'short',day:'numeric'})} · Segment: {c.segment==='all'?'All Contacts':c.segment}</div>
                  </div>
                  <div style={{display:'flex',gap:16,textAlign:'center'}}>
                    <div><div style={{fontWeight:700,fontSize:'1rem',color:'#1A1F2E'}}>{c.recipient_count}</div><div style={{fontSize:11,color:'#9CA3AF'}}>Sent</div></div>
                    {c.failed_count>0 && <div><div style={{fontWeight:700,fontSize:'1rem',color:'#dc2626'}}>{c.failed_count}</div><div style={{fontSize:11,color:'#9CA3AF'}}>Failed</div></div>}
                  </div>
                </div>
              ))}
              {!campaigns.length && <div style={{...S.card,padding:48,textAlign:'center',color:'#9CA3AF'}}>No campaigns sent yet. Compose your first email campaign.</div>}
            </div>
          )}

        </div>
      </div>

      {/* Contact Detail Panel */}
      {detail && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:1000,display:'flex',justifyContent:'flex-end'}} onClick={()=>setDetail(null)}>
          <div style={{width:400,background:'#fff',height:'100vh',overflowY:'auto',padding:24,display:'flex',flexDirection:'column',gap:16}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
              <div style={{fontFamily:'Georgia,serif',fontSize:'1.1rem',fontWeight:700,color:'#1A1F2E'}}>{detail.name}</div>
              <button style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#9CA3AF'}} onClick={()=>setDetail(null)}>×</button>
            </div>
            {[['Email',detail.email],['Phone',detail.phone||'—'],['Source',detail.source||'—'],['Added',new Date(detail.created_at).toLocaleDateString('en-CA')]].map(([label,val])=>(
              <div key={label} style={{display:'flex',gap:10,fontSize:13}}>
                <span style={{fontWeight:600,color:'#9CA3AF',width:60,flexShrink:0}}>{label}</span>
                <span style={{color:'#1A1F2E'}}>{val}</span>
              </div>
            ))}
            <div>
              <label style={S.label}>Status</label>
              <select style={S.input} value={detail.status} onChange={e=>setDetail({...detail,status:e.target.value})}>
                {STATUSES.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Notes</label>
              <textarea style={{...S.input,minHeight:100,resize:'vertical'}} value={detail.notes||''} onChange={e=>setDetail({...detail,notes:e.target.value})}/>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button style={S.btn()} onClick={saveDetail}>Save</button>
              <a href={`mailto:${detail.email}`} style={{...S.btn('#6B7280'),textDecoration:'none'}}>Email</a>
              {detail.phone && <a href={`tel:${detail.phone}`} style={{...S.btn('#2E7D5E'),textDecoration:'none'}}>Call</a>}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{position:'fixed',bottom:24,right:24,background:'#1C3557',color:'#fff',padding:'14px 20px',borderRadius:10,boxShadow:'0 8px 32px rgba(0,0,0,.2)',zIndex:9999,fontSize:13,fontWeight:500,borderLeft:'4px solid #A8894A',maxWidth:320}}>
          {toast}
        </div>
      )}
    </div>
  )
}
