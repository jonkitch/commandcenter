import { useState, useEffect, useCallback, useRef } from 'react'

// ── Config ────────────────────────────────────────────────────────────────────
// In production (Netlify), calls go to /api/claude (our serverless proxy).
// In local dev with `netlify dev`, same URL works via netlify.toml redirect.
const AI_ENDPOINT = '/api/claude'
const MODEL = 'claude-sonnet-4-20250514'
const TODOIST = 'https://api.todoist.com/rest/v2'

const BUSINESSES = {
  tinting:{ id:'tinting', label:'Auto Spa',       icon:'💧', color:'#0891B2', light:'#E0F2FE', dark:'#0E7490', desc:'Window tinting & auto detailing', persona:'window tinting and auto spa shop' },
  rocket: { id:'rocket',  label:'Rocket Science', icon:'🚀', color:'#7C3AED', light:'#EDE9FE', dark:'#6D28D9', desc:'Liquid nitrogen ice cream', persona:'liquid nitrogen ice cream shop' },
  church: { id:'church',  label:'Bible Way',       icon:'✝',  color:'#B45309', light:'#FEF3C7', dark:'#92400E', desc:'Pastoral ministry', persona:'Apostolic Pentecostal church' },
  lechat: { id:'lechat',  label:'Le Chat Digital', icon:'⬡',  color:'#059669', light:'#D1FAE5', dark:'#047857', desc:'Marketing & AI consulting', persona:'digital marketing and AI consulting' },
}
const BIZ = Object.values(BUSINESSES)
const TODAY = new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})
const getTime = () => new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})
const PRI = { high:{td:4,color:'#DC2626',bg:'#FEF2F2',dot:'#EF4444'}, medium:{td:3,color:'#D97706',bg:'#FFFBEB',dot:'#F59E0B'}, low:{td:2,color:'#059669',bg:'#F0FDF4',dot:'#10B981'} }
const TD_PRI = { 4:'high', 3:'medium', 2:'low', 1:'low' }
const store = { get:(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||'null')??d}catch{return d}}, set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}} }
const toJ = t=>{try{return JSON.parse(t.replace(/```json|```/g,'').trim())}catch{return null}}

// ── API helpers ───────────────────────────────────────────────────────────────
const ai = async (system, user) => {
  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 2000, system, messages: [{ role: 'user', content: user }] }),
  })
  const d = await res.json()
  if (d.error) throw new Error(d.error.message || 'AI error')
  return d.content?.filter(x => x.type === 'text').map(x => x.text).join('\n') || ''
}

const td = async (token, method, path, body) => {
  const res = await fetch(`${TODOIST}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return true
  if (!res.ok) { const t = await res.text(); throw new Error(`Todoist ${res.status}: ${t}`) }
  return res.json()
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
const Spin = ({ c = '#6B7280', s = 14 }) => <span style={{ display:'inline-block', width:s, height:s, border:`2px solid ${c}25`, borderTop:`2px solid ${c}`, borderRadius:'50%', animation:'spin .7s linear infinite', verticalAlign:'middle', marginRight:6 }} />
const Chip = ({ children, color = '#6B7280', dot }) => <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 9px', borderRadius:99, fontSize:11, fontWeight:600, background:color+'18', color, border:`1px solid ${color}25`, whiteSpace:'nowrap' }}>{dot && <span style={{ width:6, height:6, borderRadius:'50%', background:color, display:'inline-block' }} />}{children}</span>
const Btn = ({ children, onClick, v='ghost', color, disabled, full, sm, style={} }) => {
  const base = { display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, padding:sm?'6px 12px':'9px 18px', borderRadius:9, fontSize:sm?12:13, fontWeight:600, cursor:disabled?'not-allowed':'pointer', border:'none', fontFamily:'inherit', opacity:disabled?.5:1, transition:'all .15s', whiteSpace:'nowrap', width:full?'100%':'auto', ...style }
  if (v === 'solid' && color) return <button style={{ ...base, background:color, color:'#fff', boxShadow:`0 1px 4px ${color}35` }} onClick={onClick} disabled={disabled}>{children}</button>
  if (v === 'ghost' && color) return <button style={{ ...base, background:color+'14', color, border:`1px solid ${color}22` }} onClick={onClick} disabled={disabled}>{children}</button>
  return <button style={{ ...base, background:'#F3F4F6', color:'#374151', border:'1px solid #E5E7EB' }} onClick={onClick} disabled={disabled}>{children}</button>
}
const Card = ({ children, style = {} }) => <div style={{ background:'#fff', borderRadius:14, border:'1px solid #E5E7EB', boxShadow:'0 1px 4px rgba(0,0,0,.05)', overflow:'hidden', ...style }}>{children}</div>
const CH = ({ title, right, color }) => <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'13px 18px', borderBottom:'1px solid #F3F4F6', background:color?color+'08':'#FAFAFA' }}><span style={{ fontSize:11, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:color||'#9CA3AF' }}>{title}</span>{right}</div>
const TA = ({ value, onChange, placeholder, rows = 4 }) => <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ width:'100%', padding:'11px 13px', border:'1.5px solid #E5E7EB', borderRadius:10, fontSize:13, color:'#111827', background:'#FAFAFA', resize:'vertical', outline:'none', fontFamily:'inherit', lineHeight:1.6, boxSizing:'border-box' }} onFocus={e=>e.target.style.borderColor='#9CA3AF'} onBlur={e=>e.target.style.borderColor='#E5E7EB'} />
const TI = ({ value, onChange, placeholder, onKeyDown }) => <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} onKeyDown={onKeyDown} style={{ width:'100%', padding:'10px 13px', border:'1.5px solid #E5E7EB', borderRadius:10, fontSize:13, color:'#111827', background:'#FAFAFA', outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} onFocus={e=>e.target.style.borderColor='#9CA3AF'} onBlur={e=>e.target.style.borderColor='#E5E7EB'} />
const Empty = ({ icon, text }) => <div style={{ textAlign:'center', padding:'40px 24px', color:'#9CA3AF' }}><div style={{ fontSize:34, marginBottom:10 }}>{icon}</div><div style={{ fontSize:13, lineHeight:1.5 }}>{text}</div></div>

// ── Todoist Hook ──────────────────────────────────────────────────────────────
const useTodoist = (token, projectMap) => {
  const [tasks, setTasks] = useState({})
  const [syncing, setSyncing] = useState({})

  const fetchTasks = useCallback(async (bizId) => {
    if (!token) return
    const pid = projectMap?.[bizId]
    if (!pid) return
    setSyncing(s => ({ ...s, [bizId]: true }))
    try {
      const raw = await td(token, 'GET', `/tasks?project_id=${pid}`)
      setTasks(t => ({ ...t, [bizId]: raw }))
    } catch (e) { console.error('Todoist fetch:', e) }
    setSyncing(s => ({ ...s, [bizId]: false }))
  }, [token, projectMap])

  const addTask = useCallback(async (bizId, { task, details, priority = 'medium', quantity, client, dueHint }) => {
    if (!token) return null
    const pid = projectMap?.[bizId]
    const content = quantity ? `×${quantity} ${task}` : task
    const desc = [details, client && client !== 'Internal' ? `Client: ${client}` : '', dueHint ? `Due: ${dueHint}` : ''].filter(Boolean).join('\n')
    const body = { content, description: desc || undefined, priority: PRI[priority]?.td || 2 }
    if (pid) body.project_id = pid
    const created = await td(token, 'POST', '/tasks', body)
    setTasks(t => ({ ...t, [bizId]: [created, ...(t[bizId] || [])] }))
    return created
  }, [token, projectMap])

  const completeTask = useCallback(async (bizId, taskId) => {
    if (!token) return
    await td(token, 'POST', `/tasks/${taskId}/close`)
    setTasks(t => ({ ...t, [bizId]: (t[bizId] || []).filter(x => x.id !== taskId) }))
  }, [token])

  const deleteTask = useCallback(async (bizId, taskId) => {
    if (!token) return
    await td(token, 'DELETE', `/tasks/${taskId}`)
    setTasks(t => ({ ...t, [bizId]: (t[bizId] || []).filter(x => x.id !== taskId) }))
  }, [token])

  return { tasks, syncing, fetchTasks, addTask, completeTask, deleteTask }
}

// ── Setup Drawer ──────────────────────────────────────────────────────────────
const SetupDrawer = ({ settings, onSave, onClose }) => {
  const [token, setToken] = useState(settings.token || '')
  const [map, setMap] = useState(settings.projectMap || {})
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const fetchProjects = async () => {
    if (!token.trim()) return
    setLoading(true); setErr('')
    try { setProjects(await td(token, 'GET', '/projects')) }
    catch { setErr('Could not connect — double-check your token.') }
    setLoading(false)
  }
  useEffect(() => { if (token && token === settings.token) fetchProjects() }, [])

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:200 }}>
      <div style={{ background:'#fff', borderRadius:'20px 20px 0 0', padding:28, width:'100%', maxWidth:540, maxHeight:'85vh', overflowY:'auto', boxShadow:'0 -8px 40px rgba(0,0,0,.15)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:'#111827' }}>⚙ Todoist Setup</div>
            <div style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>Connect your Todoist to sync tasks live</div>
          </div>
          <button onClick={onClose} style={{ background:'#F3F4F6', border:'none', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:13, color:'#6B7280', fontFamily:'inherit' }}>✕</button>
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:11, fontWeight:700, color:'#374151', display:'block', marginBottom:6 }}>TODOIST API TOKEN</label>
          <div style={{ display:'flex', gap:8 }}>
            <TI value={token} onChange={setToken} placeholder="Paste your Todoist API token…" />
            <Btn onClick={fetchProjects} v="solid" color="#DC4C3E" disabled={loading || !token.trim()} sm>{loading ? <Spin c="#fff" /> : 'Connect'}</Btn>
          </div>
          <div style={{ fontSize:11, color:'#9CA3AF', marginTop:5 }}>todoist.com → Settings → Integrations → Developer → API token</div>
          {err && <div style={{ marginTop:6, fontSize:12, color:'#DC2626', background:'#FEF2F2', padding:'6px 10px', borderRadius:6 }}>{err}</div>}
        </div>
        {projects.length > 0 && (
          <div>
            <label style={{ fontSize:11, fontWeight:700, color:'#374151', display:'block', marginBottom:10 }}>MAP PROJECTS TO BUSINESSES</label>
            {BIZ.map(b => (
              <div key={b.id} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10, padding:'10px 14px', background:b.light, borderRadius:10, border:`1px solid ${b.color}22` }}>
                <div style={{ width:32, height:32, borderRadius:8, background:b.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{b.icon}</div>
                <div style={{ fontSize:13, fontWeight:600, color:b.dark, minWidth:120 }}>{b.label}</div>
                <select value={map[b.id] || ''} onChange={e => setMap(m => ({ ...m, [b.id]: e.target.value }))} style={{ flex:1, padding:'7px 10px', border:'1.5px solid #E5E7EB', borderRadius:8, fontSize:13, color:'#111827', background:'#fff', fontFamily:'inherit', outline:'none' }}>
                  <option value="">— No project —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
        <div style={{ display:'flex', gap:10, marginTop:20 }}>
          <Btn onClick={() => { onSave({ token, projectMap: map }); onClose() }} v="solid" color="#111827" full disabled={!token}>Save Settings</Btn>
          <Btn onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </div>
  )
}

// ── Focus Timer ───────────────────────────────────────────────────────────────
const FocusTimer = ({ onClose }) => {
  const M = { work:25*60, break:5*60, long:15*60 }
  const [mode, setMode] = useState('work')
  const [secs, setSecs] = useState(M.work)
  const [on, setOn] = useState(false)
  const [cycles, setCycles] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    if (on) { ref.current = setInterval(() => setSecs(s => { if (s <= 1) { clearInterval(ref.current); setOn(false); if (mode === 'work') setCycles(c => c+1); return 0 } return s-1 }), 1000) }
    else clearInterval(ref.current)
    return () => clearInterval(ref.current)
  }, [on, mode])
  const sw = m => { setMode(m); setSecs(M[m]); setOn(false) }
  const mm = String(Math.floor(secs/60)).padStart(2,'0'), ss = String(secs%60).padStart(2,'0')
  const r = 52, circ = 2*Math.PI*r, pct = 1-secs/M[mode]
  const mc = { work:'#7C3AED', break:'#059669', long:'#0891B2' }[mode]
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}>
      <div style={{ background:'#fff', borderRadius:20, padding:32, width:310, boxShadow:'0 20px 60px rgba(0,0,0,.15)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
          <span style={{ fontSize:16, fontWeight:800, color:'#111827' }}>⏱ Focus Timer</span>
          <button onClick={onClose} style={{ background:'#F3F4F6', border:'none', borderRadius:8, padding:'5px 10px', cursor:'pointer', fontSize:12, color:'#6B7280', fontFamily:'inherit' }}>✕ Close</button>
        </div>
        <div style={{ display:'flex', gap:4, marginBottom:26, background:'#F3F4F6', padding:4, borderRadius:10 }}>
          {[['work','Focus',mc],['break','Short','#059669'],['long','Long','#0891B2']].map(([m,l,c]) => (
            <button key={m} onClick={() => sw(m)} style={{ flex:1, padding:'7px 4px', fontSize:12, fontWeight:600, border:'none', borderRadius:7, cursor:'pointer', fontFamily:'inherit', background:mode===m?'#fff':'transparent', color:mode===m?c:'#6B7280', boxShadow:mode===m?'0 1px 3px rgba(0,0,0,.1)':'none', transition:'all .15s' }}>{l}</button>
          ))}
        </div>
        <div style={{ display:'flex', justifyContent:'center', marginBottom:18 }}>
          <svg width={124} height={124}>
            <circle cx={62} cy={62} r={r} fill="none" stroke="#F3F4F6" strokeWidth={6} />
            <circle cx={62} cy={62} r={r} fill="none" stroke={mc} strokeWidth={6} strokeDasharray={circ} strokeDashoffset={circ*(1-pct)} strokeLinecap="round" transform="rotate(-90 62 62)" style={{ transition:'stroke-dashoffset .5s,stroke .3s' }} />
            <text x={62} y={56} textAnchor="middle" fill="#111827" style={{ fontSize:26, fontWeight:700, fontFamily:'inherit' }}>{mm}:{ss}</text>
            <text x={62} y={74} textAnchor="middle" fill="#9CA3AF" style={{ fontSize:11, fontFamily:'inherit' }}>{cycles} done</text>
          </svg>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setOn(o => !o)} style={{ flex:1, padding:11, background:mc, color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'background .3s' }}>{on ? '⏸ Pause' : '▶ Start'}</button>
          <button onClick={() => { setSecs(M[mode]); setOn(false) }} style={{ padding:'11px 14px', background:'#F3F4F6', border:'none', borderRadius:10, fontSize:16, cursor:'pointer', fontFamily:'inherit' }}>↺</button>
        </div>
      </div>
    </div>
  )
}

// ── Brain Dump ────────────────────────────────────────────────────────────────
const BrainDump = ({ onClose, onAdd }) => {
  const [text, setText] = useState('')
  const [biz, setBiz] = useState('lechat')
  const [loading, setLoading] = useState(false)
  const go = async () => {
    if (!text.trim()) return
    setLoading(true)
    try {
      const raw = await ai(`Parse brain dump into tasks. Return ONLY JSON: {"tasks":[{"task":"...","priority":"high|medium|low","category":"...","details":"..."}]}`, `For ${BUSINESSES[biz].label}:\n${text}`)
      const p = toJ(raw)
      onAdd((p?.tasks || [{ task:text, priority:'medium', category:'general', details:'' }]).map(t => ({ ...t, biz, client:'Internal' })))
    } catch { onAdd([{ task:text, priority:'medium', category:'general', details:'', biz, client:'Internal' }]) }
    setLoading(false); onClose()
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}>
      <div style={{ background:'#fff', borderRadius:20, padding:28, width:460, boxShadow:'0 20px 60px rgba(0,0,0,.15)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
          <div><div style={{ fontSize:17, fontWeight:800, color:'#111827' }}>🧠 Brain Dump</div><div style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>Get it out — AI will sort it into tasks</div></div>
          <button onClick={onClose} style={{ background:'#F3F4F6', border:'none', borderRadius:8, padding:'5px 10px', cursor:'pointer', fontSize:12, color:'#6B7280', fontFamily:'inherit' }}>✕</button>
        </div>
        <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
          {BIZ.map(b => <button key={b.id} onClick={() => setBiz(b.id)} style={{ padding:'6px 14px', fontSize:13, fontWeight:600, border:`1.5px solid ${biz===b.id?b.color:'#E5E7EB'}`, borderRadius:8, cursor:'pointer', background:biz===b.id?b.light:'#fff', color:biz===b.id?b.dark:'#6B7280', fontFamily:'inherit', transition:'all .15s' }}>{b.icon} {b.label}</button>)}
        </div>
        <TA value={text} onChange={setText} placeholder="Type everything on your mind — AI will organize it…" rows={5} />
        <div style={{ display:'flex', gap:8, marginTop:14 }}>
          <Btn onClick={go} v="solid" color={BUSINESSES[biz].color} disabled={loading || !text.trim()} full>{loading && <Spin c="#fff" />}{loading ? 'Organizing…' : '→ Parse into Tasks'}</Btn>
          <Btn onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </div>
  )
}

// ── Debrief Tab ───────────────────────────────────────────────────────────────
const DebriefTab = ({ todoistTasks }) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [focus, setFocus] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    setLoading(true); setData(null); setError('')
    const ctx = BIZ.map(b => {
      const ts = (todoistTasks[b.id] || []).slice(0,4).map(t => `- [${TD_PRI[t.priority]||'med'}] ${t.content}`).join('\n') || 'Clear'
      return `${b.label}:\n${ts}`
    }).join('\n\n')
    try {
      const raw = await ai(
        `Personal assistant for Jonathan — pastor, ice cream co-owner, auto spa operator, marketing consultant, ADHD. Today: ${TODAY}. Return ONLY valid JSON: {"greeting":"short warm phrase","oneThingToday":"THE most important task today","focusBlock":"best 90min window","adhdNow":"one tiny action under 2 min to start","alerts":[{"type":"urgent|reminder|opportunity","text":"..."}],"businesses":[{"id":"tinting|rocket|church|lechat","topTask":"#1 goal","events":[],"email":null,"energy":"low|medium|high"}],"week":[{"day":"Mon","date":"Mar 23","load":"light|medium|heavy","note":"..."}]}

Note: Google Calendar and Gmail integration requires additional setup in the deployed version. Base your debrief on the Todoist task data provided and today's date.`,
        `Run morning debrief. Today's Todoist tasks:\n${ctx}`
      )
      setData(toJ(raw) || { _raw: raw })
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  if (focus && data?.oneThingToday) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'62vh', textAlign:'center', padding:40, animation:'fadeUp .3s ease' }}>
      <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:'#9CA3AF', marginBottom:18 }}>RIGHT NOW — YOUR ONE THING</div>
      <div style={{ fontSize:28, fontWeight:800, color:'#111827', maxWidth:500, lineHeight:1.35, marginBottom:22 }}>{data.oneThingToday}</div>
      {data.adhdNow && <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:12, padding:'13px 22px', fontSize:14, color:'#1D4ED8', lineHeight:1.6, maxWidth:420, marginBottom:26 }}>⚡ <strong>Do this first:</strong> {data.adhdNow}</div>}
      <Btn onClick={() => setFocus(false)} v="ghost" color="#6B7280">← Back to Full View</Btn>
    </div>
  )

  return (
    <div style={{ animation:'fadeUp .35s ease' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div style={{ fontSize:13, color:'#6B7280' }}>Powered by AI + your Todoist tasks</div>
        <div style={{ display:'flex', gap:10 }}>
          {data && !data._raw && <Btn onClick={() => setFocus(true)} v="ghost" color="#7C3AED">⊙ Focus Mode</Btn>}
          <Btn onClick={run} v="solid" color="#111827" disabled={loading}>{loading && <Spin c="#fff" />}{loading ? 'Pulling your day…' : '▶ Run Morning Debrief'}</Btn>
        </div>
      </div>
      {error && <div style={{ marginBottom:16, padding:'12px 16px', background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, fontSize:13, color:'#DC2626' }}>⚠ {error}</div>}
      {!data && !loading && <Empty icon="☀️" text="Click Run Morning Debrief to get your cross-business daily plan" />}
      {data?._raw && <Card><div style={{ padding:16, fontSize:13, color:'#6B7280', whiteSpace:'pre-wrap', lineHeight:1.6 }}>{data._raw}</div></Card>}
      {data && !data._raw && (
        <div style={{ animation:'fadeUp .3s ease' }}>
          <div style={{ background:'linear-gradient(135deg,#1E1B4B 0%,#3730A3 100%)', borderRadius:16, padding:'22px 28px', marginBottom:16, color:'#fff', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', right:-10, top:-10, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,.04)' }} />
            {data.greeting && <div style={{ fontSize:13, color:'#A5B4FC', marginBottom:8, fontStyle:'italic' }}>"{data.greeting}"</div>}
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:'#818CF8', marginBottom:6 }}>Today's One Thing</div>
            <div style={{ fontSize:22, fontWeight:800, lineHeight:1.35, marginBottom:14, maxWidth:560 }}>{data.oneThingToday}</div>
            {data.adhdNow && <div style={{ background:'rgba(255,255,255,.1)', borderRadius:10, padding:'10px 16px', fontSize:13, display:'inline-flex', gap:8, alignItems:'flex-start', maxWidth:500, lineHeight:1.5 }}><span>⚡</span><span><strong>Do this now:</strong> {data.adhdNow}</span></div>}
            {data.focusBlock && <div style={{ marginTop:12, fontSize:12, color:'#A5B4FC' }}>📅 Best focus window: {data.focusBlock}</div>}
          </div>
          {data.alerts?.length > 0 && (
            <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
              {data.alerts.map((a, i) => {
                const cfg = { urgent:{bg:'#FEF2F2',border:'#FECACA',text:'#B91C1C',icon:'🔴'}, opportunity:{bg:'#F0FDF4',border:'#BBF7D0',text:'#166534',icon:'🟢'}, reminder:{bg:'#FFFBEB',border:'#FDE68A',text:'#92400E',icon:'🟡'} }[a.type] || {bg:'#F9FAFB',border:'#E5E7EB',text:'#374151',icon:'ℹ'}
                return <div key={i} style={{ flex:1, minWidth:180, background:cfg.bg, border:`1px solid ${cfg.border}`, borderRadius:10, padding:'10px 14px', fontSize:13, color:cfg.text, lineHeight:1.5 }}><strong>{cfg.icon} {a.type?.toUpperCase()}</strong> — {a.text}</div>
              })}
            </div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
            {data.businesses?.map(b => {
              const bz = BUSINESSES[b.id] || BUSINESSES.lechat
              const ec = { high:'#DC2626', medium:'#D97706', low:'#059669' }[b.energy] || '#6B7280'
              return (
                <Card key={b.id}>
                  <div style={{ padding:'13px 16px', borderBottom:'1px solid #F3F4F6', display:'flex', alignItems:'center', justifyContent:'space-between', background:bz.light }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:34, height:34, borderRadius:9, background:bz.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>{bz.icon}</div>
                      <div><div style={{ fontSize:13, fontWeight:700, color:bz.dark }}>{bz.label}</div><div style={{ fontSize:11, color:'#6B7280' }}>{bz.desc}</div></div>
                    </div>
                    <Chip color={ec}>{b.energy}</Chip>
                  </div>
                  <div style={{ padding:'12px 16px' }}>
                    <div style={{ fontSize:14, color:'#111827', fontWeight:600, marginBottom:8, lineHeight:1.4 }}>{b.topTask}</div>
                    {b.events?.filter(Boolean).map((ev, i) => <div key={i} style={{ fontSize:12, color:'#6B7280', marginBottom:3, display:'flex', gap:5 }}><span>📅</span><span>{ev}</span></div>)}
                    {b.email && <div style={{ marginTop:5, fontSize:12, color:bz.dark, display:'flex', gap:5 }}><span>✉</span><span>{b.email}</span></div>}
                  </div>
                </Card>
              )
            })}
          </div>
          {data.week?.length > 0 && (
            <Card>
              <CH title="Week Ahead" />
              <div style={{ display:'grid', gridTemplateColumns:`repeat(${data.week.length},1fr)` }}>
                {data.week.map((d, i) => {
                  const lc = { light:'#F0FDF4', medium:'#FFFBEB', heavy:'#FEF2F2' }[d.load] || '#fff'
                  const dot = { light:'#10B981', medium:'#F59E0B', heavy:'#EF4444' }[d.load] || '#9CA3AF'
                  return <div key={i} style={{ padding:'13px 10px', borderRight:i<data.week.length-1?'1px solid #F3F4F6':'none', background:lc, textAlign:'center' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:2 }}>{d.day}</div>
                    <div style={{ fontSize:10, color:'#9CA3AF', marginBottom:6 }}>{d.date}</div>
                    <div style={{ width:7, height:7, borderRadius:'50%', background:dot, margin:'0 auto 5px' }} />
                    <div style={{ fontSize:10, color:'#6B7280', lineHeight:1.4 }}>{d.note}</div>
                  </div>
                })}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

// ── Business Tab ──────────────────────────────────────────────────────────────
const BizTab = ({ biz, todoist, token, projectMap }) => {
  const { tasks: allTasks, syncing, fetchTasks, addTask, completeTask, deleteTask } = todoist
  const [input, setInput] = useState(''); const [loading, setLoading] = useState(false); const [preview, setPreview] = useState(null)
  const [ask, setAsk] = useState(''); const [askLoad, setAskLoad] = useState(false); const [answer, setAnswer] = useState('')
  const hasTodoist = !!(token && projectMap?.[biz.id])
  const tasks = allTasks[biz.id] || []
  useEffect(() => { if (hasTodoist) fetchTasks(biz.id) }, [biz.id, hasTodoist])

  const parse = async () => {
    if (!input.trim()) return; setLoading(true); setPreview(null)
    try {
      const raw = await ai(`Task parser for ${biz.label}. Return ONLY JSON: {"client":"...","summary":"...","tasks":[{"task":"...","quantity":null,"details":"...","category":"...","priority":"high|medium|low","dueHint":null}]}`, `Parse for ${biz.label}:\n${input}`)
      setPreview(toJ(raw))
    } catch {}
    setLoading(false)
  }
  const addAll = async () => {
    if (!preview?.tasks) return
    for (const t of preview.tasks) await addTask(biz.id, { ...t, client: preview.client })
    setPreview(null); setInput('')
  }
  const doAsk = async () => {
    if (!ask.trim()) return; setAskLoad(true); setAnswer('')
    try { setAnswer(await ai(`Expert for ${biz.label} (${biz.persona}). Answer concisely.`, ask)) } catch { setAnswer('Error connecting to AI.') }
    setAskLoad(false)
  }

  return (
    <div style={{ animation:'fadeUp .3s ease' }}>
      <div style={{ background:`linear-gradient(135deg,${biz.light} 0%,#fff 100%)`, border:`1.5px solid ${biz.color}28`, borderRadius:16, padding:'18px 24px', marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:50, height:50, borderRadius:14, background:biz.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, boxShadow:`0 4px 12px ${biz.color}35` }}>{biz.icon}</div>
          <div>
            <div style={{ fontSize:19, fontWeight:800, color:biz.dark }}>{biz.label}</div>
            <div style={{ fontSize:12, color:'#6B7280', marginTop:1 }}>{biz.desc}</div>
            {!hasTodoist && <div style={{ fontSize:11, color:'#D97706', marginTop:3 }}>⚠ Connect Todoist in settings to sync tasks</div>}
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:30, fontWeight:800, color:biz.color }}>{tasks.length}</div>
          <div style={{ fontSize:10, color:'#9CA3AF', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em' }}>Open Tasks</div>
          {hasTodoist && <Btn onClick={() => fetchTasks(biz.id)} sm v="ghost" color={biz.color} style={{ marginTop:4 }}>{syncing[biz.id] ? <Spin c={biz.color} s={11} /> : '↻'} Sync</Btn>}
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1.1fr 1fr', gap:16 }}>
        <Card>
          <CH title={hasTodoist ? 'Todoist Tasks' : 'Tasks'} color={biz.color} right={hasTodoist && <a href="https://todoist.com/app" target="_blank" rel="noreferrer" style={{ fontSize:11, color:biz.color, textDecoration:'none', fontWeight:600 }}>Open in Todoist →</a>} />
          <div style={{ padding:'6px 0', maxHeight:420, overflowY:'auto' }}>
            {syncing[biz.id] && <div style={{ padding:20, textAlign:'center', color:'#9CA3AF', fontSize:13 }}><Spin />Syncing…</div>}
            {!syncing[biz.id] && tasks.length === 0 && <Empty icon="✅" text={hasTodoist ? 'All clear!' : 'No tasks yet'} />}
            {tasks.map((t, i) => {
              const pri = TD_PRI[t.priority] || 'medium'; const p = PRI[pri] || PRI.medium
              return <div key={t.id} style={{ padding:'11px 18px', borderBottom:i<tasks.length-1?'1px solid #F9FAFB':'none', display:'flex', gap:10, alignItems:'flex-start' }}>
                <button onClick={() => completeTask(biz.id, t.id)} style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${p.dot}`, background:'transparent', cursor:'pointer', flexShrink:0, marginTop:2 }} title="Complete" />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color:'#111827', fontWeight:500, lineHeight:1.4 }}>{t.content}</div>
                  {t.description && <div style={{ fontSize:11, color:'#6B7280', marginTop:2, lineHeight:1.4 }}>{t.description}</div>}
                  {t.due && <div style={{ fontSize:11, color:'#D97706', marginTop:3 }}>⏱ {t.due.string || t.due.date}</div>}
                </div>
                <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                  <Chip color={p.color} dot>{pri}</Chip>
                  <button onClick={() => deleteTask(biz.id, t.id)} style={{ background:'none', border:'none', color:'#D1D5DB', cursor:'pointer', fontSize:13, padding:'0 2px' }}>✕</button>
                </div>
              </div>
            })}
          </div>
        </Card>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <Card>
            <CH title="Parse Client Request" color={biz.color} />
            <div style={{ padding:16 }}>
              <TA value={input} onChange={setInput} rows={4} placeholder={`Paste any client message for ${biz.label}…`} />
              <div style={{ display:'flex', gap:8, marginTop:10 }}>
                <Btn onClick={parse} v="solid" color={biz.color} disabled={loading || !input.trim()} full>{loading && <Spin c="#fff" />}{loading ? 'Parsing…' : '⊕ Parse'}</Btn>
                {input && <Btn onClick={() => { setInput(''); setPreview(null) }}>Clear</Btn>}
              </div>
              {preview && (
                <div style={{ marginTop:14, animation:'fadeUp .25s ease' }}>
                  <div style={{ fontSize:12, color:biz.dark, fontWeight:600, marginBottom:10, padding:'8px 12px', background:biz.light, borderRadius:8 }}>{preview.client} — {preview.summary}</div>
                  {preview.tasks?.map((t, i) => (
                    <div key={i} style={{ background:'#F9FAFB', border:'1px solid #F3F4F6', borderRadius:8, padding:'10px 12px', marginBottom:6 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                        <div style={{ fontSize:13, color:'#111827', fontWeight:500 }}>{t.quantity && <span style={{ color:biz.color, fontWeight:700 }}>×{t.quantity} </span>}{t.task}</div>
                        <Chip color={PRI[t.priority]?.color || '#6B7280'}>{t.priority}</Chip>
                      </div>
                      {t.details && <div style={{ fontSize:11, color:'#6B7280', marginTop:3 }}>{t.details}</div>}
                      {t.dueHint && <div style={{ fontSize:11, color:biz.color, marginTop:2 }}>⏱ {t.dueHint}</div>}
                    </div>
                  ))}
                  <Btn onClick={addAll} v="solid" color={biz.color} full style={{ marginTop:4 }}>
                    {hasTodoist ? `→ Push ${preview.tasks?.length} Task${preview.tasks?.length !== 1 ? 's' : ''} to Todoist` : `✓ Save ${preview.tasks?.length} Task${preview.tasks?.length !== 1 ? 's' : ''}`}
                  </Btn>
                </div>
              )}
            </div>
          </Card>
          <Card>
            <CH title={`Ask AI — ${biz.label}`} color={biz.color} />
            <div style={{ padding:16 }}>
              <TA value={ask} onChange={setAsk} rows={2} placeholder={`Ask anything about ${biz.label}…`} />
              <Btn onClick={doAsk} v="ghost" color={biz.color} disabled={askLoad || !ask.trim()} style={{ marginTop:10 }}>{askLoad && <Spin c={biz.color} />}{askLoad ? 'Thinking…' : '→ Ask'}</Btn>
              {answer && <div style={{ marginTop:12, fontSize:13, color:'#374151', lineHeight:1.7, padding:'12px 14px', background:'#F9FAFB', borderRadius:8, border:'1px solid #F3F4F6', whiteSpace:'pre-wrap', animation:'fadeUp .25s ease' }}>{answer}</div>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ── Todos Tab ─────────────────────────────────────────────────────────────────
const TodosTab = ({ todoist, token }) => {
  const { tasks: allTasks, syncing, fetchTasks, completeTask, deleteTask, addTask } = todoist
  const [bizF, setBizF] = useState('all'); const [priF, setPriF] = useState('all')
  const [newTask, setNewTask] = useState(''); const [newBiz, setNewBiz] = useState('lechat'); const [newPri, setNewPri] = useState('medium'); const [adding, setAdding] = useState(false)

  useEffect(() => { if (token) BIZ.forEach(b => fetchTasks(b.id)) }, [token])

  const flat = BIZ.flatMap(b => (allTasks[b.id] || []).map(t => ({ ...t, bizId: b.id })))
  const filtered = flat.filter(t => (bizF === 'all' || t.bizId === bizF) && (priF === 'all' || (TD_PRI[t.priority] || 'medium') === priF)).sort((a, b) => b.priority - a.priority)

  const quickAdd = async () => {
    if (!newTask.trim()) return; setAdding(true)
    await addTask(newBiz, { task: newTask, priority: newPri, client: 'Internal' })
    setNewTask(''); setAdding(false)
  }

  return (
    <div style={{ animation:'fadeUp .3s ease' }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {BIZ.map(b => {
          const c = (allTasks[b.id] || []).length
          return <div key={b.id} onClick={() => setBizF(bizF === b.id ? 'all' : b.id)} style={{ background:bizF===b.id?b.light:'#fff', border:`1.5px solid ${bizF===b.id?b.color:'#E5E7EB'}`, borderRadius:12, padding:'14px 16px', cursor:'pointer', transition:'all .15s' }}>
            <div style={{ fontSize:10, color:b.color, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>{b.icon} {b.label}</div>
            <div style={{ fontSize:26, fontWeight:800, color:bizF===b.id?b.dark:'#111827' }}>{syncing[b.id] ? '…' : c}</div>
            <div style={{ fontSize:11, color:'#9CA3AF' }}>open tasks</div>
          </div>
        })}
      </div>
      {token && (
        <Card style={{ marginBottom:16 }}>
          <CH title="Quick Add Task" color="#111827" />
          <div style={{ padding:'12px 16px', display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ flex:2, minWidth:200 }}><TI value={newTask} onChange={setNewTask} placeholder="Task name…" onKeyDown={e => e.key === 'Enter' && quickAdd()} /></div>
            <select value={newBiz} onChange={e => setNewBiz(e.target.value)} style={{ padding:'10px 12px', border:'1.5px solid #E5E7EB', borderRadius:10, fontSize:13, color:'#111827', background:'#fff', fontFamily:'inherit', outline:'none' }}>
              {BIZ.map(b => <option key={b.id} value={b.id}>{b.icon} {b.label}</option>)}
            </select>
            <select value={newPri} onChange={e => setNewPri(e.target.value)} style={{ padding:'10px 12px', border:'1.5px solid #E5E7EB', borderRadius:10, fontSize:13, color:'#111827', background:'#fff', fontFamily:'inherit', outline:'none' }}>
              {['high','medium','low'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <Btn onClick={quickAdd} v="solid" color="#111827" disabled={adding || !newTask.trim()}>{adding ? <Spin c="#fff" /> : '+ Add'}</Btn>
          </div>
        </Card>
      )}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', gap:6, background:'#F3F4F6', padding:4, borderRadius:10 }}>
          {[['all','All'],['high','🔴 High'],['medium','🟡 Med'],['low','🟢 Low']].map(([v,l]) => (
            <button key={v} onClick={() => setPriF(v)} style={{ padding:'6px 14px', fontSize:12, fontWeight:600, border:'none', borderRadius:7, cursor:'pointer', fontFamily:'inherit', background:priF===v?'#fff':'transparent', color:priF===v?'#111827':'#6B7280', boxShadow:priF===v?'0 1px 3px rgba(0,0,0,.1)':'none', transition:'all .15s' }}>{l}</button>
          ))}
        </div>
      </div>
      {filtered.length === 0 && <Empty icon="✅" text={token ? 'No tasks matching these filters.' : 'Connect Todoist in settings to see your tasks here.'} />}
      {filtered.map(t => {
        const bz = BUSINESSES[t.bizId] || BUSINESSES.lechat
        const pri = TD_PRI[t.priority] || 'medium'; const p = PRI[pri] || PRI.medium
        return <div key={t.id} style={{ background:p.bg, border:`1.5px solid ${p.dot}35`, borderRadius:12, padding:'12px 16px', marginBottom:10, display:'flex', gap:12, alignItems:'flex-start' }}>
          <button onClick={() => completeTask(t.bizId, t.id)} style={{ width:20, height:20, borderRadius:'50%', border:`2px solid ${p.dot}`, background:'transparent', cursor:'pointer', flexShrink:0, marginTop:2 }} title="Complete" />
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
              <div style={{ fontSize:14, color:'#111827', fontWeight:500, lineHeight:1.4 }}>{t.content}</div>
              <div style={{ display:'flex', gap:5, flexShrink:0, alignItems:'center' }}>
                <Chip color={bz.color}>{bz.icon} {bz.label}</Chip>
                <Chip color={p.color} dot>{pri}</Chip>
                <button onClick={() => deleteTask(t.bizId, t.id)} style={{ background:'none', border:'none', color:'#D1D5DB', cursor:'pointer', fontSize:13, padding:'0 2px' }}>✕</button>
              </div>
            </div>
            {t.description && <div style={{ fontSize:12, color:'#6B7280', marginTop:3, lineHeight:1.4 }}>{t.description}</div>}
            {t.due && <div style={{ fontSize:11, color:'#D97706', marginTop:3, fontWeight:500 }}>⏱ {t.due.string || t.due.date}</div>}
          </div>
        </div>
      })}
    </div>
  )
}

// ── Root CommandCenter ────────────────────────────────────────────────────────
const TABS = [
  { id:'debrief', label:'Morning Debrief', icon:'☀️' },
  { id:'tinting', label:'Auto Spa', icon:'💧' },
  { id:'rocket',  label:'Rocket Science', icon:'🚀' },
  { id:'church',  label:'Bible Way', icon:'✝' },
  { id:'lechat',  label:'Le Chat Digital', icon:'⬡' },
  { id:'todos',   label:'All Tasks', icon:'✓' },
]

export default function CommandCenter() {
  const [tab, setTab] = useState('debrief')
  const [time, setTime] = useState(getTime())
  const [settings, setSettings] = useState(() => store.get('cc_settings', { token:'', projectMap:{} }))
  const [showSetup, setShowSetup] = useState(false)
  const [showTimer, setShowTimer] = useState(false)
  const [showDump, setShowDump] = useState(false)

  const todoist = useTodoist(settings.token, settings.projectMap)

  const saveSettings = s => { setSettings(s); store.set('cc_settings', s) }

  const handleBrainDump = useCallback(async tasks => {
    for (const t of tasks) await todoist.addTask(t.biz, t)
  }, [todoist.addTask])

  useEffect(() => { const i = setInterval(() => setTime(getTime()), 30000); return () => clearInterval(i) }, [])

  const hr = new Date().getHours()
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening'
  const allOpen = Object.values(todoist.tasks).flat().length

  const logout = () => { sessionStorage.removeItem('cc_auth'); window.location.reload() }

  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans','Outfit',sans-serif", background:'#F8F7F4', minHeight:'100vh', color:'#111827' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:none } }
        * { box-sizing: border-box; margin:0; padding:0 }
        textarea, input, select { font-family: inherit }
        button:hover:not(:disabled) { filter: brightness(.95) }
        ::placeholder { color: #C9CDD5 }
        ::-webkit-scrollbar { width: 4px }
        ::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 4px }
      `}</style>

      {showSetup && <SetupDrawer settings={settings} onSave={saveSettings} onClose={() => setShowSetup(false)} />}
      {showTimer && <FocusTimer onClose={() => setShowTimer(false)} />}
      {showDump && <BrainDump onClose={() => setShowDump(false)} onAdd={handleBrainDump} />}

      {/* Top Bar */}
      <div style={{ background:'#fff', borderBottom:'1px solid #F0F0EE', padding:'0 28px', display:'flex', justifyContent:'space-between', alignItems:'center', height:64, position:'sticky', top:0, zIndex:100, boxShadow:'0 1px 6px rgba(0,0,0,.06)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:38, height:38, borderRadius:10, background:'linear-gradient(135deg,#1E1B4B,#4338CA)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:19 }}>⬡</div>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:'#111827', lineHeight:1.15 }}>{greet}, Jonathan.</div>
            <div style={{ fontSize:11, color:'#9CA3AF', fontWeight:500, marginTop:1 }}>{TODAY}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <Btn onClick={() => setShowDump(true)} v="ghost" color="#B45309" sm>🧠 Brain Dump</Btn>
          <Btn onClick={() => setShowTimer(true)} v="ghost" color="#0891B2" sm>⏱ Focus Timer</Btn>
          <button onClick={() => setShowSetup(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', background:settings.token?'#F0FDF4':'#FEF3C7', border:`1.5px solid ${settings.token?'#BBF7D0':'#FDE68A'}`, borderRadius:9, cursor:'pointer', fontSize:12, fontWeight:600, color:settings.token?'#166534':'#92400E', fontFamily:'inherit' }}>
            {settings.token ? '✓ Todoist' : '⚙ Setup Todoist'}
          </button>
          <button onClick={logout} style={{ padding:'7px 12px', background:'#F3F4F6', border:'1px solid #E5E7EB', borderRadius:9, cursor:'pointer', fontSize:12, color:'#6B7280', fontFamily:'inherit' }} title="Lock screen">🔒</button>
          <div style={{ background:'#F3F4F6', borderRadius:10, padding:'6px 14px' }}>
            <div style={{ fontSize:18, fontWeight:800, color:'#111827', letterSpacing:'-.02em' }}>{time}</div>
          </div>
        </div>
      </div>

      {/* Tab Nav */}
      <div style={{ background:'#fff', borderBottom:'1px solid #F0F0EE', padding:'0 28px', display:'flex', overflowX:'auto' }}>
        {TABS.map(t => {
          const isA = tab === t.id; const bz = BUSINESSES[t.id]; const accent = bz?.color || '#1E1B4B'
          const cnt = t.id === 'todos' && allOpen ? ` (${allOpen})` : ''
          return <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:'15px 18px', fontSize:13, fontWeight:isA?700:500, border:'none', cursor:'pointer', background:'transparent', color:isA?accent:'#6B7280', borderBottom:`2.5px solid ${isA?accent:'transparent'}`, whiteSpace:'nowrap', fontFamily:'inherit', transition:'all .15s' }}>{t.icon} {t.label}{cnt}</button>
        })}
      </div>

      {/* Content */}
      <div style={{ maxWidth:1160, margin:'0 auto', padding:'26px 28px' }}>
        {tab === 'debrief' && <DebriefTab todoistTasks={todoist.tasks} />}
        {['tinting','rocket','church','lechat'].includes(tab) && <BizTab biz={BUSINESSES[tab]} todoist={todoist} token={settings.token} projectMap={settings.projectMap} />}
        {tab === 'todos' && <TodosTab todoist={todoist} token={settings.token} />}
      </div>
    </div>
  )
}
