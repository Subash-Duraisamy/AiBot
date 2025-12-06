// Chat_full_replacement.jsx — FiG — Improved Stable Version (Fixed: Version A)
import React, { useEffect, useRef, useState } from "react";
import "../styles/chat.css";

import { model } from "../ai/gemini";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { generateTodayTask } from "../utils/generateTask";
import EventDashboard from "../components/EventDashboard"; // kept for navigation

// -------------------------------
// Helpers (India timezone aware)
// -------------------------------
function toIndiaDate(date = new Date()) {
  // Use locale conversion to produce Asia/Kolkata equivalent Date object
  const s = date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  return new Date(s);
}

function formatDateISO(date = new Date()) {
  const d = toIndiaDate(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`; // YYYY-MM-DD
}

function getTomorrowISO() {
  const t = toIndiaDate(new Date());
  t.setDate(t.getDate() + 1);
  return formatDateISO(t);
}

function formatReadable(dateTimeString) {
  if (!dateTimeString) return "";
  try {
    const d = new Date(dateTimeString);
    const opt = {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    };
    return new Intl.DateTimeFormat("en-GB", opt).format(d).replace(",", " —");
  } catch {
    return dateTimeString;
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function generateAIResponse(prompt) {
  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });
    return result.response.text();
  } catch (err) {
    console.error("Gemini error:", err);
    return null;
  }
}

// -------------------------------
// Local multi-event parser (unchanged)
// -------------------------------
function ddmmyyyyToISO(s) {
  const arr = s.split("/");
  if (arr.length !== 3) return null;
  let [d, m, y] = arr.map((x) => x.trim());
  d = d.padStart(2, "0");
  m = m.padStart(2, "0");
  if (y.length === 2) y = "20" + y;
  return `${y}-${m}-${d}`;
}

function parseMultipleEventsLocally(text) {
  if (!text || typeof text !== "string") return [];
  const regex = /([^,]+?)\s*,\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*,\s*(\d{1,2}:\d{2})/g;
  const out = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    const title = m[1].trim();
    const rawDate = m[2].trim();
    const time = m[3].trim();
    const iso = ddmmyyyyToISO(rawDate);
    if (!iso) continue;
    out.push({ title, date: iso, startTime: time });
  }
  return out;
}

// -------------------------------
// Component (Version A — fixed)
// -------------------------------
export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [username, setUsername] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [task, setTask] = useState("");
  const [streak, setStreak] = useState(0);
  const [eventsToday, setEventsToday] = useState([]);
  const [summaryPushedForDate, setSummaryPushedForDate] = useState(null); // prevent duplicates

  const bottomRef = useRef(null);
  const BOT_IMG = "/aibot.png";
  const USER_IMG = "/user1.png";

  // push helpers
  function pushBot(text) {
    setMessages((p) => [...p, { sender: "bot", text, avatar: BOT_IMG }]);
  }
  function pushUser(text) {
    setMessages((p) => [...p, { sender: "you", text, avatar: USER_IMG }]);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // auto-load token from localStorage (keeps login button visible)
  useEffect(() => {
    const t = localStorage.getItem("fig_token");
    if (t) setAccessToken(t);
  }, []);

  // Google token setter helper
  function setTokenAndFetch(token) {
    setAccessToken(token);
    localStorage.setItem("fig_token", token);
    pushBot("🙏 Logged in. I can now manage your schedule.");
    // Only fetch summary if Firebase user already loaded username/task
    if (username) {
      const today = formatDateISO();
      fetchEventsForDate(today).then((items) => {
        setTimeout(() => {
          const out = buildEventsSummaryBubble(items, task, streak, username);
          // Only push if not already pushed for this date
          if (summaryPushedForDate !== today) {
            pushBot(out);
            setSummaryPushedForDate(today);
          }
        }, 300);
      });
    }
  }

  // Google OAuth
  function googleLogin() {
    try {
          console.log("CLIENT ID FROM ENV:", import.meta.env.VITE_GOOGLE_CLIENT_ID);
      const client = google.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",

        callback: (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) setTokenAndFetch(tokenResponse.access_token);
        }
       

      });
      client.requestAccessToken();
    } catch (e) {
      console.error("googleLogin error", e);
      pushBot("Google login failed. Check console.");
    }
  }

  // -------------------------------
  // Firebase auth & load today's task
  // -------------------------------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      const email = user.email ? user.email.split("@")[0] : "";
      const formatted = email ? email.charAt(0).toUpperCase() + email.slice(1) : "friend";
      setUsername(formatted);
      await loadTodayTask(user.uid, formatted);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After both username and accessToken are present, auto-fetch today's events once
  useEffect(() => {
    const today = formatDateISO();
    if (!username || !accessToken) return;
    // only fetch and push summary if not already pushed for today
    if (summaryPushedForDate === today) return;
    fetchEventsForDate(today).then((items) => {
      const out = buildEventsSummaryBubble(items, task, streak, username);
      pushBot(out);
      setSummaryPushedForDate(today);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, accessToken]);

  async function loadTodayTask(uid, name) {
    const today = formatDateISO();
    const ref = doc(db, "users", uid, "tasks", today);
    const snap = await getDoc(ref);
    let todayTask = "";
    if (snap.exists()) {
      const d = snap.data();
      todayTask = d.task || "";
      setTask(todayTask);
      setStreak(d.streak || 0);
    } else {
      const gen = await generateTodayTask(uid);
      todayTask = gen;
      setTask(gen);
    }

    // push calm task bubble (single)
    const calmHtml = `
      <div class="today-task">
        <h3>🌿 Today's Gentle Task</h3>
        <div class="task-content">${escapeHtml(todayTask || "No task for today")}</div>
        <div style="margin-top:6px; font-size:13px; color:rgba(255,255,255,0.85)"><b>Streak:</b> ${streak} days</div>
      </div>
    `;
    pushBot(calmHtml);

    // if Google token available, fetch events and push a combined summary (handled by effect too)
    if (accessToken) {
      const items = await fetchEventsForDate(today);
      const out = buildEventsSummaryBubble(items, todayTask, streak, name);
      if (summaryPushedForDate !== today) {
        pushBot(out);
        setSummaryPushedForDate(today);
      }
    }
  }

  // -------------------------------
  // Calendar helpers
  // -------------------------------
  async function fetchCalendarList() {
    if (!accessToken) return;
    try {
      const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await res.json();
      pushBot(`I can see ${(data.items || []).length} calendars.`);
    } catch (err) {
      console.error(err);
      pushBot("I couldn't read your calendars. Re-login if needed.");
    }
  }

  async function fetchEventsForDate(dateYmd) {
    if (!accessToken) return [];
    try {
      const timeMin = `${dateYmd}T00:00:00+05:30`;
      const timeMax = `${dateYmd}T23:59:59+05:30`;
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await res.json();
      const items = data.items || [];
      setEventsToday(items);
      return items;
    } catch (err) {
      console.error(err);
      pushBot("Couldn't load today's events.");
      setEventsToday([]);
      return [];
    }
  }

  function buildEventsSummaryBubble(items, todayTaskText, streakDays, displayName) {
    let eventsHtml = "";
    if (!accessToken) {
      eventsHtml = `<li>Please login to view calendar events.</li>`;
    } else if (!items || items.length === 0) {
      eventsHtml = `<li>No events for today.</li>`;
    } else {
      eventsHtml = items
        .map((ev) => {
          const start = ev.start?.dateTime ? formatReadable(ev.start.dateTime) : (ev.start?.date || "All-day");
          const title = escapeHtml(ev.summary || "Untitled");
          return `<li>${start} — ${title}</li>`;
        })
        .join("");
    }

    const who = displayName ? escapeHtml(displayName) : "friend";

    return `
      <div class="today-summary">
        <h3>📅 ${who}'s Today</h3>
        <div><b>Gentle Task:</b> ${escapeHtml(todayTaskText || "No task for today")}</div>
        <div style="margin-top:8px"><b>Events Today:</b></div>
        <ul style="margin-top:6px">${eventsHtml}</ul>
      </div>
    `;
  }

  function makeRFC3339(dateYmd, timeHm = "09:00") {
    const [hh, mm] = (timeHm || "09:00").split(":");
    const H = String(hh).padStart(2, "0");
    const M = String(mm || "00").padStart(2, "0");
    return `${dateYmd}T${H}:${M}:00+05:30`;
  }

  function addOneHour(hm = "09:00") {
    const [h, m] = hm.split(":").map((x) => parseInt(x, 10));
    const d = new Date();
    d.setHours(h + 1, m || 0, 0, 0);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  async function createCalendarEvent({ title, date, startTime, endTime, notes = "" }) {
    if (!accessToken) { pushBot("🙏 Please login with Google first to create events."); return null; }
    try {
      const body = {
        summary: title || "Untitled",
        description: notes || "",
        start: { dateTime: makeRFC3339(date, startTime || "09:00"), timeZone: "Asia/Kolkata" },
        end: { dateTime: makeRFC3339(date, endTime || addOneHour(startTime || "09:00")), timeZone: "Asia/Kolkata" }
      };
      const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data && data.id) return data;
      console.error("createCalendarEvent failed:", data);
      pushBot("Couldn't create event. See console for details.");
      return null;
    } catch (err) {
      console.error("createCalendarEvent err:", err);
      pushBot("Network error while creating event.");
      return null;
    }
  }

  async function listEventsOnDate(dateYmd) {
    if (!accessToken) { pushBot("🙏 Please login with Google first to view events."); return []; }
    try {
      const timeMin = `${dateYmd}T00:00:00+05:30`;
      const timeMax = `${dateYmd}T23:59:59+05:30`;
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await res.json();
      return data.items || [];
    } catch (err) {
      console.error("listEventsOnDate err:", err);
      pushBot("I couldn't fetch events for that date.");
      return [];
    }
  }

  async function deleteEventById(eventId) {
    if (!accessToken) { pushBot("🙏 Please login with Google first to delete events."); return false; }
    try {
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      return res.status === 204;
    } catch (err) {
      console.error("deleteEventById err", err);
      pushBot("Couldn't delete event.");
      return false;
    }
  }

  async function updateEventById(eventId, patch) {
    if (!accessToken) { pushBot("🙏 Please login with Google first to update events."); return null; }
    const body = {};
    if (patch.title) body.summary = patch.title;
    if (patch.notes !== undefined) body.description = patch.notes;
    if (patch.date && (patch.startTime || patch.endTime)) {
      body.start = { dateTime: makeRFC3339(patch.date, patch.startTime || "09:00"), timeZone: "Asia/Kolkata" };
      body.end = { dateTime: makeRFC3339(patch.date, patch.endTime || addOneHour(patch.startTime || "09:00")), timeZone: "Asia/Kolkata" };
    }
    try {
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error("updateEventById err", err);
      pushBot("I couldn't update that event.");
      return null;
    }
  }

  // -------------------------------
  // Intent parser (Gemini) — forced to use India date context
  // -------------------------------
  async function parseSchedulingCommand(userText) {
    const parserPrompt = `
Today (India): ${formatDateISO()}
Tomorrow (India): ${getTomorrowISO()}

You MUST base date interpretations on these values.

You are FiG, a helpful assistant. Parse the user's message and return STRICT JSON only with this schema:

{ "intent": "create_event" | "show_events" | "delete_event" | "update_event" | "plan_day" | "none",
  "title": string or null,
  "date": "YYYY-MM-DD" or null,
  "startTime": "HH:MM" or null,
  "endTime": "HH:MM" or null,
  "eventId": string or null,
  "query": string or null,
  "notes": string or null }

Interpret natural language dates and times (tomorrow, next monday, tonight, 6pm) using India timezone. If no scheduling intent, return {"intent":"none"}.

User message:
"""${userText}"""
`;

    const raw = await generateAIResponse(parserPrompt);
    if (!raw) return { intent: "none" };
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    if (first === -1 || last === -1) return { intent: "none" };
    const jsonText = raw.slice(first, last + 1);
    try { return JSON.parse(jsonText); } catch (err) { console.error("parseSchedulingCommand JSON.parse err:", err, jsonText); return { intent: "none" }; }
  }

  // -------------------------------
  // Main handler
  // -------------------------------
  async function handleUserMessage(userText) {
    pushUser(userText);

    // If user asks for events but not logged into Google => request login
    const asksForEvents = /\b(event|events|today's events|tomorrow|add event|show events|what's on|today)\b/i.test(userText);
    if (asksForEvents && !accessToken) {
      pushBot("🙏 Please login with Google first so I can access your calendar.");
      return;
    }

    // Local multi-event parsing first (quick comma,date,time pattern)
    const multi = parseMultipleEventsLocally(userText);
    if (multi.length > 0) {
      pushBot("Creating multiple events…");
      let createdCount = 0;
      for (const ev of multi) {
        const created = await createCalendarEvent({ title: ev.title, date: ev.date, startTime: ev.startTime, endTime: undefined, notes: "" });
        if (created) {
          createdCount++;
          pushBot(`🙏 Event ${created.summary} added on ${ev.date} at ${ev.startTime}.`);
        } else {
          pushBot(`Couldn't create event: ${ev.title}, ${ev.date}, ${ev.startTime}.`);
        }
      }
      pushBot(`Created ${createdCount}/${multi.length} events.`);
      return;
    }

    // Fallback to AI parser
    pushBot("Let me think…");
    const parsed = await parseSchedulingCommand(userText);

    if (!parsed || parsed.intent === "none") {
      setMessages((m) => m.slice(0, -1));
      return replyFiG(userText);
    }

    if (parsed.intent === "create_event") {
      if (!parsed.date || !parsed.startTime || !parsed.title) {
        setMessages((m) => m.slice(0, -1));
        pushBot("I need a title, date and start time to create an event. Can you provide them?");
        return;
      }
      setMessages((m) => m.slice(0, -1));
      pushBot("Creating your event…");
      const created = await createCalendarEvent({ title: parsed.title, date: parsed.date, startTime: parsed.startTime, endTime: parsed.endTime, notes: parsed.notes || "" });
      if (created) pushBot(`🙏 Event <b>${created.summary}</b> added on <b>${parsed.date}</b> at <b>${parsed.startTime}</b>.`);
      else pushBot("I couldn't create the event.");
      return;
    }

    if (parsed.intent === "show_events") {
      const date = parsed.date || formatDateISO();
      setMessages((m) => m.slice(0, -1));
      pushBot("Fetching events…");
      const items = await listEventsOnDate(date);
      if (!items.length) { pushBot(`You have no events on <b>${date}</b>.`); return; }
      let out = `<b>Events on ${date}:</b><br/>`;
      items.forEach((ev) => {
        const start = ev.start?.dateTime ? formatReadable(ev.start.dateTime) : ev.start?.date || "";
        out += `• <b>${escapeHtml(ev.summary)}</b> — ${start}<br/>`;
      });
      pushBot(out);
      return;
    }

    if (parsed.intent === "delete_event") {
      const date = parsed.date || formatDateISO();
      setMessages((m) => m.slice(0, -1));
      pushBot("Searching for event to delete…");
      const items = await listEventsOnDate(date);
      const found = items.find((ev) => parsed.title && ev.summary && ev.summary.toLowerCase().includes(parsed.title.toLowerCase()));
      if (!found) { pushBot("I couldn't locate that event. Try giving exact title or event date."); return; }
      const ok = await deleteEventById(found.id);
      if (ok) pushBot(`Deleted <b>${found.summary}</b>.`); else pushBot("I couldn't delete the event.");
      return;
    }

    if (parsed.intent === "update_event") {
      setMessages((m) => m.slice(0, -1));
      pushBot("Locating event to update…");
      if (parsed.eventId) {
        const upd = await updateEventById(parsed.eventId, parsed);
        if (upd) pushBot(`Updated event <b>${upd.summary}</b>.`); else pushBot("Update failed.");
        return;
      }
      const date = parsed.date || formatDateISO();
      const items = await listEventsOnDate(date);
      const found = items.find((ev) => parsed.title && ev.summary && ev.summary.toLowerCase().includes(parsed.title.toLowerCase()));
      if (!found) { pushBot("Couldn't find the event to update."); return; }
      const upd = await updateEventById(found.id, parsed);
      if (upd) pushBot(`Updated <b>${upd.summary}</b>.`); else pushBot("Update failed.");
      return;
    }

    if (parsed.intent === "plan_day") {
      setMessages((m) => m.slice(0, -1));
      pushBot("Planning your day…");
      const planPrompt = `Create a calm, balanced schedule for ${username} on ${parsed.date || formatDateISO()}. Return ONLY a JSON array like: [ { "title":"...", "start":"HH:MM", "end":"HH:MM", "notes":"" } ]`;
      const rawPlan = await generateAIResponse(planPrompt);
      if (!rawPlan) { pushBot("I couldn't plan right now."); return; }
      const js = (() => { const f = rawPlan.indexOf("["); const l = rawPlan.lastIndexOf("]"); if (f === -1 || l === -1) return null; try { return JSON.parse(rawPlan.slice(f, l + 1)); } catch (e) { return null; } })();
      if (!js) { pushBot("I have a plan idea:<br/>" + rawPlan); return; }
      let createdCount = 0;
      for (const ev of js) {
        if (!ev.title || !ev.start || !ev.end) continue;
        const c = await createCalendarEvent({ title: ev.title, date: parsed.date || formatDateISO(), startTime: ev.start, endTime: ev.end, notes: ev.notes || "" });
        if (c) createdCount++;
      }
      pushBot(`Created ${createdCount} events for the day.`);
      return;
    }

    setMessages((m) => m.slice(0, -1));
    return replyFiG(userText);
  }

  // -------------------------------
  // FiG conversational reply
  // -------------------------------
  async function replyFiG(userText) {
    pushBot("Let me gently respond…");
    const today = formatDateISO(new Date());
    const prompt = `
You are FiG — a calm, Buddhist-like personal assistant.
Combine Tamil + soft English.

Rules:
- When the user asks about today's date or time, ALWAYS answer with the real value.
- NEVER use placeholders.
- Use the India date: ${today}.
- Keep the tone gentle, motivating, peaceful.

User message: "${userText}"
`;
    const raw = await generateAIResponse(prompt);
    setMessages((m) => m.slice(0, -1));
    if (!raw) { pushBot("I couldn't think clearly now. Try again."); return; }
    pushBot(cleanHTML(raw || "I am here with you."));
  }

  function cleanHTML(s) { try { return String(s).replace(/\*+/g, ""); } catch { return s; } }

  function onSend() { if (!input.trim()) return; const text = input.trim(); setInput(""); handleUserMessage(text); }

  // -------------------------------
  // UI — Left login, Right dashboard (option A)
  // -------------------------------
  return (
    <div className="chat-wrapper">
      <div className="chat-container">

        {/* top bar with left-login and right-dashboard */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="google-login-btn" onClick={googleLogin}>Login with Google</button>
          </div>

          <div style={{ textAlign: "center" }}>
            <div className="chat-header" style={{ margin: 0 }}>
              <h2 style={{ margin: 0 }}>FiG — Calm Personal Assistant</h2>
              <p style={{ margin: "6px 0 0" }}>Your day… shaped with gentleness.</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="google-open-dashboard" onClick={() => window.location.href = "/dashboard"}>Open Event Dashboard</button>
          </div>
        </div>

        <div className="chat-body">
          {messages.map((m, i) => (
            <div key={i} className={`msg-row ${m.sender === "you" ? "msg-you" : "msg-bot"}`}>
              <img className="avatar" src={m.avatar} alt="" />
              <div className={`bubble ${m.sender}`} dangerouslySetInnerHTML={{ __html: m.text }}></div>
            </div>
          ))}
          <div ref={bottomRef}></div>
        </div>

        <div className="chat-input-area">
          <input className="chat-input" placeholder="Talk to FiG (e.g. 'Add gym tomorrow 6pm')" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSend()} />
          <button className="send-btn" onClick={onSend}>➤</button>
        </div>

      </div>
    </div>
  );
}
