// src/components/EventDashboard.jsx
import React, { useEffect, useState } from "react";
import "../styles/eventDashboard.css";

export default function EventDashboard({
  accessToken,
  defaultCalendar = "primary",
  timezone = "Asia/Kolkata"
}) {
  // left (extract flow) states
  const [rawText, setRawText] = useState("");
  const [extracted, setExtracted] = useState([]); // { title, date, startTime, status }
  const [log, setLog] = useState([]);

  // right (upcoming events) states
  const [upcoming, setUpcoming] = useState([]); // items from Google
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);

  // UI
  const [activeTab, setActiveTab] = useState("extract"); // extract | upcoming | add
  const [addForm, setAddForm] = useState({ title: "", date: "", time: "" });
  const [editIndex, setEditIndex] = useState(null); // index in upcoming being edited
  const [refreshKey, setRefreshKey] = useState(0);

  /* ----------------- helpers ----------------- */
  function addLog(s) {
    setLog((p) => [s, ...p].slice(0, 100));
  }

  function formatDateISO(date = new Date()) {
    const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 10);
  }

  function makeRFC3339(dateYmd, timeHm = "09:00") {
    const [hh, mm] = (timeHm || "09:00").split(":");
    const H = String(hh).padStart(2, "0");
    const M = String(mm || "00").padStart(2, "0");
    return `${dateYmd}T${H}:${M}:00+05:30`;
  }

  function addOneHour(hm = "09:00") {
    const [h, m] = hm.split(":").map((x) => parseInt(x || "0", 10));
    const nd = new Date();
    nd.setHours(h + 1, m || 0, 0, 0);
    return `${String(nd.getHours()).padStart(2, "0")}:${String(
      nd.getMinutes()
    ).padStart(2, "0")}`;
  }

  // parsing utilities (kept similar to your prior parser)
  function parseTimeString(timeStr) {
    if (!timeStr) return null;
    const s = timeStr.trim().toLowerCase();
    const hhmm = s.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmm) {
      const h = Number(hhmm[1]);
      const m = Number(hhmm[2]);
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    const ampm = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
    if (ampm) {
      let h = Number(ampm[1]);
      const min = ampm[2] ? Number(ampm[2]) : 0;
      const ap = ampm[3];
      if (ap) {
        if (ap === "pm" && h !== 12) h += 12;
        if (ap === "am" && h === 12) h = 0;
      }
      return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    }
    return null;
  }

  function toISODateFromParts(y, m, d) {
    return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(
      d
    ).padStart(2, "0")}`;
  }

  function parseDateWord(word, baseDate = new Date()) {
    if (!word) return null;
    const w = word.trim().toLowerCase();
    if (w === "today" || w === "tonight") return formatDateISO(baseDate);
    if (w === "tomorrow") {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + 1);
      return formatDateISO(d);
    }
    const dmy = w.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
    if (dmy) {
      let dd = Number(dmy[1]);
      let mm = Number(dmy[2]);
      let yy = dmy[3] ? Number(dmy[3]) : new Date().getFullYear();
      if (yy < 100) yy = 2000 + yy;
      return toISODateFromParts(yy, mm, dd);
    }
    return null;
  }

  function extractEventsFromLine(line) {
    const base = new Date();
    let date = null;
    let time = null;
    let title = line.trim();

    const timeMatch = line.match(
      /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|noon|midnight)\b/i
    );
    if (timeMatch) {
      time = parseTimeString(
        timeMatch[1].replace(/noon/i, "12:00").replace(/midnight/i, "00:00")
      );
      title = title.replace(timeMatch[0], "");
    }

    const dateMatch = line.match(
      /\b(today|tomorrow|tonight|\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\b/i
    );
    if (dateMatch) {
      date = parseDateWord(dateMatch[1], base);
      title = title.replace(dateMatch[0], "");
    }

    if (!date) date = formatDateISO(base);
    if (!time) time = "09:00";

    title = title.replace(/[\-\,\:\s]+$/g, "").trim();
    if (!title) title = "Untitled";

    return { title, date, startTime: time, status: "pending" };
  }

  /* ----------------- extraction actions ----------------- */
  function extractAll(raw) {
    const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const outs = lines.map((l) => extractEventsFromLine(l));
    setExtracted(outs);
    addLog(`Extracted ${outs.length} events`);
    setActiveTab("extract");
  }

  function clearExtraction() {
    setRawText("");
    setExtracted([]);
    addLog("Cleared extraction");
  }

  async function approveExtractedAtIndex(idx) {
    const ev = extracted[idx];
    if (!accessToken) {
      addLog("No access token — login via Dashboard");
      return;
    }
    addLog(`Creating "${ev.title}" on ${ev.date} ${ev.startTime}`);
    try {
      const created = await createCalendarEvent(accessToken, defaultCalendar, ev);
      if (created && created.id) {
        const copy = [...extracted];
        copy[idx] = { ...copy[idx], status: "created", createdId: created.id };
        setExtracted(copy);
        addLog(`Created ✓ ${ev.title}`);
        // refresh upcoming list
        setRefreshKey((k) => k + 1);
      } else {
        addLog("Create failed: " + JSON.stringify(created || "no response"));
      }
    } catch (err) {
      addLog("Error: " + String(err));
    }
  }

  async function approveAllExtracted() {
    for (let i = 0; i < extracted.length; i++) {
      if (extracted[i].status === "created") continue;
      // eslint-disable-next-line no-await-in-loop
      // sequential to avoid quota bursts
      // create calendar event
      // we continue even if one fails
      // user will see logs
      // call approveExtractedAtIndex
      // small inline implementation to reduce repeated code
      const ev = extracted[i];
      try {
        if (!accessToken) {
          addLog("No access token — login via Dashboard");
          break;
        }
        const created = await createCalendarEvent(accessToken, defaultCalendar, ev);
        if (created && created.id) {
          const copy = [...extracted];
          copy[i] = { ...copy[i], status: "created", createdId: created.id };
          setExtracted(copy);
          addLog(`Created ✓ ${ev.title}`);
        } else {
          addLog("Create failed: " + JSON.stringify(created || "no response"));
        }
      } catch (err) {
        addLog("Error: " + String(err));
      }
    }
    setRefreshKey((k) => k + 1);
  }

  function removeExtractedAtIndex(i) {
    const copy = [...extracted];
    copy.splice(i, 1);
    setExtracted(copy);
    addLog("Removed extracted item");
  }

  /* -------------- Google Calendar API helpers -------------- */
  async function createCalendarEvent(token, calendarId, ev) {
    if (!token) throw new Error("No token");
    const body = {
      summary: ev.title,
      description: ev.notes || "",
      start: { dateTime: `${ev.date}T${ev.startTime}:00`, timeZone: timezone },
      end: {
        dateTime: `${ev.date}T${ev.endTime || addOneHour(ev.startTime)}:00`,
        timeZone: timezone
      }
    };
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }
    );
    return res.json();
  }

  async function fetchUpcomingEvents(rangeDays = 30) {
    if (!accessToken) {
      setUpcoming([]);
      addLog("No access token for upcoming events");
      return;
    }
    setLoadingUpcoming(true);
    try {
      const now = new Date();
      const timeMin = now.toISOString();
      const max = new Date(now);
      max.setDate(max.getDate() + rangeDays);
      const timeMax = max.toISOString();

      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
        timeMin
      )}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;

      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await res.json();
      setUpcoming(data.items || []);
      addLog(`Loaded ${((data.items) || []).length} upcoming events`);
    } catch (err) {
      addLog("Could not fetch upcoming events: " + String(err));
    } finally {
      setLoadingUpcoming(false);
    }
  }

  async function deleteUpcomingEvent(eventId, idx) {
    if (!accessToken) {
      addLog("No access token to delete");
      return;
    }
    if (!window.confirm("Delete this event?")) return;
    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (res.status === 204) {
        addLog("Deleted event");
        // remove from list
        const copy = [...upcoming];
        copy.splice(idx, 1);
        setUpcoming(copy);
      } else {
        addLog("Delete failed: " + res.status);
      }
    } catch (err) {
      addLog("Delete error: " + String(err));
    }
  }

  async function updateUpcomingEvent(eventId, idx, patched) {
    if (!accessToken) {
      addLog("No token to update");
      return;
    }
    try {
      const body = {};
      if (patched.title) body.summary = patched.title;
      if (patched.startDate && patched.startTime) {
        body.start = { dateTime: `${patched.startDate}T${patched.startTime}:00`, timeZone: timezone };
        body.end = { dateTime: `${patched.startDate}T${patched.endTime || addOneHour(patched.startTime)}:00`, timeZone: timezone };
      }
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(body)
        }
      );
      const data = await res.json();
      if (data && data.id) {
        addLog("Event updated");
        // refresh upcoming
        setRefreshKey((k) => k + 1);
      } else {
        addLog("Update failed: " + JSON.stringify(data));
      }
    } catch (err) {
      addLog("Update error: " + String(err));
    }
  }

  async function createNewUpcomingEvent(manual) {
    if (!accessToken) {
      addLog("No token to create");
      return;
    }
    try {
      const body = {
        summary: manual.title,
        start: { dateTime: `${manual.date}T${manual.time}:00`, timeZone: timezone },
        end: { dateTime: `${manual.date}T${manual.endTime || addOneHour(manual.time)}:00`, timeZone: timezone }
      };
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(body)
        }
      );
      const data = await res.json();
      if (data && data.id) {
        addLog("Created new event");
        setRefreshKey((k) => k + 1);
        setAddForm({ title: "", date: "", time: "" });
        setActiveTab("upcoming");
      } else {
        addLog("Create failed: " + JSON.stringify(data));
      }
    } catch (err) {
      addLog("Create error: " + String(err));
    }
  }

  /* -------------- effects -------------- */
  useEffect(() => {
    // refresh upcoming whenever accessToken or refreshKey changes
    if (accessToken) fetchUpcomingEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, refreshKey]);

  /* -------------- UI helpers -------------- */
  function prettyStart(ev) {
    const s = ev.start?.dateTime || ev.start?.date || "";
    if (!s) return "";
    // if ISO with time -> show date + hh:mm
    if (s.includes("T")) {
      const d = s.split("T")[0];
      const t = s.split("T")[1].replace("+05:30", "").slice(0,5);
      return `${d} ${t}`;
    }
    return s;
  }

  /* -------------- render -------------- */
  return (
    <div className="ed-shell">
      <aside className="ed-sidebar">
      <div className="ed-top-buttons">
          <button 
            className="ed-small" 
            onClick={() => window.location.href = "/chat"}
          >
            ← Back to Chat
          </button>
        </div>
        <div className="ed-brand">
          <div className="ed-logo">FiG</div>
          <div className="ed-brand-text">Event Dashboard</div>
        </div>

        <nav className="ed-nav">
          <button className={`ed-nav-btn ${activeTab==='extract'?'active':''}`} onClick={()=>setActiveTab('extract')}>Extract</button>
          <button className={`ed-nav-btn ${activeTab==='upcoming'?'active':''}`} onClick={()=>setActiveTab('upcoming')}>Upcoming</button>
          <button className={`ed-nav-btn ${activeTab==='add'?'active':''}`} onClick={()=>setActiveTab('add')}>Add Event</button>
          <div className="ed-nav-divider" />
          <div className="ed-small-controls">
            <button className="ed-small" onClick={()=>setRefreshKey(k=>k+1)}>Refresh Events</button>
            <button className="ed-small" onClick={()=>{ setExtracted([]); setRawText(''); }}>Clear Extract</button>
          </div>
        </nav>

        <div className="ed-activity">
          <div className="ed-activity-title">Activity</div>
          <div className="ed-activity-list">
            {log.slice(0,10).map((l,i)=>(<div key={i} className="ed-activity-item">- {l}</div>))}
            {log.length===0 && <div className="ed-activity-item">No actions yet.</div>}
          </div>
        </div>
      </aside>

      <main className="ed-main">
        {/* Extract panel */}
        {activeTab==='extract' && (
          <section className="ed-panel ed-panel-left">
            <h3>Paste & Extract</h3>
            <textarea value={rawText} onChange={(e)=>setRawText(e.target.value)} className="ed-textarea" rows={8} placeholder="one line per item..."></textarea>

            <div className="ed-row">
              <button className="ed-btn" onClick={()=>extractAll(rawText)}>Extract</button>
              <button className="ed-btn danger" onClick={clearExtraction}>Clear</button>
              <button className="ed-btn success" disabled={!accessToken || extracted.length===0} onClick={approveAllExtracted}>Approve All</button>
            </div>

            <div className="ed-extracted-list">
              <table className="ed-small-table">
                <thead><tr><th>Title</th><th>Date</th><th>Time</th><th></th></tr></thead>
                <tbody>
                  {extracted.length===0 && <tr><td colSpan={4} className="ed-empty">No extracted items</td></tr>}
                  {extracted.map((ev,i)=>(
                    <tr key={i} className={ev.status==='created'?'ed-created':''}>
                      <td><input value={ev.title} onChange={(e)=>setExtracted(p=>p.map((x,j)=>j===i?{...x,title:e.target.value}:x))} /></td>
                      <td><input value={ev.date} onChange={(e)=>setExtracted(p=>p.map((x,j)=>j===i?{...x,date:e.target.value}:x))} /></td>
                      <td><input value={ev.startTime} onChange={(e)=>setExtracted(p=>p.map((x,j)=>j===i?{...x,startTime:e.target.value}:x))} /></td>
                      <td style={{display:'flex',gap:6}}>
                        <button className="ed-small-btn success" disabled={!accessToken} onClick={()=>approveExtractedAtIndex(i)}>✓</button>
                        <button className="ed-small-btn danger" onClick={()=>removeExtractedAtIndex(i)}>✖</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Upcoming events manager */}
        {activeTab==='upcoming' && (
          <section className="ed-panel ed-panel-right">
            <div className="ed-panel-header">
              <h3>Upcoming events</h3>
              <div className="ed-panel-actions">
                <button className="ed-small" onClick={()=>fetchUpcomingEvents()}>Reload</button>
                <button className="ed-small" onClick={()=>setRefreshKey(k=>k+1)}>Refresh</button>
              </div>
            </div>

            <div className="ed-upcoming-list">
              {loadingUpcoming ? <div className="ed-empty">Loading...</div> : (
                <table className="ed-up-table">
                  <thead><tr><th>When</th><th>Title</th><th>Actions</th></tr></thead>
                  <tbody>
                    {upcoming.length===0 && <tr><td colSpan={3} className="ed-empty">No upcoming events</td></tr>}
                    {upcoming.map((ev, idx)=>{
                      const start = ev.start?.dateTime || ev.start?.date || "";
                      const startDate = start.includes('T') ? start.split('T')[0] : start;
                      const startTime = start.includes('T') ? start.split('T')[1].replace('+05:30','').slice(0,5) : '';
                      const isEditing = editIndex === idx;
                      return (
                        <tr key={ev.id} className="ed-up-row">
                          <td style={{minWidth:170}}>
                            {isEditing ? (
                              <div style={{display:'flex',gap:8}}>
                                <input type="date" defaultValue={startDate} onChange={(e)=>{ ev._editDate = e.target.value; }} />
                                <input type="time" defaultValue={startTime} onChange={(e)=>{ ev._editTime = e.target.value; }} />
                              </div>
                            ) : (<div>{startDate} {startTime}</div>)}
                          </td>
                          <td>
                            {isEditing ? (
                              <input defaultValue={ev.summary} onChange={(e)=>{ ev._editTitle = e.target.value; }} />
                            ) : (<div>{ev.summary}</div>)}
                          </td>
                          <td style={{whiteSpace:'nowrap'}}>
                            {isEditing ? (
                              <>
                                <button className="ed-small-btn success" onClick={()=>{
                                  const patched = {
                                    title: ev._editTitle || ev.summary,
                                    startDate: ev._editDate || startDate,
                                    startTime: ev._editTime || startTime
                                  };
                                  updateUpcomingEvent(ev.id, idx, patched);
                                  setEditIndex(null);
                                }}>Save</button>
                                <button className="ed-small-btn danger" onClick={()=>setEditIndex(null)}>Cancel</button>
                              </>
                            ) : (
                              <>
                                <button className="ed-small-btn" onClick={()=>{ setEditIndex(idx); ev._editDate = startDate; ev._editTime = startTime; ev._editTitle = ev.summary; }}>Edit</button>
                                <button className="ed-small-btn danger" onClick={()=>deleteUpcomingEvent(ev.id, idx)}>Delete</button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {/* Add Event tab */}
        {activeTab==='add' && (
          <section className="ed-panel ed-panel-right">
            <h3>Add Event</h3>
            <div className="ed-form-row">
              <label>Title</label>
              <input value={addForm.title} onChange={(e)=>setAddForm({...addForm, title:e.target.value})} />
            </div>
            <div className="ed-form-row">
              <label>Date</label>
              <input type="date" value={addForm.date} onChange={(e)=>setAddForm({...addForm, date:e.target.value})} />
            </div>
            <div className="ed-form-row">
              <label>Time</label>
              <input type="time" value={addForm.time} onChange={(e)=>setAddForm({...addForm, time:e.target.value})} />
            </div>

            <div style={{display:'flex',gap:8, marginTop:12}}>
              <button className="ed-btn success" onClick={()=>createNewUpcomingEvent(addForm)} disabled={!addForm.title || !addForm.date || !addForm.time}>Create</button>
              <button className="ed-btn" onClick={()=>setAddForm({title:'',date:'',time:''})}>Reset</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
