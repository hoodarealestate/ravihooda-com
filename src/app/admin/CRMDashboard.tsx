'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

type Contact = {
  id: string; name: string; email: string; phone: string | null
  status: string; category: string; temperature: string
  source: string | null; notes: string | null; tags: string | null
  address: string | null; birthday: string | null
  referred_by: string | null; last_contacted: string | null
  created_at: string; updated_at: string
}
type Campaign = { id:string; subject:string; segment:string; recipient_count:number; failed_count:number; sent_at:string }
type View = 'dashboard'|'contacts'|'add'|'import'|'compose'|'campaigns'|'newsletter'

const STATUSES    = ['Lead','Client','Past Client','Prospect','VOW Lead','POS Lead','Unsubscribed']
const CATEGORIES  = ['Buyer','Seller','Investor','Renter','Prospect','Referral Partner']
const TEMPERATURES = ['Hot','Warm','Cold']
const SEGMENTS    = ['all',...STATUSES.filter(s=>s!=='Unsubscribed'),...CATEGORIES]

const TEMP_COLOR: Record<string,string> = { Hot:'#dc2626', Warm:'#d97706', Cold:'#3b82f6' }
const CAT_COLOR:  Record<string,string> = { Buyer:'#059669', Seller:'#7c3aed', Investor:'#0891b2', Renter:'#0284c7', Prospect:'#6b7280', 'Referral Partner':'#9333ea' }

const TEMPLATES: Record<string,{subject:string;body:string}> = {
  'Market Update':{ subject:'GTA Market Update — {{month}} {{year}}', body:`Hi {{firstName}},\n\nI wanted to share a quick update on the Greater Toronto Area real estate market for {{month}}.\n\nIf you're thinking about buying or selling, now is a great time to have a conversation.\n\nWarm regards,\nRavi & Rashmi Hooda\nThe Hooda Team — Century 21 Red Star Realty Inc.\nRavi: 416-825-5032 | Rashmi: 647-766-5040` },
  'New Listing':{ subject:'New Listing Alert — Just Listed in the GTA', body:`Hi {{firstName}},\n\nI wanted to give you a heads-up about a property that just came to market that might interest you.\n\n[Property details — address, price, bedrooms, features]\n\nProperties like this are moving quickly. Reply or call 416-825-5032 to book a showing.\n\nBest,\nRavi & Rashmi Hooda\nThe Hooda Team` },
  'Check In':{ subject:'Checking in — How are things?', body:`Hi {{firstName}},\n\nI hope you're doing well! Just reaching out to check in.\n\nIf you have any questions about the market, are thinking about buying or selling, or just want to chat — I'm always here.\n\nWarmly,\nRavi & Rashmi Hooda\nThe Hooda Team — 416-825-5032` },
  'Price Drop':{ subject:'Price Reduction Alert — {{address}}', body:`Hi {{firstName}},\n\nGreat news — a property you might be interested in just had a price reduction!\n\n[Property details and new price here]\n\nThis won't last long at this price. Call me at 416-825-5032 to book a private viewing.\n\nRavi & Rashmi Hooda\nThe Hooda Team` },
  'Just Sold':{ subject:'Just Sold — Another Happy GTA Family!', body:`Hi {{firstName}},\n\nExcited to share that we just helped another family find their perfect GTA home!\n\nIf you or someone you know is thinking about buying or selling, we'd love to help.\n\nRavi & Rashmi Hooda\nThe Hooda Team — 416-825-5032` },
  'Seasonal':{ subject:"Season's Greetings from The Hooda Team", body:`Hi {{firstName}},\n\nWishing you and your family a wonderful season filled with joy and happiness.\n\nIt's been a pleasure serving the GTA community, and we're grateful for clients like you.\n\nWith gratitude,\nRavi & Rashmi Hooda\nThe Hooda Team` },
}

const S = {
  app:    { display:'flex', minHeight:'100vh', fontFamily:"'Inter','DM Sans',system-ui,sans-serif", background:'#F5F3EF', fontSize:'14px', color:'#1A1F2E' } as React.CSSProperties,
  sidebar:{ width:220, background:'#1C3557', display:'flex', flexDirection:'column' as const, minHeight:'100vh', position:'sticky' as const, top:0, flexShrink:0 },
  main:   { flex:1, display:'flex', flexDirection:'column' as const, overflow:'hidden', minWidth:0 },
  topbar: { background:'#fff', borderBottom:'1px solid #E2E4E8', padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap' as const, gap:12 },
  content:{ flex:1, padding:24, overflowY:'auto' as const },
  card:   { background:'#fff', borderRadius:10, boxShadow:'0 2px 12px rgba(28,53,87,.08)', overflow:'hidden' },
  btn:    (c='#1C3557',sm=false) => ({ padding:sm?'6px 12px':'9px 18px', background:c, color:'#fff', border:'none', borderRadius:sm?6:8, fontWeight:600, cursor:'pointer', fontSize:sm?12:13, display:'inline-flex', alignItems:'center', gap:6, whiteSpace:'nowrap' as const }) as React.CSSProperties,
  btnOut: (sm=false) => ({ padding:sm?'5px 10px':'8px 16px', background:'#fff', color:'#1A1F2E', border:'1.5px solid #E2E4E8', borderRadius:sm?6:8, fontWeight:600, cursor:'pointer', fontSize:sm?12:13, display:'inline-flex', alignItems:'center', gap:6 }) as React.CSSProperties,
  input:  { width:'100%', padding:'10px 12px', border:'1.5px solid #E2E4E8', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const, background:'#fff' },
  label:  { display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:5, marginTop:12 },
  nav:    (a:boolean) => ({ display:'flex', alignItems:'center', gap:9, padding:'9px 14px', borderRadius:7, color:a?'#fff':'rgba(255,255,255,.65)', background:a?'rgba(168,137,74,.25)':'transparent', cursor:'pointer', fontSize:13, fontWeight:a?600:400, marginBottom:2, border:'none', width:'100%', textAlign:'left' as const, borderLeft:a?'3px solid #D4B97A':'3px solid transparent' }),
  grid2:  { display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 } as React.CSSProperties,
  grid3:  { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 } as React.CSSProperties,
}

const Badge = ({label,color}:{label:string,color?:string}) => (
  <span style={{display:'inline-block',padding:'2px 9px',borderRadius:50,fontSize:11,fontWeight:600,background:color?color+'18':'#EEF4FA',color:color||'#1C3557',whiteSpace:'nowrap'}}>{label}</span>
)

const FormRow = ({label,children,col=1}:{label:string,children:React.ReactNode,col?:number}) => (
  <div style={{gridColumn:`span ${col}`}}>
    <label style={S.label}>{label}</label>
    {children}
  </div>
)

export default function CRMDashboard() {
  const [authed,setAuthed]         = useState(false)
  const [loading,setLoading]       = useState(true)
  const [view,setView]             = useState<View>('dashboard')
  const [loginEmail,setLoginEmail] = useState('')
  const [loginPass,setLoginPass]   = useState('')
  const [loginErr,setLoginErr]     = useState('')
  const [contacts,setContacts]     = useState<Contact[]>([])
  const [total,setTotal]           = useState(0)
  const [page,setPage]             = useState(1)
  const [search,setSearch]         = useState('')
  const [statusF,setStatusF]       = useState('')
  const [catF,setCatF]             = useState('')
  const [tempF,setTempF]           = useState('')
  const [sortF,setSortF]           = useState('created_at')
  const [campaigns,setCampaigns]   = useState<Campaign[]>([])
  const [stats,setStats]           = useState({total:0,hot:0,buyers:0,sellers:0,vow:0,thisMonth:0})
  const [detail,setDetail]         = useState<Contact|null>(null)
  const [detailEdit,setDetailEdit] = useState<Contact|null>(null)
  const [csvFile,setCsvFile]       = useState<File|null>(null)
  const [importRes,setImportRes]   = useState<any>(null)
  const [importing,setImporting]   = useState(false)
  const [compSubj,setCompSubj]     = useState('')
  const [compBody,setCompBody]     = useState('')
  const [compSeg,setCompSeg]       = useState('all')
  const [compImg,setCompImg]           = useState('')
  const [specificRecipients,setSpecificRecipients] = useState('')
  const [recipientSearch,setRecipientSearch]       = useState('')
  const [sending,setSending]       = useState(false)
  const [sendRes,setSendRes]       = useState<any>(null)
  const [toast,setToast]           = useState('')
  const [newContact,setNewContact] = useState<Partial<Contact>>({status:'Lead',category:'Prospect',temperature:'Warm'})
  const [saving,setSaving]         = useState(false)
  const imgRef = useRef<HTMLInputElement>(null)
  const [emailModal, setEmailModal]   = useState(false)
  const [singleSubj, setSingleSubj]   = useState('')
  const [singleBody, setSingleBody]   = useState('')
  const [sendingSingle, setSendingSingle] = useState(false)
  const [newsSubject, setNewsSubject]     = useState('The GTA market is shifting, {{firstName}} — here\'s what you need to know')
  const [newsHtml, setNewsHtml]           = useState('')
  const [newsSeg, setNewsSeg]             = useState('all')
  const [sendingNews, setSendingNews]     = useState(false)
  const [newsResult, setNewsResult]       = useState<any>(null)
  const [newsLoading, setNewsLoading]     = useState(false)
  const [newsPreview, setNewsPreview]     = useState(false)
  const [singleResult, setSingleResult]   = useState('')

  const showToast = (m:string) => { setToast(m); setTimeout(()=>setToast(''),3500) }

  useEffect(()=>{ fetch('/api/admin').then(r=>r.json()).then(d=>{ setAuthed(d.authenticated); setLoading(false) }) },[])

  const sendSingleEmail = async () => {
    if (!detail || !singleSubj || !singleBody) { showToast('Fill in subject and message.'); return }
    setSendingSingle(true); setSingleResult('')
    try {
      const r = await fetch('/api/crm/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: detail.email, toName: detail.name, subject: singleSubj, body: singleBody })
      })
      const d = await r.json()
      if (d.success) {
        setSingleResult('✅ Email sent successfully!')
        showToast('✅ Email sent to ' + detail.name + '!')
        setTimeout(() => { setEmailModal(false); setSingleSubj(''); setSingleBody(''); setSingleResult('') }, 1500)
      } else {
        setSingleResult('❌ ' + (d.error || 'Failed to send'))
      }
    } catch (e: any) {
      setSingleResult('❌ ' + (e.message || 'Network error'))
    }
    setSendingSingle(false)
  }

  const loadNewsletterTemplate = async (file: string) => {
    setNewsLoading(true)
    try {
      const r = await fetch('/' + file)
      const html = await r.text()
      setNewsHtml(html)
      showToast('✅ Template loaded!')
    } catch (e) {
      showToast('❌ Could not load template')
    }
    setNewsLoading(false)
  }

  const sendNewsletter = async () => {
    if (!newsSubject || !newsHtml) { showToast('Please load a template and set a subject.'); return }
    if (!confirm(`Send HTML newsletter to ${newsSeg === 'all' ? 'ALL ' + stats.total : newsSeg} contacts?\n\nThis cannot be undone.`)) return
    setSendingNews(true); setNewsResult(null)
    const r = await fetch('/api/crm/send-newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: newsSubject, html: newsHtml, segment: newsSeg })
    })
    const d = await r.json()
    setNewsResult(d)
    setSendingNews(false)
    if (d.success) { showToast('🎉 Newsletter sent to ' + d.sent + ' contacts!'); loadCampaigns() }
  }

  const doLogin = async()=>{
    setLoginErr('')
    const r = await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:loginEmail,password:loginPass})})
    if(r.ok){ setAuthed(true); loadDash() } else setLoginErr('Invalid email or password.')
  }

  const loadContacts = useCallback(async()=>{
    const p = new URLSearchParams({page:String(page),limit:'20',search,status:statusF,category:catF,temperature:tempF,sort:sortF,dir:'desc'})
    const r = await fetch('/api/crm/contacts?'+p)
    const d = await r.json()
    setContacts(d.contacts||[]); setTotal(d.total||0)
  },[page,search,statusF,catF,tempF,sortF])

  const loadDash = async()=>{
    const r = await fetch('/api/crm/contacts?limit=200')
    const d = await r.json()
    const all:Contact[] = d.contacts||[]
    const now = new Date(); const thisMonth = new Date(now.getFullYear(),now.getMonth(),1)
    setStats({
      total: d.total||0,
      hot: all.filter(c=>c.temperature==='Hot').length,
      buyers: all.filter(c=>c.category==='Buyer').length,
      sellers: all.filter(c=>c.category==='Seller').length,
      vow: all.filter(c=>c.status==='VOW Lead'||c.status==='POS Lead').length,
      thisMonth: all.filter(c=>new Date(c.created_at)>=thisMonth).length,
    })
    const cr = await fetch('/api/crm/campaigns')
    const cd = await cr.json()
    setCampaigns(cd.campaigns||[])
  }

  const loadCampaigns = async()=>{ const r=await fetch('/api/crm/campaigns'); const d=await r.json(); setCampaigns(d.campaigns||[]) }

  useEffect(()=>{ if(authed) loadDash() },[authed])
  useEffect(()=>{ if(authed&&view==='contacts') loadContacts() },[authed,view,page,search,statusF,catF,tempF,sortF,loadContacts])
  useEffect(()=>{ if(authed&&view==='campaigns') loadCampaigns() },[authed,view])

  const saveContact = async()=>{
    setSaving(true)
    if(detailEdit){
      const r=await fetch('/api/crm/contacts',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(detailEdit)})
      const d=await r.json()
      if(d.contact){ setDetail(d.contact); setDetailEdit(null); showToast('✅ Contact saved.'); loadContacts(); loadDash() }
      else showToast('❌ '+d.error)
    }
    setSaving(false)
  }

  const deleteContact = async(id:string)=>{
    if(!confirm('Delete this contact permanently?')) return
    await fetch('/api/crm/contacts',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})})
    setDetail(null); setDetailEdit(null); showToast('Contact deleted.'); loadContacts(); loadDash()
  }

  const addContact = async()=>{
    if(!newContact.name||!newContact.email){ showToast('Name and email required.'); return }
    setSaving(true)
    const r=await fetch('/api/crm/contacts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(newContact)})
    const d=await r.json()
    if(d.contact){ showToast('✅ Contact added!'); setNewContact({status:'Lead',category:'Prospect',temperature:'Warm'}); loadContacts(); loadDash(); setView('contacts') }
    else showToast('❌ '+(d.error||'Failed'))
    setSaving(false)
  }

  const handleImport = async()=>{
    if(!csvFile) return
    setImporting(true); setImportRes(null)

    try {
      const fileName = csvFile.name.toLowerCase()
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')

      let rows: Record<string,string>[] = []

      if (isExcel) {
        // Send to server-side Excel parser
        const formData = new FormData()
        formData.append('file', csvFile)
        const parseRes = await fetch('/api/crm/parse-file', { method: 'POST', body: formData })
        const parsed = await parseRes.json()
        if (!parseRes.ok || parsed.error) {
          setImportRes({ error: parsed.error || 'Failed to parse Excel file' })
          setImporting(false); return
        }
        rows = parsed.rows
        const sheetInfo = parsed.sheets?.length > 1
          ? `${parsed.sheets.length} sheets (${Object.entries(parsed.sheetSummary || {}).map(([s,n])=>`${s}: ${n}`).join(', ')})`
          : parsed.sheets?.[0] || 'Sheet 1'
        showToast(`📊 Parsed ${parsed.total} rows from ${sheetInfo}`)
      } else {
        // Parse CSV client-side
        const text = await csvFile.text()
        const lines = text.trim().split('\n').filter(l=>l.trim())
        const headers = lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g,''))
        rows = lines.slice(1).map(l=>{
          const vals:string[]=[]
          let inQ=false,cur=''
          for(const ch of l){
            if(ch==='"'){ inQ=!inQ }
            else if(ch===','&&!inQ){ vals.push(cur.trim()); cur='' }
            else cur+=ch
          }
          vals.push(cur.trim())
          const obj:Record<string,string>={}
          headers.forEach((h,i)=>{ obj[h]=vals[i]||'' })
          return obj
        })
      }

      // Send parsed rows to import API
      const r = await fetch('/api/crm/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: rows })
      })
      const d = await r.json()
      setImportRes(d)
      if(d.inserted||d.updated){ showToast(`✅ ${d.inserted} added, ${d.updated} updated!`); loadDash() }
    } catch(e: any) {
      setImportRes({ error: e.message || 'Import failed' })
    }
    setImporting(false)
  }

  const sendCampaign = async()=>{
    if(!compSubj||!compBody){ showToast('Fill in subject and body.'); return }
    if(compSeg==='specific'&&!specificRecipients.trim()){ showToast('Please select at least one recipient.'); return }
    setSending(true); setSendRes(null)
    const now=new Date()
    const months=['January','February','March','April','May','June','July','August','September','October','November','December']
    const body=compBody.replace(/\{\{month\}\}/g,months[now.getMonth()]).replace(/\{\{year\}\}/g,String(now.getFullYear()))
    const imageHtml = compImg ? `<div style="margin:16px 0;text-align:center"><img src="${compImg}" style="max-width:100%;border-radius:8px" alt=""/></div>` : ''
    const r=await fetch('/api/crm/campaigns',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subject:compSubj,body,segment:compSeg,specificEmails:compSeg==='specific'?specificRecipients.split(',').map(s=>s.trim()).filter(Boolean):null})})
    const d=await r.json()
    setSendRes(d); setSending(false)
    if(d.success){ showToast(`✅ Sent to ${d.sent} contacts!`); setCompSubj(''); setCompBody(''); setCompImg(''); loadCampaigns() }
  }

  const handleImageUpload = (e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0]
    if(!file) return
    const reader=new FileReader()
    reader.onload=ev=>setCompImg(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  if(loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#1C3557'}}><div style={{color:'#D4B97A',fontFamily:'Georgia,serif',fontSize:'1.2rem'}}>Loading…</div></div>

  if(!authed) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'linear-gradient(135deg,#1C3557,#142844)'}}>
      <div style={{background:'#fff',borderRadius:14,padding:40,maxWidth:400,width:'90%',boxShadow:'0 12px 48px rgba(0,0,0,.2)',borderTop:'3px solid #A8894A'}}>
        <div style={{fontFamily:'Georgia,serif',fontSize:'1.3rem',fontWeight:700,color:'#1A1F2E',marginBottom:4}}>The Hooda Team</div>
        <div style={{fontSize:12,color:'#A8894A',fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',marginBottom:28}}>CRM Dashboard</div>
        <label style={S.label}>Email</label>
        <input style={{...S.input,marginBottom:12}} type="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doLogin()} placeholder="admin@ravihooda.com"/>
        <label style={S.label}>Password</label>
        <input style={{...S.input,marginBottom:16}} type="password" value={loginPass} onChange={e=>setLoginPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doLogin()} placeholder="••••••••"/>
        {loginErr&&<div style={{color:'#dc2626',fontSize:12,marginBottom:12}}>{loginErr}</div>}
        <button style={{...S.btn(),width:'100%',justifyContent:'center'}} onClick={doLogin}>Sign In</button>
      </div>
    </div>
  )

  const navItems:Array<{key:View,label:string,emoji:string}> = [
    {key:'dashboard',label:'Dashboard',emoji:'📊'},
    {key:'contacts', label:`Contacts (${stats.total})`,emoji:'👥'},
    {key:'add',      label:'Add Contact',emoji:'➕'},
    {key:'import',   label:'Import File',emoji:'⬆'},
    {key:'compose',  label:'Email Campaign',emoji:'✉'},
    {key:'campaigns',   label:'Sent Campaigns',emoji:'📨'},
    {key:'newsletter',  label:'HTML Newsletter',emoji:'📰'},
  ]

  return (
    <div style={S.app}>
      {/* SIDEBAR */}
      <div style={S.sidebar}>
        <div style={{padding:'20px 16px 14px',borderBottom:'1px solid rgba(255,255,255,.1)'}}>
          <div style={{fontFamily:'Georgia,serif',fontSize:'1rem',color:'#fff',fontWeight:700}}>Hooda Team</div>
          <div style={{fontSize:11,color:'#D4B97A',marginTop:2,fontWeight:600,letterSpacing:'.05em'}}>CRM</div>
        </div>
        <div style={{padding:'10px',flex:1}}>
          {navItems.map(({key,label,emoji})=>(
            <button key={key} style={S.nav(view===key)} onClick={()=>{setView(key);setPage(1)}}>
              <span>{emoji}</span>{label}
            </button>
          ))}
        </div>
        <div style={{padding:14,borderTop:'1px solid rgba(255,255,255,.1)'}}>
          <div style={{fontSize:11,color:'rgba(255,255,255,.4)',marginBottom:8}}>Ravi & Rashmi Hooda</div>
          <a href="/" style={{...S.btnOut(true),textDecoration:'none',marginBottom:8,justifyContent:'center'}}>🏠 Website</a>
          <button style={{...S.btnOut(true),width:'100%',justifyContent:'center'}} onClick={async()=>{await fetch('/api/admin',{method:'DELETE'});setAuthed(false)}}>Sign Out</button>
        </div>
      </div>

      {/* MAIN */}
      <div style={S.main}>
        <div style={S.topbar}>
          <div style={{fontFamily:'Georgia,serif',fontSize:'1.15rem',fontWeight:700}}>{navItems.find(n=>n.key===view)?.label}</div>
          {view==='contacts'&&(
            <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
              <input style={{...S.input,width:180}} placeholder="Search…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/>
              <select style={{...S.input,width:120}} value={statusF} onChange={e=>{setStatusF(e.target.value);setPage(1)}}>
                <option value="">All Status</option>
                {STATUSES.map(s=><option key={s}>{s}</option>)}
              </select>
              <select style={{...S.input,width:110}} value={catF} onChange={e=>{setCatF(e.target.value);setPage(1)}}>
                <option value="">All Types</option>
                {CATEGORIES.map(c=><option key={c}>{c}</option>)}
              </select>
              <select style={{...S.input,width:100}} value={tempF} onChange={e=>{setTempF(e.target.value);setPage(1)}}>
                <option value="">All Temps</option>
                {TEMPERATURES.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
          )}
        </div>

        <div style={S.content}>

          {/* DASHBOARD */}
          {view==='dashboard'&&(
            <div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:14,marginBottom:22}}>
                {[
                  ['Total Contacts',stats.total,'#1C3557'],
                  ['🔥 Hot Leads',stats.hot,'#dc2626'],
                  ['Buyers',stats.buyers,'#059669'],
                  ['Sellers',stats.sellers,'#7c3aed'],
                  ['Web Signups',stats.vow,'#0891b2'],
                  ['This Month',stats.thisMonth,'#A8894A'],
                ].map(([l,v,c])=>(
                  <div key={String(l)} style={{...S.card,padding:16,borderLeft:`4px solid ${c}`}}>
                    <div style={{fontSize:11,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>{l}</div>
                    <div style={{fontFamily:'Georgia,serif',fontSize:'1.7rem',fontWeight:700,color:'#1A1F2E'}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                <div style={S.card}>
                  <div style={{padding:'12px 18px',borderBottom:'1px solid #E2E4E8',fontWeight:600}}>Quick Actions</div>
                  <div style={{padding:16,display:'flex',flexDirection:'column',gap:8}}>
                    <button style={S.btn('#A8894A')} onClick={()=>setView('add')}>➕ Add Contact</button>
                    <button style={S.btn()} onClick={()=>setView('compose')}>✉ Send Campaign</button>
                    <button style={S.btn('#059669')} onClick={()=>setView('import')}>⬆ Import Excel / CSV</button>
                  </div>
                </div>
                <div style={S.card}>
                  <div style={{padding:'12px 18px',borderBottom:'1px solid #E2E4E8',fontWeight:600}}>Recent Campaigns</div>
                  {campaigns.slice(0,4).map(c=>(
                    <div key={c.id} style={{padding:'10px 16px',borderBottom:'1px solid #F3F4F6'}}>
                      <div style={{fontWeight:500,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.subject}</div>
                      <div style={{fontSize:11,color:'#9CA3AF',marginTop:2}}>{new Date(c.sent_at).toLocaleDateString('en-CA',{month:'short',day:'numeric'})} · {c.recipient_count} sent</div>
                    </div>
                  ))}
                  {!campaigns.length&&<div style={{padding:16,color:'#9CA3AF',fontSize:13}}>No campaigns yet.</div>}
                </div>
              </div>
            </div>
          )}

          {/* ADD CONTACT */}
          {view==='add'&&(
            <div style={{...S.card,padding:28,maxWidth:700}}>
              <h3 style={{fontFamily:'Georgia,serif',color:'#1A1F2E',marginBottom:4}}>Add New Contact</h3>
              <p style={{color:'#6B7280',fontSize:13,marginBottom:20}}>Manually add a client, lead, or prospect to your CRM.</p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                <FormRow label="Full Name *">
                  <input style={S.input} value={newContact.name||''} onChange={e=>setNewContact({...newContact,name:e.target.value})} placeholder="John Smith"/>
                </FormRow>
                <FormRow label="Email Address *">
                  <input style={S.input} type="email" value={newContact.email||''} onChange={e=>setNewContact({...newContact,email:e.target.value})} placeholder="john@email.com"/>
                </FormRow>
                <FormRow label="Phone">
                  <input style={S.input} type="tel" value={newContact.phone||''} onChange={e=>setNewContact({...newContact,phone:e.target.value})} placeholder="647-000-0000"/>
                </FormRow>
                <FormRow label="Address / Neighbourhood">
                  <input style={S.input} value={newContact.address||''} onChange={e=>setNewContact({...newContact,address:e.target.value})} placeholder="123 Main St, Toronto or Vaughan area"/>
                </FormRow>
                <FormRow label="Category (Buyer/Seller/etc.)">
                  <select style={S.input} value={newContact.category||'Prospect'} onChange={e=>setNewContact({...newContact,category:e.target.value})}>
                    {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                  </select>
                </FormRow>
                <FormRow label="Status">
                  <select style={S.input} value={newContact.status||'Lead'} onChange={e=>setNewContact({...newContact,status:e.target.value})}>
                    {STATUSES.map(s=><option key={s}>{s}</option>)}
                  </select>
                </FormRow>
                <FormRow label="Temperature 🔥">
                  <select style={S.input} value={newContact.temperature||'Warm'} onChange={e=>setNewContact({...newContact,temperature:e.target.value})}>
                    {TEMPERATURES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </FormRow>
                <FormRow label="Source">
                  <input style={S.input} value={newContact.source||''} onChange={e=>setNewContact({...newContact,source:e.target.value})} placeholder="Referral, Open House, Instagram…"/>
                </FormRow>
                <FormRow label="Birthday (optional)">
                  <input style={S.input} type="date" value={newContact.birthday||''} onChange={e=>setNewContact({...newContact,birthday:e.target.value})}/>
                </FormRow>
                <FormRow label="Referred By">
                  <input style={S.input} value={newContact.referred_by||''} onChange={e=>setNewContact({...newContact,referred_by:e.target.value})} placeholder="Who referred this person?"/>
                </FormRow>
                <FormRow label="Tags (comma-separated)" col={2}>
                  <input style={S.input} value={newContact.tags||''} onChange={e=>setNewContact({...newContact,tags:e.target.value})} placeholder="first-time-buyer, upsizing, investment, pre-construction…"/>
                </FormRow>
                <FormRow label="Notes" col={2}>
                  <textarea style={{...S.input,minHeight:80,resize:'vertical'}} value={newContact.notes||''} onChange={e=>setNewContact({...newContact,notes:e.target.value})} placeholder="Budget, timeline, specific needs, what they're looking for…"/>
                </FormRow>
              </div>
              <div style={{marginTop:20,display:'flex',gap:10}}>
                <button style={S.btn('#A8894A')} onClick={addContact} disabled={saving}>{saving?'Saving…':'Add Contact'}</button>
                <button style={S.btnOut()} onClick={()=>setView('contacts')}>Cancel</button>
              </div>
            </div>
          )}

          {/* CONTACTS TABLE */}
          {view==='contacts'&&(
            <div style={S.card}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{background:'#F9FAFB'}}>
                      {['Name','Contact','Category','Status','Temp','Source','Added',''].map(h=>(
                        <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:700,color:'#6B7280',letterSpacing:'.06em',textTransform:'uppercase',borderBottom:'1px solid #E2E4E8',whiteSpace:'nowrap'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map(c=>(
                      <tr key={c.id} style={{borderBottom:'1px solid #F3F4F6',cursor:'pointer'}} onClick={()=>{setDetail(c);setDetailEdit({...c})}}>
                        <td style={{padding:'11px 14px',fontWeight:600,whiteSpace:'nowrap'}}>{c.name}{c.tags&&<div style={{fontSize:11,color:'#9CA3AF',marginTop:2}}>{c.tags}</div>}</td>
                        <td style={{padding:'11px 14px',fontSize:12,color:'#6B7280'}}><div>{c.email}</div><div>{c.phone}</div></td>
                        <td style={{padding:'11px 14px'}}><Badge label={c.category||'—'} color={CAT_COLOR[c.category]}/></td>
                        <td style={{padding:'11px 14px'}}><Badge label={c.status}/></td>
                        <td style={{padding:'11px 14px'}}><span style={{fontWeight:700,color:TEMP_COLOR[c.temperature]||'#6B7280',fontSize:13}}>{c.temperature==='Hot'?'🔥':c.temperature==='Warm'?'☀️':'❄️'} {c.temperature}</span></td>
                        <td style={{padding:'11px 14px',fontSize:12,color:'#9CA3AF',whiteSpace:'nowrap'}}>{c.source||'—'}</td>
                        <td style={{padding:'11px 14px',fontSize:12,color:'#9CA3AF',whiteSpace:'nowrap'}}>{new Date(c.created_at).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'2-digit'})}</td>
                        <td style={{padding:'11px 14px'}}><button style={S.btn('#1C3557',true)} onClick={e=>{e.stopPropagation();setDetail(c);setDetailEdit({...c})}}>Edit</button></td>
                      </tr>
                    ))}
                    {!contacts.length&&<tr><td colSpan={8} style={{textAlign:'center',padding:40,color:'#9CA3AF'}}>No contacts found.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div style={{padding:'12px 16px',borderTop:'1px solid #E2E4E8',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>
                <div style={{fontSize:12,color:'#6B7280'}}>Showing {contacts.length} of {total}</div>
                <div style={{display:'flex',gap:4}}>
                  {page>1&&<button style={S.btnOut(true)} onClick={()=>setPage(p=>p-1)}>← Prev</button>}
                  <span style={{padding:'5px 12px',background:'#1C3557',color:'#fff',borderRadius:6,fontSize:12,fontWeight:600}}>{page}</span>
                  {page*20<total&&<button style={S.btnOut(true)} onClick={()=>setPage(p=>p+1)}>Next →</button>}
                </div>
              </div>
            </div>
          )}

          {/* IMPORT */}
          {view==='import'&&(
            <div style={{...S.card,padding:28,maxWidth:700}}>
              <h3 style={{fontFamily:'Georgia,serif',color:'#1A1F2E',marginBottom:6}}>Import Contacts — Excel or CSV</h3>
              <p style={{color:'#6B7280',fontSize:13,marginBottom:6}}>Upload your Excel (.xlsx/.xls) or CSV file. Column names are detected automatically — any order works. Duplicates (same email) are updated, not doubled.</p>
              <div style={{background:'#FFF8E6',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#7A6230',marginBottom:20}}>
                <strong>Supported columns (auto-detected):</strong> Name, Email, Phone, Status, Category, Temperature, Source, Notes, Tags, Address, Birthday, Referred By
              </div>
              <div
                style={{border:'2px dashed #E2E4E8',borderRadius:10,padding:40,textAlign:'center',cursor:'pointer',background:csvFile?'#EEF4FA':'transparent',marginBottom:16}}
                onClick={()=>document.getElementById('csvInput')?.click()}
                onDragOver={e=>e.preventDefault()}
                onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)setCsvFile(f)}}
              >
                <div style={{fontSize:36,marginBottom:8}}>📄</div>
                <div style={{fontWeight:600,marginBottom:4}}>{csvFile?csvFile.name:'Drop your Excel or CSV file here, or click to browse'}</div>
                <div style={{fontSize:12,color:'#9CA3AF',marginBottom:12}}>Supports .xlsx, .xls, .csv — all sheets imported · up to 2,000 contacts</div>
                <button style={S.btnOut()} onClick={e=>{e.stopPropagation();document.getElementById('csvInput')?.click()}}>Choose File</button>
                <input id="csvInput" type="file" accept=".csv,.xlsx,.xls,.txt" style={{display:'none'}} onChange={e=>{if(e.target.files?.[0])setCsvFile(e.target.files[0])}}/>
              </div>
              {csvFile&&<button style={{...S.btn('#059669'),marginBottom:16}} onClick={handleImport} disabled={importing}>{importing?'Importing…':(csvFile?.name?.match(/\.xlsx?$/i)?'Import Excel File':'Import CSV File')}</button>}
              {importRes&&(
                <div style={{background:importRes.inserted||importRes.updated?'#E8F5EE':'#FEF2F2',borderRadius:8,padding:'14px 18px',fontSize:13,border:`1px solid ${importRes.inserted||importRes.updated?'#BBF7D0':'#FECACA'}`}}>
                  {importRes.inserted>0&&<div>✅ <strong>{importRes.inserted}</strong> new contacts added</div>}
                  {importRes.updated>0&&<div>🔄 <strong>{importRes.updated}</strong> existing contacts updated</div>}
                  {importRes.skipped>0&&<div>⏭ <strong>{importRes.skipped}</strong> skipped (no email)</div>}
                  {importRes.crossSheetDuplicates>0&&<div>🔄 <strong>{importRes.crossSheetDuplicates}</strong> cross-sheet duplicates merged</div>}
                  {importRes.failed>0&&<div>❌ <strong>{importRes.failed}</strong> failed</div>}
                  {importRes.error&&<div>❌ {importRes.error}</div>}
                </div>
              )}
            </div>
          )}

          {/* COMPOSE */}
          {view==='compose'&&(
            <div style={{maxWidth:800}}>
              <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
                {Object.keys(TEMPLATES).map(k=>(
                  <button key={k} style={S.btnOut(true)} onClick={()=>{setCompSubj(TEMPLATES[k].subject);setCompBody(TEMPLATES[k].body)}}>{k}</button>
                ))}
              </div>
              <div style={S.card}>
                {[
                  ['From','Ravi & Rashmi Hooda — The Hooda Team',null],
                ].map(([label,val])=>(
                  <div key={String(label)} style={{padding:'11px 18px',borderBottom:'1px solid #E2E4E8',display:'flex',alignItems:'center',gap:12}}>
                    <span style={{fontSize:12,fontWeight:600,color:'#6B7280',width:60,flexShrink:0}}>{label}</span>
                    <span style={{fontSize:13}}>{val}</span>
                  </div>
                ))}
                <div style={{padding:'11px 18px',borderBottom:'1px solid #E2E4E8',display:'flex',alignItems:'flex-start',gap:12}}>
                  <span style={{fontSize:12,fontWeight:600,color:'#6B7280',width:60,flexShrink:0,paddingTop:8}}>To</span>
                  <div style={{flex:1}}>
                    <select style={{...S.input,border:'none',padding:'4px 0',fontSize:13,marginBottom:compSeg==='specific'?8:0}} value={compSeg} onChange={e=>{setCompSeg(e.target.value);if(e.target.value!=='specific')setSpecificRecipients('')}}>
                      <option value="all">All Contacts ({stats.total})</option>
                      <option value="specific">Specific contacts — type emails below</option>
                      {SEGMENTS.slice(1).map(s=><option key={s} value={s}>{s}s</option>)}
                    </select>
                    {compSeg==='specific'&&(
                      <div>
                        <input
                          style={{...S.input,fontSize:13,marginBottom:4}}
                          placeholder="Search by name or email…"
                          value={recipientSearch}
                          onChange={e=>setRecipientSearch(e.target.value)}
                        />
                        {recipientSearch.length>1&&(
                          <div style={{border:'1px solid #E2E4E8',borderRadius:8,maxHeight:160,overflowY:'auto',background:'#fff'}}>
                            {contacts.filter(c=>
                              c.name.toLowerCase().includes(recipientSearch.toLowerCase())||
                              c.email.toLowerCase().includes(recipientSearch.toLowerCase())
                            ).slice(0,10).map(c=>(
                              <div key={c.id}
                                style={{padding:'8px 12px',cursor:'pointer',fontSize:13,display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #F3F4F6'}}
                                onClick={()=>{
                                  setSpecificRecipients(prev=>{
                                    const list = prev ? prev.split(',').map(s=>s.trim()).filter(Boolean) : []
                                    if(!list.includes(c.email)) list.push(c.email)
                                    return list.join(', ')
                                  })
                                  setRecipientSearch('')
                                }}
                              >
                                <span><strong>{c.name}</strong> — {c.email}</span>
                                <span style={{color:'#059669',fontSize:11}}>+ Add</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {specificRecipients&&(
                          <div style={{marginTop:6}}>
                            <div style={{fontSize:11,color:'#6B7280',marginBottom:4}}>Selected recipients:</div>
                            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                              {specificRecipients.split(',').map(e=>e.trim()).filter(Boolean).map(email=>(
                                <span key={email} style={{background:'#EEF4FA',color:'#1C3557',padding:'3px 8px',borderRadius:50,fontSize:12,display:'inline-flex',alignItems:'center',gap:4}}>
                                  {email}
                                  <button style={{background:'none',border:'none',cursor:'pointer',color:'#9CA3AF',fontSize:14,lineHeight:1,padding:0}} onClick={()=>setSpecificRecipients(prev=>prev.split(',').map(s=>s.trim()).filter(s=>s&&s!==email).join(', '))}>×</button>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{padding:'11px 18px',borderBottom:'1px solid #E2E4E8',display:'flex',alignItems:'center',gap:12}}>
                  <span style={{fontSize:12,fontWeight:600,color:'#6B7280',width:60,flexShrink:0}}>Subject</span>
                  <input style={{...S.input,border:'none',padding:0,flex:1,fontSize:13}} placeholder="Enter subject…" value={compSubj} onChange={e=>setCompSubj(e.target.value)}/>
                </div>
                <div style={{padding:'12px 18px 0'}}>
                  <div style={{fontSize:11,color:'#6B7280',marginBottom:6,padding:'8px 12px',background:'#F9FAFB',borderRadius:6,border:'1px solid #E2E4E8',lineHeight:1.7}}>
                  💡 <strong>Auto-fill tokens</strong> — type these anywhere in your email and they'll be replaced with real values when sent:<br/>
                  <code style={{fontSize:12,color:'#1C3557',background:'#EEF4FA',padding:'1px 5px',borderRadius:3}}>{'{{firstName}}'}</code> — contact's first name &nbsp;·&nbsp;
                  <code style={{fontSize:12,color:'#1C3557',background:'#EEF4FA',padding:'1px 5px',borderRadius:3}}>{'{{fullName}}'}</code> — full name &nbsp;·&nbsp;
                  <code style={{fontSize:12,color:'#1C3557',background:'#EEF4FA',padding:'1px 5px',borderRadius:3}}>{'{{month}}'}</code> — current month &nbsp;·&nbsp;
                  <code style={{fontSize:12,color:'#1C3557',background:'#EEF4FA',padding:'1px 5px',borderRadius:3}}>{'{{year}}'}</code> — current year<br/>
                  <span style={{fontSize:11,color:'#9CA3AF'}}>Example: "Dear {'{{firstName}}'}," sends as "Dear Ravi," for each contact</span>
                </div>
                </div>
                <div style={{padding:'8px 18px 18px'}}>
                  <textarea style={{...S.input,minHeight:220,resize:'vertical',lineHeight:1.7}} placeholder={"Write your email here…\n\nHint: Use {{firstName}}, {{fullName}}, {{month}}, {{year}} anywhere in the text to personalise."} value={compBody} onChange={e=>setCompBody(e.target.value)}
                  onPaste={e=>{
                    const items = Array.from(e.clipboardData?.items||[])
                    const imgItem = items.find(i=>i.type.startsWith('image/'))
                    if(imgItem){
                      e.preventDefault()
                      const file = imgItem.getAsFile()
                      if(file){
                        const reader = new FileReader()
                        reader.onload = ev => {
                          const base64 = ev.target?.result as string
                          // Insert image placeholder inline at cursor position
                          const ta = e.target as HTMLTextAreaElement
                          const start = ta.selectionStart
                          const end = ta.selectionEnd
                          const before = compBody.substring(0, start)
                          const after  = compBody.substring(end)
                          const placeholder = `[IMG:${base64}]`
                          setCompBody(before + placeholder + after)
                          showToast('📷 Image inserted at cursor position')
                        }
                        reader.readAsDataURL(file)
                      }
                    }
                  }}/>
                </div>
                {/* Image attachment */}
                <div style={{padding:'12px 18px',borderTop:'1px solid #E2E4E8',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                  <span style={{fontSize:12,fontWeight:600,color:'#6B7280'}}>Add Image:</span>
                  <button style={S.btnOut(true)} onClick={()=>imgRef.current?.click()}>📷 Upload Image</button>
                  <input ref={imgRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleImageUpload}/>
                  {compImg&&(
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <img src={compImg} alt="" style={{height:40,borderRadius:4,border:'1px solid #E2E4E8'}}/>
                      <button style={{background:'none',border:'none',cursor:'pointer',color:'#dc2626',fontSize:18}} onClick={()=>setCompImg('')}>×</button>
                    </div>
                  )}
                </div>
                <div style={{padding:'12px 18px',borderTop:'1px solid #E2E4E8',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
                  <div style={{fontSize:12,color:'#9CA3AF'}}>Unsubscribe link + office address auto-added (CASL compliant) · Use tokens: firstName, fullName, month, year</div>
                  <div style={{display:'flex',gap:8}}>
                    <button style={S.btnOut()} onClick={()=>{
                      const w=window.open('','_blank','width=640,height=700')
                      const imgHtml = compImg ? '<img src="'+compImg+'" style="max-width:100%;margin:12px 0;border-radius:8px"/>' : ''
                      w?.document.write('<html><body style="font-family:Arial;padding:24px;max-width:600px;margin:auto"><h2>'+compSubj+'</h2>'+imgHtml+'<pre style="white-space:pre-wrap;line-height:1.7">'+compBody.replace(/\{\{firstName\}\}/g,'[First Name]').replace(/\{\{fullName\}\}/g,'[Full Name]')+'</pre></body></html>')
                    }}>Preview</button>
                    <button style={S.btn('#A8894A')} onClick={sendCampaign} disabled={sending}>{sending?'Sending…':'Send Campaign ✉'}</button>
                  </div>
                </div>
              </div>
              {sendRes&&<div style={{marginTop:14,background:sendRes.success?'#E8F5EE':'#FEF2F2',borderRadius:8,padding:'12px 16px',fontSize:13}}>{sendRes.success?`✅ Sent to ${sendRes.sent} contacts!${sendRes.failed?` (${sendRes.failed} failed)`:''}`:`❌ ${sendRes.error}`}</div>}
            </div>
          )}

          {/* CAMPAIGNS */}
          {view==='campaigns'&&(
            <div>
              {campaigns.map(c=>(
                <div key={c.id} style={{...S.card,padding:'14px 20px',marginBottom:10,display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
                  <div style={{width:40,height:40,borderRadius:8,background:'#EEF4FA',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>✉</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.subject}</div>
                    <div style={{fontSize:11,color:'#9CA3AF',marginTop:2}}>{new Date(c.sent_at).toLocaleDateString('en-CA',{year:'numeric',month:'short',day:'numeric'})} · Segment: {c.segment==='all'?'All Contacts':c.segment}</div>
                  </div>
                  <div style={{display:'flex',gap:16,textAlign:'center'}}>
                    <div><div style={{fontWeight:700,fontSize:'1rem'}}>{c.recipient_count}</div><div style={{fontSize:11,color:'#9CA3AF'}}>Sent</div></div>
                    {c.failed_count>0&&<div><div style={{fontWeight:700,fontSize:'1rem',color:'#dc2626'}}>{c.failed_count}</div><div style={{fontSize:11,color:'#9CA3AF'}}>Failed</div></div>}
                  </div>
                </div>
              ))}
              {!campaigns.length&&<div style={{...S.card,padding:48,textAlign:'center',color:'#9CA3AF'}}>No campaigns sent yet.</div>}
            </div>
          )}

        </div>
      </div>

      {/* CONTACT DETAIL PANEL */}
      {detail&&detailEdit&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:1000,display:'flex',justifyContent:'flex-end'}} onClick={()=>{setDetail(null);setDetailEdit(null)}}>
          <div style={{width:420,background:'#fff',height:'100vh',overflowY:'auto',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid #E2E4E8',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,background:'#fff',zIndex:1}}>
              <div>
                <div style={{fontFamily:'Georgia,serif',fontSize:'1.05rem',fontWeight:700}}>{detail.name}</div>
                <div style={{fontSize:12,color:'#9CA3AF',marginTop:2}}>{detail.email}</div>
              </div>
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                <button style={S.btn('#dc2626',true)} onClick={()=>deleteContact(detail.id)}>Delete</button>
                <button style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#9CA3AF'}} onClick={()=>{setDetail(null);setDetailEdit(null)}}>×</button>
              </div>
            </div>
            <div style={{padding:20,flex:1,display:'flex',flexDirection:'column',gap:14}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <label style={S.label}>Category</label>
                  <select style={S.input} value={detailEdit.category||'Prospect'} onChange={e=>setDetailEdit({...detailEdit,category:e.target.value})}>
                    {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Status</label>
                  <select style={S.input} value={detailEdit.status} onChange={e=>setDetailEdit({...detailEdit,status:e.target.value})}>
                    {STATUSES.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Temperature 🔥</label>
                  <select style={S.input} value={detailEdit.temperature||'Warm'} onChange={e=>setDetailEdit({...detailEdit,temperature:e.target.value})}>
                    {TEMPERATURES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Phone</label>
                  <input style={S.input} value={detailEdit.phone||''} onChange={e=>setDetailEdit({...detailEdit,phone:e.target.value})}/>
                </div>
              </div>
              <div>
                <label style={S.label}>Address / Area</label>
                <input style={S.input} value={detailEdit.address||''} onChange={e=>setDetailEdit({...detailEdit,address:e.target.value})} placeholder="Property or area of interest"/>
              </div>
              <div>
                <label style={S.label}>Tags</label>
                <input style={S.input} value={detailEdit.tags||''} onChange={e=>setDetailEdit({...detailEdit,tags:e.target.value})} placeholder="first-time-buyer, investment, upsizing…"/>
              </div>
              <div>
                <label style={S.label}>Source</label>
                <input style={S.input} value={detailEdit.source||''} onChange={e=>setDetailEdit({...detailEdit,source:e.target.value})}/>
              </div>
              <div>
                <label style={S.label}>Referred By</label>
                <input style={S.input} value={detailEdit.referred_by||''} onChange={e=>setDetailEdit({...detailEdit,referred_by:e.target.value})}/>
              </div>
              <div>
                <label style={S.label}>Birthday</label>
                <input style={S.input} type="date" value={detailEdit.birthday||''} onChange={e=>setDetailEdit({...detailEdit,birthday:e.target.value})}/>
              </div>
              <div>
                <label style={S.label}>Notes</label>
                <textarea style={{...S.input,minHeight:100,resize:'vertical'}} value={detailEdit.notes||''} onChange={e=>setDetailEdit({...detailEdit,notes:e.target.value})} placeholder="Budget, timeline, specific needs…"/>
              </div>
              <div style={{display:'flex',gap:8,paddingTop:4}}>
                <button style={S.btn('#A8894A')} onClick={saveContact} disabled={saving}>{saving?'Saving…':'Save Changes'}</button>
                <button style={S.btn()} onClick={()=>{setSingleSubj('Following up — '+detail.name.split(' ')[0]);setSingleBody('Hi '+detail.name.split(' ')[0]+',\n\n');setEmailModal(true)}}>✉ Email</button>
                {detail.phone&&<a href={`tel:${detail.phone}`} style={{...S.btn('#059669'),textDecoration:'none'}}>📞 Call</a>}
              {detail.phone&&<button style={S.btn('#25D366')} onClick={()=>window.open('https://wa.me/1'+detail.phone.replace(/\D/g,''),'_blank')}>💬 WhatsApp</button>}
              </div>
              <div style={{fontSize:11,color:'#D1D5DB',marginTop:4}}>
                Added {new Date(detail.created_at).toLocaleDateString('en-CA',{year:'numeric',month:'short',day:'numeric'})}
                {detail.updated_at&&detail.updated_at!==detail.created_at&&` · Updated ${new Date(detail.updated_at).toLocaleDateString('en-CA',{year:'numeric',month:'short',day:'numeric'})}`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {/* SINGLE EMAIL MODAL */}
      {emailModal && detail && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setEmailModal(false)}>
          <div style={{background:'#fff',borderRadius:12,width:'100%',maxWidth:560,boxShadow:'0 20px 60px rgba(0,0,0,.2)',overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
            <div style={{background:'#1C3557',padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{color:'#D4B97A',fontFamily:'Georgia,serif',fontWeight:700}}>Send Email via Resend</div>
                <div style={{color:'rgba(255,255,255,.6)',fontSize:12,marginTop:2}}>To: {detail.name} &lt;{detail.email}&gt;</div>
              </div>
              <button style={{background:'none',border:'none',color:'rgba(255,255,255,.6)',cursor:'pointer',fontSize:20}} onClick={()=>setEmailModal(false)}>×</button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
              <div>
                <label style={S.label}>Subject</label>
                <input style={S.input} value={singleSubj} onChange={e=>setSingleSubj(e.target.value)} placeholder="Enter subject…"/>
              </div>
              <div>
                <label style={S.label}>Message</label>
                <textarea style={{...S.input,minHeight:180,resize:'vertical',lineHeight:1.7}} value={singleBody} onChange={e=>setSingleBody(e.target.value)} placeholder={"Hi {{firstName}},\n\nWrite your message here…"}/>
                <div style={{fontSize:11,color:'#9CA3AF',marginTop:4}}>Use {'{{firstName}}'} and {'{{fullName}}'} for personalisation</div>
              </div>
              {singleResult && <div style={{padding:'10px 14px',borderRadius:8,background:singleResult.startsWith('✅')?'#E8F5EE':'#FEF2F2',fontSize:13}}>{singleResult}</div>}
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                <button style={S.btnOut()} onClick={()=>setEmailModal(false)}>Cancel</button>
                <button style={S.btn('#A8894A')} onClick={sendSingleEmail} disabled={sendingSingle}>
                  {sendingSingle ? 'Sending…' : '✉ Send via Resend'}
                </button>
              </div>
              <div style={{fontSize:11,color:'#9CA3AF',borderTop:'1px solid #E2E4E8',paddingTop:10}}>
                Sends from ravi@ravihooda.com via Resend · Branded email template with unsubscribe link · No Gmail limits
              </div>
            </div>
          </div>
        </div>
      )}

      {toast&&<div style={{position:'fixed',bottom:24,right:24,background:'#1C3557',color:'#fff',padding:'14px 20px',borderRadius:10,boxShadow:'0 8px 32px rgba(0,0,0,.2)',zIndex:9999,fontSize:13,fontWeight:500,borderLeft:'4px solid #A8894A',maxWidth:320,animation:'slideIn .3s ease'}}>{toast}</div>}
    </div>
  )
}
