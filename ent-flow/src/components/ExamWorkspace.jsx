// =========================================================
// ExamWorkspace.jsx
// The examination part of the consultation. The doctor:
//   1. chooses the area: ear, nose and sinus, or throat
//   2. sees the anatomy pictures for that area
//   3. marks, draws or writes notes directly on the pictures
//   4. describes each finding (finding, location, comment,
//      pictures, tags) and adds it to the visit record.
//
// Marks are stored as positions from 0 to 1 across the picture,
// so they stay in the right place whatever size it is drawn at.
// =========================================================
import { useRef, useState } from 'react'
import { MapPin, Pencil, StickyNote, Eraser, Undo2, Trash2, Upload, X, History, Repeat } from 'lucide-react'
import { Card, Tag } from './ui.jsx'
import { examRegions, findingCategories, currentPatient } from '../data.js'

const TOOLS = [
  { id: 'mark', label: 'Mark', icon: MapPin },
  { id: 'draw', label: 'Draw', icon: Pencil },
  { id: 'note', label: 'Add note', icon: StickyNote },
  { id: 'erase', label: 'Erase', icon: Eraser },
]
const COMMENT_LIMIT = 500

// - onRecord(region, text): optional, called when a finding is added,
//   so the consultation can copy it into the structured note
export default function ExamWorkspace({ onRecord }) {
  const [regionId, setRegionId] = useState(null)   // null until the doctor chooses
  const [marks, setMarks] = useState({})           // view id -> list of marks
  const [tool, setTool] = useState('mark')
  const [categoryId, setCategoryId] = useState('abnormal')
  const [recorded, setRecorded] = useState([])     // findings added to the visit
  const nextId = useRef(1)
  const added = useRef([])                         // order marks were added, for Undo

  const region = examRegions.find((r) => r.id === regionId)
  const category = findingCategories.find((c) => c.id === categoryId)

  // ---------- Marks on the pictures ----------
  function addMark(viewId, mark) {
    const id = nextId.current++
    added.current.push({ viewId, id })
    setMarks((all) => ({ ...all, [viewId]: [...(all[viewId] || []), { ...mark, id }] }))
  }

  function updateMark(viewId, id, changes) {
    setMarks((all) => ({ ...all, [viewId]: all[viewId].map((m) => (m.id === id ? { ...m, ...changes } : m)) }))
  }

  function removeMark(viewId, id) {
    setMarks((all) => ({ ...all, [viewId]: all[viewId].filter((m) => m.id !== id) }))
  }

  // Removes the most recent mark that is still on screen
  function undo() {
    while (added.current.length) {
      const last = added.current.pop()
      if ((marks[last.viewId] || []).some((m) => m.id === last.id)) {
        removeMark(last.viewId, last.id)
        return
      }
    }
  }

  // Clears every mark on this area's pictures
  function clearRegion() {
    const cleared = {}
    region.views.forEach((v) => { cleared[v.id] = [] })
    setMarks((all) => ({ ...all, ...cleared }))
  }

  // Marks placed in this area that are not linked to a finding yet
  const pendingPins = region
    ? region.views.flatMap((v) => (marks[v.id] || []).filter((m) => m.type === 'pin' && !m.finding).map((m) => ({ ...m, view: v })))
    : []

  // ---------- Adding a finding ----------
  function addFinding(form) {
    const number = recorded.length ? recorded[recorded.length - 1].number + 1 : 1
    const finding = {
      ...form,
      number,
      regionId,
      color: category.color,
      categoryLabel: category.label,
      views: [...new Set(pendingPins.map((p) => p.view.label))],
    }
    setRecorded([...recorded, finding])

    // Link the waiting marks to this finding, so they show its number
    const linked = {}
    region.views.forEach((v) => {
      linked[v.id] = (marks[v.id] || []).map((m) => (m.type === 'pin' && !m.finding ? { ...m, finding: number, color: category.color } : m))
    })
    setMarks((all) => ({ ...all, ...linked }))

    if (onRecord) {
      const text = [`${finding.finding}${finding.location ? `, ${finding.location}` : ''}.`, finding.comment].filter(Boolean).join(' ')
      onRecord(regionId, text)
    }
  }

  function removeFinding(number) {
    setRecorded(recorded.filter((f) => f.number !== number))
    const cleaned = {}
    Object.keys(marks).forEach((viewId) => {
      cleaned[viewId] = marks[viewId].filter((m) => m.finding !== number)
    })
    setMarks(cleaned)
  }

  // ---------- Step 1: choose the area ----------
  if (!region) {
    return (
      <Card>
        <h2>Which area are you examining?</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Complaint: {currentPatient.complaint}. You can switch areas at any time; marks are kept.
        </p>
        <div className="grid-3 mt">
          {examRegions.map((r) => (
            <button key={r.id} className="region-card" onClick={() => setRegionId(r.id)}>
              <img src={r.icon} alt="" />
              <b>{r.label}</b>
              <span className="small">{r.hint}</span>
            </button>
          ))}
        </div>
      </Card>
    )
  }

  // ---------- Step 2: pictures, tools and the findings panel ----------
  const regionFindings = recorded.filter((f) => f.regionId === regionId)

  return (
    <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
      <div className="col grow">
        {/* Area chips: the doctor can move between ear, nose and throat */}
        <div className="row wrap center" style={{ gap: 8 }}>
          {examRegions.map((r) => {
            const count = recorded.filter((f) => f.regionId === r.id).length
            return (
              <button key={r.id} className={'chip' + (r.id === regionId ? ' on' : '')} onClick={() => setRegionId(r.id)}>
                <img src={r.icon} alt="" width="18" /> {r.label}
                {count > 0 && <span className="chip-count">{count}</span>}
              </button>
            )
          })}
          <button className="chip" onClick={() => setRegionId(null)}><Repeat size={14} /> Change area</button>
        </div>

        <Card>
          <div className="row between center">
            <h2>{region.label}</h2>
            <span className="small">{toolHint(tool)}</span>
          </div>
          <div className="row mt" style={{ gap: 14, justifyContent: 'center', alignItems: 'flex-end' }}>
            {region.views.map((view) => (
              <AnnotatedImage
                key={view.id}
                view={view}
                marks={marks[view.id] || []}
                tool={tool}
                color={category.color}
                onAdd={(mark) => addMark(view.id, mark)}
                onUpdate={(id, changes) => updateMark(view.id, id, changes)}
                onRemove={(id) => removeMark(view.id, id)}
              />
            ))}
          </div>

          {/* Tools on the left, mark color on the right */}
          <div className="row wrap between center mt">
            <div className="toolbar">
              {TOOLS.map((t) => {
                const Icon = t.icon
                return (
                  <button key={t.id} className={tool === t.id ? 'on' : ''} onClick={() => setTool(t.id)}>
                    <Icon size={15} /> {t.label}
                  </button>
                )
              })}
              <button onClick={undo}><Undo2 size={15} /> Undo</button>
              <button onClick={clearRegion}><Trash2 size={15} /> Clear</button>
            </div>
            <div className="row wrap" style={{ gap: 6 }}>
              {findingCategories.map((c) => (
                <button
                  key={c.id}
                  className={'legend' + (c.id === categoryId ? ' on' : '')}
                  onClick={() => setCategoryId(c.id)}
                >
                  <span className="dot" style={{ background: c.color }} /> {c.label}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Findings already added in this visit, for this area */}
        <Card>
          <div className="row between center">
            <h3>Findings in this visit</h3>
            <Tag color="soft-blue">{regionFindings.length}</Tag>
          </div>
          {regionFindings.length === 0 && (
            <p className="muted mt">Nothing recorded for this area yet. Mark the picture, describe the finding on the right, then add it to the visit record.</p>
          )}
          <div className="col mt" style={{ gap: 8 }}>
            {regionFindings.map((f) => (
              <div key={f.number} className="finding-row">
                <span className="pin static" style={{ background: f.color }}>{f.number}</span>
                <div className="grow">
                  <b>{f.finding}</b>{f.location && <span className="muted">, {f.location}</span>}
                  {f.comment && <div style={{ fontSize: 12.5, marginTop: 2 }}>{f.comment}</div>}
                  <div className="row wrap" style={{ gap: 4, marginTop: 6 }}>
                    <Tag>{f.categoryLabel}</Tag>
                    {f.views.map((v) => <Tag key={v} color="soft-blue">{v}</Tag>)}
                    {f.tags.map((t) => <Tag key={t}>#{t}</Tag>)}
                    {f.images.length > 0 && <Tag>{f.images.length} picture{f.images.length > 1 ? 's' : ''}</Tag>}
                  </div>
                </div>
                <button className="icon-plain" title="Remove finding" onClick={() => removeFinding(f.number)}><X size={15} /></button>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="row center" style={{ gap: 6 }}><History size={15} /> Previous findings</h3>
          <div className="grid-4 mt">
            {region.previous.map((p) => (
              <div key={p.label + p.date} className="previous">
                <img src={p.img} alt="" />
                <div>
                  <b>{p.label}</b>
                  <div style={{ fontSize: 12 }}>{p.text}</div>
                  <div className="small">{p.date}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <FindingForm
        key={regionId}
        region={region}
        category={category}
        pendingPins={pendingPins}
        onAdd={addFinding}
      />
    </div>
  )
}

function toolHint(tool) {
  return {
    mark: 'Click a picture to place a marker',
    draw: 'Press and drag on a picture to draw',
    note: 'Click a picture to write a note on it',
    erase: 'Click a marker, line or note to remove it',
  }[tool]
}

// ---------- One picture with the doctor's marks on top ----------
function AnnotatedImage({ view, marks, tool, color, onAdd, onUpdate, onRemove }) {
  const boxRef = useRef(null)
  const [line, setLine] = useState(null)   // points of the line being drawn now

  // Mouse position as a fraction (0 to 1) of the picture's width and height
  function pointFrom(e) {
    const box = boxRef.current.getBoundingClientRect()
    return [(e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height]
  }

  function handlePointerDown(e) {
    if (tool !== 'draw') return
    e.currentTarget.setPointerCapture(e.pointerId)
    setLine([pointFrom(e)])
  }

  function handlePointerMove(e) {
    if (line) setLine([...line, pointFrom(e)])
  }

  function handlePointerUp() {
    if (line && line.length > 1) onAdd({ type: 'line', points: line, color })
    setLine(null)
  }

  function handleClick(e) {
    const [x, y] = pointFrom(e)
    if (tool === 'mark') onAdd({ type: 'pin', x, y, color })
    if (tool === 'note') onAdd({ type: 'note', x, y, color, text: '', editing: true })
  }

  // Clicking an existing mark: remove it with the eraser, otherwise do nothing
  function clickMark(e, id) {
    e.stopPropagation()
    if (tool === 'erase') onRemove(id)
  }

  const toPoints = (points) => points.map(([x, y]) => `${x},${y}`).join(' ')

  return (
    // "width" is the preferred size; pictures shrink to stay on one row
    <figure className="anatomy" style={{ flex: `1 1 ${view.width}px`, maxWidth: view.width, minWidth: view.width * 0.55 }}>
      <div
        ref={boxRef}
        className={'anatomy-box tool-' + tool}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
      >
        <img src={view.img} alt={view.label} draggable={false} />

        {/* Lines are drawn in an SVG stretched over the picture */}
        <svg viewBox="0 0 1 1" preserveAspectRatio="none">
          {marks.filter((m) => m.type === 'line').map((m) => (
            <g key={m.id} onClick={(e) => clickMark(e, m.id)} style={{ pointerEvents: tool === 'erase' ? 'stroke' : 'none' }}>
              <polyline points={toPoints(m.points)} fill="none" stroke="transparent" strokeWidth="14" vectorEffect="non-scaling-stroke" />
              <polyline points={toPoints(m.points)} fill="none" stroke={m.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </g>
          ))}
          {line && (
            <polyline points={toPoints(line)} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          )}
        </svg>

        {marks.filter((m) => m.type === 'pin').map((m) => (
          <span
            key={m.id}
            className={'pin' + (m.finding ? '' : ' pending')}
            style={{ left: m.x * 100 + '%', top: m.y * 100 + '%', background: m.color }}
            title={m.finding ? `Finding ${m.finding}` : 'Not added to the visit yet'}
            onClick={(e) => clickMark(e, m.id)}
          >
            {m.finding || '+'}
          </span>
        ))}

        {marks.filter((m) => m.type === 'note').map((m) => (
          <div
            key={m.id}
            className="note"
            style={{ left: m.x * 100 + '%', top: m.y * 100 + '%', borderColor: m.color }}
            onClick={(e) => clickMark(e, m.id)}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {m.editing ? (
              <input
                autoFocus
                placeholder="Note"
                defaultValue={m.text}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                onBlur={(e) => {
                  const text = e.target.value.trim()
                  if (text) onUpdate(m.id, { text, editing: false })
                  else onRemove(m.id)
                }}
              />
            ) : (
              <span onDoubleClick={() => tool !== 'erase' && onUpdate(m.id, { editing: true })}>{m.text}</span>
            )}
          </div>
        ))}
      </div>
      <figcaption>{view.label}</figcaption>
    </figure>
  )
}

// ---------- Right panel: describe the finding ----------
function FindingForm({ region, category, pendingPins, onAdd }) {
  const [finding, setFinding] = useState('')
  const [location, setLocation] = useState('')
  const [comment, setComment] = useState('')
  const [images, setImages] = useState([])
  const [tags, setTags] = useState([])
  const [tagText, setTagText] = useState('')

  function addImages(fileList) {
    const files = [...fileList].map((file) => ({ name: file.name, url: URL.createObjectURL(file), isImage: file.type.startsWith('image/') }))
    setImages([...images, ...files])
  }

  function addTag() {
    const tag = tagText.trim().toLowerCase()
    if (tag && !tags.includes(tag)) setTags([...tags, tag])
    setTagText('')
  }

  function submit() {
    onAdd({ finding, location, comment: comment.trim(), images, tags })
    setFinding('')
    setLocation('')
    setComment('')
    setImages([])
    setTags([])
  }

  return (
    <Card style={{ width: 340, flex: 'none', position: 'sticky', top: 16 }}>
      <h2>Findings &amp; comments</h2>

      <div className="col mt" style={{ gap: 14 }}>
        <div>
          <label className="label">Select finding</label>
          <select className="field" value={finding} onChange={(e) => setFinding(e.target.value)}>
            <option value="">Choose a finding</option>
            {region.findings.map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Location</label>
          <select className="field" value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="">Choose a location</option>
            {region.locations.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>

        <div className="marks-box">
          <span className="dot" style={{ background: category.color }} />
          <span className="grow">
            {pendingPins.length === 0
              ? 'No markers yet. Mark the picture to show where.'
              : `${pendingPins.length} marker${pendingPins.length > 1 ? 's' : ''} on ${[...new Set(pendingPins.map((p) => p.view.label))].join(', ')}`}
          </span>
          <b>{category.label}</b>
        </div>

        <div>
          <label className="label">Comment</label>
          <textarea
            className="field"
            rows={4}
            maxLength={COMMENT_LIMIT}
            value={comment}
            placeholder="Describe what you see"
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="small" style={{ textAlign: 'right' }}>{comment.length}/{COMMENT_LIMIT}</div>
        </div>

        <div>
          <label className="label">Add image <span className="small">(optional)</span></label>
          <label className="dropzone">
            <Upload size={20} />
            <span>Click to upload or drag and drop</span>
            <span className="small">Images, videos or files</span>
            <input type="file" multiple hidden onChange={(e) => addImages(e.target.files)} />
          </label>
          {images.length > 0 && (
            <div className="row wrap mt" style={{ gap: 6 }}>
              {images.map((img, i) => (
                <div key={img.url} className="thumb" title={img.name}>
                  {img.isImage ? <img src={img.url} alt={img.name} /> : <span className="small">{img.name}</span>}
                  <button onClick={() => setImages(images.filter((_, j) => j !== i))}><X size={11} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="label">Tags</label>
          <div className="tag-input">
            {tags.map((t) => (
              <span key={t} className="tag soft-blue">
                {t}
                <button onClick={() => setTags(tags.filter((x) => x !== t))}><X size={11} /></button>
              </span>
            ))}
            <input
              value={tagText}
              placeholder={tags.length ? '' : 'Type and press Enter'}
              onChange={(e) => setTagText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag()}
              onBlur={addTag}
            />
          </div>
        </div>

        <button className="btn full" disabled={!finding} onClick={submit}>Add to visit record</button>
      </div>
    </Card>
  )
}
