/* Fannet live records, read live from the Fannet master database (Supabase) through the
   viewer's Supabase connector in claude.ai. Plugs into the shared Search, fight-history, officials and event screens of each
   app page. Demo people and events stay as they were; real ones are added as you search. */
window.FN_LIVE_INSTALL = function (A) {
  if (!A || !A.DIR) return null;
  const { DIR, navbar, hHead, esc, wld } = A;
  const KO = (() => { try { return localStorage.getItem("fnLang") === "ko"; } catch (e) { return false; } })();
  // Korean UI: write dates and fight shorthand in Korean here, since the page dictionary only covers fixed phrases
  const hDate = d => { const m = KO && /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ""); return m ? `${+m[1]}년 ${+m[2]}월 ${+m[3]}일` : A.hDate(d); };
  const rds = n => KO ? `${n}라운드` : `${n} rds`;
  const rOf = (r, n) => KO ? `${r}/${n || "?"}라운드` : `R${r} of ${n || "?"}`;
  const streak = (n, f) => KO ? `${n}${{ W: "연승", L: "연패", D: "무" }[f] || f}` : `${n}${f}`;
  // full country names from ISO codes, in the page language (Korean when the app is set to Korean)
  const CTRY_FIX = KO ? { KR: "한국", HK: "홍콩", MO: "마카오", PS: "팔레스타인", CG: "콩고" } : { HK: "Hong Kong", MO: "Macau", PS: "Palestine", CG: "Congo" };
  let REGION = null; try { REGION = new Intl.DisplayNames([KO ? "ko" : "en"], { type: "region" }); } catch (e) { }
  const cname = c => { if (!c) return ""; if (CTRY_FIX[c]) return CTRY_FIX[c]; try { return (REGION && REGION.of(c)) || c; } catch (e) { return c; } };
  const STATE = { mode: "unknown", err: "" };
  const rerender = () => { try { A.render(); } catch (e) { } };
  // claude.ai pages cannot fetch supabase.co directly, so reads go through the viewer's
  // Supabase connector (execute_sql). Only fixed SELECT statements are sent; search text and
  // codes are checked before they reach SQL.
  const PROJECT = "uapwpuhmosnprpzmkqrf";
  let MCP = null; const mcpReady = (window.claude && window.claude.use ? window.claude.use("mcp") : Promise.resolve(null)).then(m => (MCP = m)).catch(() => null);
  const ERRTXT = { server_not_connected: "Add the Supabase connector in claude.ai Settings, Connectors.", needs_reauth: "Reconnect Supabase in claude.ai Settings, Connectors.",
    not_in_manifest: "Supabase access was turned off for this page. Allow it from the page's Permissions menu.", approval_required: "Allow Supabase access when claude.ai asks.",
    selection_required: "Choose which Supabase connector to use when claude.ai asks.", blocked_by_policy: "Your organization blocks this connector." };
  function parseRows(pl) {
    if (Array.isArray(pl)) return pl;
    let t = typeof pl === "string" ? pl : pl && typeof pl.result === "string" ? pl.result : JSON.stringify(pl);
    const m = t.match(/<untrusted-data-[^>]*>\s*([\s\S]*?)\s*<\/untrusted-data/); if (m) t = m[1];
    const i = t.indexOf("["); if (i < 0) throw new Error("Unexpected database reply");
    return JSON.parse(t.slice(i, t.lastIndexOf("]") + 1));
  }
  async function sql(query) {
    await mcpReady;
    if (!MCP) throw new Error("Live data needs this page to be opened in claude.ai.");
    try { const r = await MCP.callTool("Supabase", "execute_sql", { project_id: PROJECT, query });
      STATE.mode = "live"; return parseRows(r.payload !== undefined ? r.payload : (r.content && r.content[0] && r.content[0].text)); }
    catch (e) { if (e && e.code) throw new Error(ERRTXT[e.code] || (e.code + (e.message ? ": " + String(e.message).slice(0, 140) : ""))); throw e; }
  }
  // All reads go through four read-only database functions (fn_app_search, fn_app_person,
  // fn_app_event, fn_app_comm_events). Inside claude.ai they are called through the viewer's
  // Supabase connector; in the Android app (or any normal web page) through the public REST API.
  const REST = "https://uapwpuhmosnprpzmkqrf.supabase.co/rest/v1/rpc/";
  const KEY = "sb_publishable_DVPE2G8S5tbGhne__5Bb7g__fOG7xzP"; // public, read-only key
  const lit = v => v === null || v === undefined ? "null" : Array.isArray(v) ? "array[" + v.map(lit).join(",") + "]::text[]" : "'" + String(v).replace(/'/g, "''") + "'";
  async function rpc(fn, args) {
    await mcpReady;
    if (MCP) { const rows = await sql(`select public.${fn}(${Object.values(args).map(lit).join(",")}) as r`); return rows[0] && rows[0].r; }
    let r;
    try { r = await fetch(REST + fn, { method: "POST", headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(args) }); }
    catch (e) { throw new Error(window.claude ? "Live data needs the Supabase connector in claude.ai." : "No internet connection, or the Fannet database is unreachable."); }
    if (!r.ok) throw new Error("Database error " + r.status);
    STATE.mode = "live"; return r.json();
  }
  const CODE = c => { if (!/^[A-Z]{2,5}[0-9]{2,8}$/.test(c || "")) throw new Error("bad code " + c); return "'" + c + "'"; };
  const CODES = l => l.map(CODE).join(",");
  const LIKE = q => "'%" + q.replace(/[^\p{L}\p{N} .'-]/gu, " ").replace(/'/g, "''").replace(/\s+/g, " ").trim() + "%'";
  const fail = e => { STATE.mode = STATE.mode === "live" ? "live" : "blocked"; STATE.err = String(e && e.message || e); console.warn("Fannet live data:", e);
    if (STATE.mode === "blocked" && !document.getElementById("fn-live-warn")) { const d = document.createElement("div"); d.id = "fn-live-warn";
      d.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:99999;max-width:340px;background:#fff4f2;color:#7a1a10;border:1px solid #f1b8ae;border-radius:10px;padding:10px 12px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.12)";
      d.innerHTML = "<b>Live database not reachable from this page.</b><br>Search shows demo records only. (" + STATE.err.replace(/</g, "&lt;").slice(0, 120) + ")"; document.body.appendChild(d); } };
  const enc = s => encodeURIComponent(s);
  // ---------- caches ----------
  const PEOPLE = {};   // code -> fn_people row
  const NAMES = {};    // code -> display name
  const BOUTS = {};    // person code -> [bout]
  const OFFBOUTS = {}; // official code -> [[role,bout]]
  const EVB = {};      // event code -> [bout]
  const EVOFF = {};    // event code -> [{role,name}]
  const EVROW = {};    // event code -> fn_events row
  const LIVE = {};     // DIR id -> DIR object
  const pn = c => (c && NAMES[c]) || "";
  const roleName = r => ({ boxer: "Fighter", referee: "Referee", judge: "Judge", promoter: "Promoter", matchmaker: "Matchmaker", supervisor: "Supervisor", inspector: "Inspector", doctor: "Doctor", timekeeper: "Timekeeper" })[r] || "Official";
  function personObj(p) {
    NAMES[p.person_code] = p.display_name; PEOPLE[p.person_code] = Object.assign(PEOPLE[p.person_code] || {}, p);
    const id = "L" + p.person_code;
    const nat = [p.native_names, typeof HGAUTO !== "undefined" && HGAUTO[p.person_code]].filter(Boolean).join(" ");
    if (LIVE[id]) { if (nat) LIVE[id].native = nat; return LIVE[id]; }
    const isB = p.bouts > 0;
    const x = { id, real: true, name: p.display_name, ring: p.ring_name || "", role: isB ? "Fighter" : roleName(p.primary_role === "boxer" ? "referee" : p.primary_role), fid: p.person_code, where: cname(p.nationality), live: p.person_code };
    if (isB) Object.assign(x, { rec: `${p.w}-${p.l}-${p.d}`, ko: p.ko, sport: "Pro Boxing", div: "", extra: "No manager" });
    else x.extra = p.bouts_officiated + " bouts officiated";
    if (p.boxrec_id) x.boxrec = p.boxrec_id;
    if (nat) x.native = nat;
    DIR.people.push(x); LIVE[id] = x; return x;
  }
  function eventObj(e) {
    EVROW[e.event_code] = e;
    const id = "L" + e.event_code; if (LIVE[id]) return LIVE[id];
    const x = { id, real: true, name: e.name || [e.venue, e.city].filter(Boolean).join(", ") || "Event " + e.event_code, date: e.starts_on || "", venue: [e.venue, e.city].filter(Boolean).join(", ") || cname(e.country),
      promo: e.lead_promoter || "Not listed", comm: e.commission || e.commission_full || "Not listed", bouts: e.bouts, status: (e.starts_on || "") < new Date().toISOString().slice(0, 10) ? "Completed" : "Scheduled", fid: e.event_code, live: e.event_code };
    DIR.events.push(x); LIVE[id] = x; return x;
  }
  function boutObj(r) {
    [["side_a_code", "side_a_name"], ["side_b_code", "side_b_name"], ["referee_code", "referee_name"], ["judge1_code", "judge1_name"], ["judge2_code", "judge2_name"], ["judge3_code", "judge3_name"]].forEach(([c, n]) => { if (r[c] && r[n]) NAMES[r[c]] = r[n]; });
    return { code: r.match_code, event: r.event_code, ev: r, date: r.played_on || "", no: r.bout_no, div: r.division, sched: r.scheduled_rounds, min: r.minutes_per_round, a: r.side_a_code, b: r.side_b_code,
      outcome: r.outcome, win: r.winner_side, method: r.method, rd: r.ended_round, time: r.ended_time, ref: r.referee_code, j1: r.judge1_code, j1a: r.judge1_score_a, j1b: r.judge1_score_b,
      j2: r.judge2_code, j2a: r.judge2_score_a, j2b: r.judge2_score_b, j3: r.judge3_code, j3a: r.judge3_score_a, j3b: r.judge3_score_b, aw: r.side_a_weigh_in, bw: r.side_b_weigh_in, status: r.status, title: r.titles };
  }
  // ---------- search: add live people and events as the viewer types ----------
  let tmr = null, lastQ = "";
  async function doSearch(q) {
    lastQ = q;
    try {
      const res = (await rpc("fn_app_search", { q: q.replace(/[^\p{L}\p{N} .'-]/gu, " ").replace(/\s+/g, " ").trim() })) || {};
      const ps = res.people || [], es = res.events || [], cs = res.comms || [];
      let added = 0;
      ps.forEach(p => { if (!LIVE["L" + p.person_code]) added++; personObj(p); });
      if (KO) { ps.forEach(p => { const h = p.ko_name && pickHangul(p.ko_name); if (h) HG[p.person_code] = h; setLocal(p.person_code); }); added = added || ps.length; autoHangul(ps.map(p => p.person_code)); }
      es.forEach(e => { if (!LIVE["L" + e.event_code]) added++; eventObj(e); });
      cs.forEach(c => { if (!LIVE["LC" + c.org_code]) added++; commObj(c); });
      // refresh only the result list, so typing (and Korean/Japanese input) is never interrupted
      const box = document.getElementById("sres"), cur = document.getElementById("sq");
      if (added && box && cur && A.sResults) box.innerHTML = A.sResults();
      else if (added && !box) rerender();
    } catch (e) { fail(e); rerender(); }
  }
  document.addEventListener("input", ev => {
    if (!ev.target || ev.target.id !== "sq") return;
    const q = ev.target.value.trim();
    clearTimeout(tmr);
    if ((q.length < 2 && !/[^\x00-\x7f]/.test(q)) || !q || q === lastQ) return;
    tmr = setTimeout(() => doSearch(q), 200);
  }, true);
  // tapping a recent search runs it against the database too
  document.addEventListener("click", ev => {
    const t = ev.target && ev.target.closest && ev.target.closest('[data-act="srecent"]');
    if (t && t.dataset.v) setTimeout(() => doSearch(t.dataset.v.trim()), 0);
  }, true);
  function commObj(c) {
    const id = "LC" + c.org_code; if (LIVE[id]) return LIVE[id];
    const x = { id, real: true, org: c.org_code, name: c.short_name || c.name, full: c.name || c.short_name, where: cname(c.country), sports: "Pro Boxing", extra: c.events + " events on record" };
    DIR.comms.push(x); LIVE[id] = x; return x;
  }
  // ---------- loaders ----------
  const LOADING = {};
  // ---------- Korean script names (Korean UI only) ----------
  // Recorded Hangul names come from the database (person_names). When none is recorded, Claude
  // writes a phonetic Hangul version on this device, marked "자동" and never saved to the database.
  const HG = {}, KONAME = {}; let HGAUTO = {};
  try { localStorage.removeItem("fnKoNamesAuto"); } catch (e) { }
  try { HGAUTO = JSON.parse(localStorage.getItem("fnKoNamesAuto2") || "{}") || {}; } catch (e) { }
  // names arrive in English order (given names first, family name last)
  const HANGUL_RULES = "Names are given in English order: given name(s) first, family name last. " +
    "For Korean people (nationality KR or KP) write the real Korean name: family name first, then the given name written together with no space, e.g. 'Ki Seong Kang' -> '강기성', 'Joo Young Kim' -> '김주영'. " +
    "For Japanese, Chinese, Taiwanese, Hong Kong and Macau people (JP, CN, TW, HK, MO) put the family name first, the way Korean media writes them, e.g. 'Naoya Inoue' -> '이노우에 나오야'. " +
    "For everyone else keep the English order and spell the name by standard Korean loanword transliteration (외래어 표기법), parts separated by a space, e.g. 'Manny Pacquiao' -> '매니 파퀴아오'. Hangul only.";
  const saveAuto = () => { try { localStorage.setItem("fnKoNamesAuto2", JSON.stringify(HGAUTO)); } catch (e) { } };
  const pickHangul = n => { const parts = String(n).split("|").map(t => t.trim()).filter(t => /[가-힣]/.test(t)); return parts[0] || ""; };
  let SAMPLE = null; const sampleReady = (window.claude && window.claude.use ? window.claude.use("sample") : Promise.resolve(null)).then(m => (SAMPLE = m)).catch(() => null);
  async function loadHangul(code) {
    if (!KO || HG[code] || HGAUTO[code]) return;
    if (KONAME[code] === undefined) return;
    const n = KONAME[code] && pickHangul(KONAME[code]);
    if (n) { HG[code] = n; return; }
    await sampleReady; if (!SAMPLE) return;
    const p = PEOPLE[code] || {}, name = p.display_name || NAMES[code]; if (!name) return;
    try {
      const out = await SAMPLE.json(`Write this boxer's name in Korean Hangul the way Korean sports media would spell it. ${HANGUL_RULES}\nName: ${name}\nNationality (ISO code): ${p.nationality || "unknown"}\nReply with JSON only: {"hangul": "..."}`, { modelTier: "quick" });
      const h = out && String(out.hangul || "").trim();
      if (h && /^[가-힣 ·-]+$/.test(h)) { HGAUTO[code] = h; saveAuto(); }
    } catch (e) { console.warn("Fannet Hangul name:", e); }
  }
  // the person's name in the app language's script, shown on the search result's second line
  function setLocal(code) { const x = LIVE["L" + code], h = HG[code] || HGAUTO[code]; if (x && h) x.local = h; }
  function refreshResults() { const box = document.getElementById("sres"); if (box && document.getElementById("sq") && A.sResults) box.innerHTML = A.sResults(); }
  // one Claude call writes Hangul for every result that has none recorded (kept on this device only)
  const AUTO_ASKED = new Set();
  async function autoHangul(codes) {
    const need = codes.filter(c => !HG[c] && !HGAUTO[c] && !AUTO_ASKED.has(c) && PEOPLE[c]).slice(0, 30);
    if (!need.length) return; need.forEach(c => AUTO_ASKED.add(c));
    await sampleReady; if (!SAMPLE) return;
    try {
      const list = need.map(c => ({ id: c, name: PEOPLE[c].display_name, nationality: PEOPLE[c].nationality || "" }));
      const out = await SAMPLE.json(`Write each boxer's name in Korean Hangul the way Korean sports media would spell it. ${HANGUL_RULES}\nPeople: ${JSON.stringify(list)}\nReply with JSON only: {"<id>": "<hangul>", ...}`, { modelTier: "quick" });
      let n = 0;
      if (out && typeof out === "object") need.forEach(c => { const h = String(out[c] || "").trim(); if (h && /^[가-힣 ·-]+$/.test(h)) { HGAUTO[c] = h; setLocal(c); n++; } });
      if (n) { saveAuto(); refreshResults(); }
    } catch (e) { console.warn("Fannet Hangul names:", e); }
  }
  // under the name: the Korean-script name in Korean mode (never the Fannet ID there), the Fannet ID in English
  const idLabel = x => { const c = x.live; if (KO) return esc(HG[c] || HGAUTO[c] || ""); return esc(x.fid); };
  const subj = (...parts) => parts.filter(Boolean).join(" · ");
  async function loadPerson(code) {
    if (LOADING[code]) return; LOADING[code] = 1;
    try {
      CODE(code);
      const r = (await rpc("fn_app_person", { code })) || {};
      if (r.person) { PEOPLE[code] = Object.assign(PEOPLE[code] || {}, r.person); NAMES[code] = r.person.display_name; }
      KONAME[code] = r.ko_name || "";
      BOUTS[code] = (r.bouts || []).map(boutObj);
      OFFBOUTS[code] = (r.officiated || []).map(x => [x.referee_code === code ? "Referee" : "Judge", boutObj(x)]);
      (r.opponents || []).forEach(x => { PEOPLE[x.person_code] = Object.assign(PEOPLE[x.person_code] || {}, x); NAMES[x.person_code] = x.display_name; });
      (r.bouts || []).forEach(b => { if (!EVOFF[b.event_code]) EVOFF[b.event_code] = []; });
      const seen = new Set(); (r.event_officials || []).forEach(o => { const k = o.event_code + o.role + o.name; if (seen.has(k)) return; seen.add(k); (EVOFF[o.event_code] = EVOFF[o.event_code] || []).push(o); });
      if (KO) loadHangul(code).then(rerender).catch(e => console.warn("Fannet Hangul name:", e));
    } catch (e) { fail(e); } finally { LOADING[code] = 2; rerender(); }
  }
  async function loadEvent(code) {
    if (LOADING[code]) return; LOADING[code] = 1;
    try {
      CODE(code);
      const r = (await rpc("fn_app_event", { code })) || {};
      if (r.event && !EVROW[code]) EVROW[code] = r.event;
      EVB[code] = (r.bouts || []).map(boutObj); EVOFF[code] = r.officials || [];
      (r.people || []).forEach(x => { PEOPLE[x.person_code] = Object.assign(PEOPLE[x.person_code] || {}, x); NAMES[x.person_code] = x.display_name; });
    } catch (e) { fail(e); } finally { LOADING[code] = 2; rerender(); }
  }
  // ---------- rendering ----------
  const resFor = (b, me) => b.outcome === "win" ? ((b.win === "A") === (b.a === me) ? "W" : "L") : b.outcome === "draw" ? "D" : b.outcome === "no_contest" ? "NC" : "";
  const recOf = c => { const p = PEOPLE[c]; return p && p.bouts > 0 ? `${p.w}-${p.l}-${p.d}` : ""; };
  // commission as "full name (ABBR)"; in Korean the full name comes from the page dictionary
  function commLabel(full, ab) {
    if (!full && !ab) return "Not listed";
    if (!full) return ab;
    let t = full;
    if (KO) { try { const d = window.FN_I18N && window.FN_I18N[full]; if (d && d[0]) t = d[0]; } catch (e) { } }
    return ab && ab !== full && !t.includes("(" + ab + ")") ? `${t} (${ab})` : t;
  }
  const kv = (a, v) => `<div class="kv"><span>${a}</span><b>${esc(String(v))}</b></div>`;
  const src = () => `<div class="meta" style="margin:12px 2px 0;font-size:12px">${STATE.mode === "blocked" ? `<b style="color:#b42318">Could not reach the Fannet database from this page.</b> ${esc(STATE.err)}` : "Live from the Fannet master database (read-only)."}</div>`;
  const loadingScreen = (title, x) => `${navbar(title)}${hHead(x, x.live ? idLabel(x) : (KO ? "" : esc(x.fid)))}<div class="card meta" style="margin-top:10px">${STATE.mode === "blocked" ? "Could not load records." : "Loading real records…"}</div>${src()}`;
  const methodText = (b, R) => {
    const m = b.method || "";
    const stop = b.rd && /KO|RTD|TD|DQ/.test(m);
    if (KO) {
      const word = { UD: "만장일치 판정", SD: "2-1 판정", MD: "다수 판정", PTS: "판정", TKO: "TKO", KO: "KO", RTD: "기권(RTD)", TD: "부상 판정", DQ: "실격", NC: "무효 경기" }[m] || m;
      const head = R === "W" ? "승리" : R === "L" ? "패배" : R === "D" ? "무승부" : R === "NC" ? "무효 경기" : "결과";
      return `${word && R !== "NC" ? word + " " : ""}${head}${stop ? `, ${b.rd}라운드${b.time ? " " + b.time : ""}` : ""}`;
    }
    const word = { UD: "unanimous decision", SD: "split decision", MD: "majority decision", PTS: "points", TKO: "TKO", KO: "KO", RTD: "retirement (RTD)", TD: "technical decision", DQ: "disqualification", NC: "no contest" }[m] || m || "result not recorded";
    const head = R === "W" ? "Won" : R === "L" ? "Lost" : R === "D" ? "Drew" : R === "NC" ? "No contest" : "Result";
    return `${head}${m ? " by " + word : ""}${stop ? `, round ${b.rd}${b.time ? " at " + b.time : ""}` : ""}`;
  };

  function expand(b, me) {
    const e = b.ev, R = resFor(b, me), opp = b.a === me ? b.b : b.a, meA = b.a === me;
    const js = [[b.j1, b.j1a, b.j1b], [b.j2, b.j2a, b.j2b], [b.j3, b.j3a, b.j3b]].filter(j => j[0] || j[1] != null);
    const offs = EVOFF[b.event] || [], offRow = role => offs.filter(o => o.role === role).map(o => o.name).join(", ");
    const rows = [["Commission", commLabel(e.commission_full, e.commission)], ["Promoter", e.lead_promoter || "Not listed"], ["Division", b.div || "Not listed"],
      ["Scheduled", b.sched ? `${b.sched} × ${b.min || 3} min` : "Not listed"], b.title ? ["Title", b.title] : null,
      b.aw || b.bw ? ["Weigh-in", `${(meA ? b.aw : b.bw) ?? "–"} kg / ${(meA ? b.bw : b.aw) ?? "–"} kg`] : null].filter(Boolean);
    const off = [["Referee", pn(b.ref)], ["Judges", js.map(j => pn(j[0])).filter(Boolean).join(", ")], ["Supervisor", offRow("supervisor")], ["Inspector", offRow("inspector")], ["Timekeeper", offRow("timekeeper")], ["Ringside doctor", offRow("doctor")], ["Matchmaker", offRow("matchmaker")]].filter(r => r[1]);
    const meN = (pn(me) || "").split(" ")[0], opN = (pn(opp) || "Opponent").split(" ")[0];
    const card = js.filter(j => j[1] != null || j[2] != null).map(j => { const a = meA ? j[1] : j[2], c = meA ? j[2] : j[1]; return `<tr><td>${esc(pn(j[0]) || "Judge")}</td><td class="${a > c ? "res-w" : a < c ? "res-l" : "res-d"}">${a ?? "–"}</td><td>${c ?? "–"}</td></tr>`; }).join("");
    return `<div class="hx"><div class="hx-res res-${(R || "d").toLowerCase()}">${methodText(b, R)}</div>
      ${rows.map(([a, v]) => kv(a, v)).join("")}
      ${off.length ? `<div class="hx-h">Officials</div>${off.map(([a, v]) => kv(a, v)).join("")}` : ""}
      ${card ? `<div class="hx-h">Scorecard</div><table class="sc"><thead><tr><th>Judge</th><th>${esc(meN)}</th><th>${esc(opN)}</th></tr></thead><tbody>${card}</tbody></table>` : `<div class="meta" style="margin-top:6px">No scorecards on record.</div>`}
      <div class="meta" style="margin-top:8px;font-size:12px">Fannet bout ${esc(b.code)} · event ${esc(b.event)}</div></div>`;
  }
  // last five bouts, most recent on the left: green win, red loss, blue draw, grey no contest
  const FORM_C = { W: "#2e7d32", L: "#c62828", D: "#2f5fd0", NC: "#8a8f98" };
  const FORM_T = KO ? { W: "승", L: "패", D: "무", NC: "무효" } : { W: "W", L: "L", D: "D", NC: "NC" };
  function form(played, me) {
    const last = played.slice(0, 5).map(b => resFor(b, me) || "NC");
    if (!last.length) return "–";
    return `<span style="display:inline-flex;gap:4px;vertical-align:middle">${last.map(r => `<span title="${r}" style="display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 3px;border-radius:5px;background:${FORM_C[r]};color:#fff;font-size:11.5px;font-weight:700;line-height:1">${FORM_T[r]}</span>`).join("")}</span>`;
  }
  // a person's name that opens their own profile (fight history or officiating record)
  function plink(code, fallback) {
    const p = code && PEOPLE[code];
    if (!p || !p.display_name) return esc(pn(code) || fallback);
    personObj(p);
    return `<span role="link" tabindex="0" data-act="sdet" data-k="people" data-id="L${esc(code)}" style="text-decoration:underline;text-decoration-color:rgba(0,0,0,.25);text-underline-offset:3px;cursor:pointer">${esc(p.display_name)}</span>`;
  }
  function fighter(x, fwd) {
    const me = x.live, B = (BOUTS[me] || []).filter(b => b.status !== "cancelled");
    const p = PEOPLE[me] || {}, played = B.filter(b => b.status === "played"), wins = played.filter(b => resFor(b, me) === "W");
    let st = 0; const first = played[0] ? resFor(played[0], me) : ""; while (st < played.length && resFor(played[st], me) === first) st++;
    const list = A.hFilter === "all" ? B : B.filter(b => resFor(b, me) === A.hFilter);
    const w = p.w ?? 0, l = p.l ?? 0, d = p.d ?? 0, ko = p.ko ?? 0, div = (B.find(b => b.div) || {}).div || "";
    return `${navbar("Fight history")}
      ${hHead(x, subj(idLabel(x), "Pro Boxing", esc(div)))}
      <div class="srec" style="margin-top:10px"><div><b class="res-w">${w}</b><span>Wins</span></div><div><b class="res-l">${l}</b><span>Losses</span></div><div><b class="res-d">${d}</b><span>Draws</span></div><div><b>${ko}</b><span>KOs</span></div></div>
      <div class="card" style="margin-top:10px;padding-block:4px">${[["Bouts", B.length], [KO ? "승률/KO율" : "Win / KO rate", (w + l + d) ? `${Math.round(w / (w + l + d) * 100)}% / ${w ? Math.round(ko / w * 100) + "%" : "–"}` : "–"],
        ["Current streak", form(played, me)], ["Last fight", played[0] ? hDate(played[0].date) : "–"], ["Nationality", esc(x.where || "Not listed")]]
        .map(([a, v]) => `<div class="kv"><span>${a}</span><b>${v}</b></div>`).join("")}</div>
      <div class="chips" style="flex-wrap:nowrap;margin:14px 0 10px">${[["all", "All " + B.length], ["W", "Wins"], ["L", "Losses"], ["D", "Draws"]].map(([f, lb]) => `<button class="chip ${A.hFilter === f ? "on" : ""}" data-act="hf" data-f="${f}">${lb}</button>`).join("")}</div>
      <div style="display:grid;gap:8px">${list.map(b => {
        const i = B.indexOf(b), o = A.hOpen.has(i), R = resFor(b, me), opp = b.a === me ? b.b : b.a, e = b.ev, orec = recOf(opp);
        return `<div class="card hrow tap ${o ? "open" : ""}" data-act="hx" data-i="${i}" tabindex="0" aria-expanded="${o}"><div class="hres res-${(R || "d").toLowerCase()}">${R || "–"}</div><div style="min-width:0"><div class="row"><div class="title" style="font-size:15.5px">vs ${plink(opp, "Opponent not linked")}</div><span class="muted" style="font-size:13px;font-weight:600">${b.date ? hDate(b.date) : ""} <span class="chev">›</span></span></div><div class="meta">${orec ? wld(orec) + " · " : ""}${esc(b.method || (b.status === "scheduled" ? "Scheduled" : "–"))}${b.rd && /KO|RTD/.test(b.method || "") ? ` ${rOf(b.rd, b.sched)}` : b.sched ? `, ${rds(b.sched)}` : ""}</div><div class="meta" style="font-size:13px">${esc(e.event_name || "")}${e.event_name ? " · " : ""}${esc([e.venue, e.city].filter(Boolean).join(", "))}${e.commission ? " · " + esc(e.commission) : ""}</div></div>${o ? expand(b, me) : ""}</div>`;
      }).join("") || `<div class="card meta">No bouts in this filter.</div>`}</div>${src()}${fwd}`;
  }
  function official(x, fwd) {
    const L = OFFBOUTS[x.live] || [], roles = {}; L.forEach(([r]) => roles[r] = (roles[r] || 0) + 1);
    const p = PEOPLE[x.live] || {};
    return `${navbar(x.role)}${hHead(x, subj(idLabel(x), Object.entries(roles).map(([r, n]) => `${r} ${n}`).join(" · ") || x.role))}
      <div class="card" style="margin-top:10px;padding-block:4px">${kv("Nationality", x.where || "Not listed")}${kv("Bouts officiated", p.bouts_officiated ?? L.length)}</div>
      <div class="h2">Bouts officiated${L.length >= 300 ? " (latest 300)" : ""}</div><div class="card" style="padding-block:4px">${L.map(([r, b]) => `<div class="kv"><span><b style="font-weight:700">${esc(pn(b.a) || "–")} vs ${esc(pn(b.b) || "–")}</b><br><small class="muted">${esc(b.ev.event_name || [b.ev.venue, b.ev.city].filter(Boolean).join(", "))} · ${b.date ? hDate(b.date) : ""}${b.method ? " · " + esc(b.method) : ""}</small></span><b>${r}</b></div>`).join("") || `<div class="meta" style="padding:8px 0">No bouts on record.</div>`}</div>${src()}${fwd}`;
  }
  function eventScreen(x, fwd) {
    const code = x.live, card = (EVB[code] || []).slice().sort((p, q) => (q.no || 0) - (p.no || 0)), offs = EVOFF[code] || [], e = EVROW[code] || {};
    return `${navbar("Event")}${hHead({ name: x.name, venue: 1 }, `${x.date ? hDate(x.date) : ""} · ${esc(x.venue)}`)}
      <div class="card" style="margin-top:10px;padding-block:4px">${[["Promoter", x.promo], ["Commission", commLabel(e.commission_full, e.commission || (x.comm !== "Not listed" ? x.comm : ""))], ["Status", x.status], ["Fannet event", code]].map(([a, v]) => kv(a, v)).join("")}${offs.map(o => kv(o.role.replace("_", " ").replace(/^./, c => c.toUpperCase()), o.name || "")).join("")}</div>
      <div class="h2">Fight card · ${card.length} bouts</div><div style="display:grid;gap:8px">${card.map((b, i) => {
        const ra = recOf(b.a), rb = recOf(b.b);
        const res = b.outcome === "win" ? `${esc(pn(b.win === "A" ? b.a : b.b) || "")} won${b.method ? " · " + esc(b.method) : ""}${b.rd && /KO|RTD/.test(b.method || "") ? " R" + b.rd : ""}` : b.outcome === "draw" ? `Draw${b.method ? " · " + esc(b.method) : ""}` : b.outcome === "no_contest" ? "No contest" : b.status === "scheduled" ? "Scheduled" : "";
        return `<div class="card"><div class="row"><span class="muted" style="font-size:12.5px;font-weight:700">${i === 0 ? "MAIN EVENT" : "BOUT " + (b.no || "")} · ${esc(b.div || "–")}${b.sched ? " · " + b.sched + " rds" : ""}</span></div>${b.title ? `<div class="meta" style="font-size:12.5px">${esc(b.title)}</div>` : ""}<div class="row" style="margin-top:4px"><div><b>${plink(b.a, "Not linked")}</b><div class="meta">${ra ? wld(ra) : ""}</div></div><span class="muted">vs</span><div style="text-align:right"><b>${plink(b.b, "Not linked")}</b><div class="meta">${rb ? wld(rb) : ""}</div></div></div>${res ? `<div class="meta" style="margin-top:4px">${res}</div>` : ""}</div>`;
      }).join("")}</div>${src()}${fwd}`;
  }
  // a commission's own page: what it is and the real events it sanctioned
  const COMMEV = {};
  async function loadComm(code) {
    if (LOADING[code]) return; LOADING[code] = 1;
    try { COMMEV[code] = ((CODE(code), await rpc("fn_app_comm_events", { code })) || []).map(eventObj); }
    catch (e) { fail(e); } finally { LOADING[code] = 2; rerender(); }
  }
  function commScreen(x, fwd) {
    const evs = COMMEV[x.org] || [];
    return `${navbar("Commission")}${hHead({ name: x.name }, esc(commLabel(x.full, x.name)))}
      <div class="card" style="margin-top:10px;padding-block:4px">${kv("Region", x.where || "Not listed")}${kv("Sports", x.sports)}${kv(KO ? "기록된 이벤트" : "Events on record", x.extra.replace(/ events on record$/, ""))}</div>
      <div class="h2">Recent events${evs.length >= 40 ? " (latest 40)" : ""}</div><div style="display:grid;gap:8px">${evs.map(e => `<div class="card tap" data-act="sdet" data-k="events" data-id="${e.id}" tabindex="0"><div class="title" style="font-size:15.5px">${esc(e.name)}</div><div class="meta">${e.date ? hDate(e.date) : ""}${e.venue && e.venue !== e.name ? " · " + esc(e.venue) : ""}${e.bouts ? " · " + e.bouts + " bouts" : ""}</div></div>`).join("") || `<div class="card meta">No events on record.</div>`}</div>${src()}${fwd}`;
  }
  // ---------- Promoter: real commissions, venues and fighters when creating an event ----------
  let COMMS = null;
  const commText = c => c.short_name && c.name ? `${c.short_name} · ${KO && FN_KO_COMM[c.name] ? FN_KO_COMM[c.name] : c.name}` : (c.name || c.short_name || c.org_code);
  const FN_KO_COMM = { "Korea Boxing Commission": "한국권투위원회", "Japan Boxing Commission": "일본 복싱 커미션", "Games and Amusements Board": "필리핀 경기오락커미션" };
  function applyComms() {
    if (!A.COMMISSIONS || !COMMS || !COMMS.length) return;
    A.COMMISSIONS["Pro Boxing"] = COMMS.map(commText);   // only real sanctioning bodies for boxing
    try { const S0 = A.S; if (S0 && S0.home && !A.COMMISSIONS["Pro Boxing"].includes(S0.home["Pro Boxing"])) S0.home["Pro Boxing"] = A.COMMISSIONS["Pro Boxing"][0]; } catch (e) { }
  }
  let REGION_EN = null; try { REGION_EN = new Intl.DisplayNames(["en"], { type: "region" }); } catch (e) { }
  const enCountry = c => { if (!c) return ""; if (c === "KR") return "South Korea"; try { return (REGION_EN && REGION_EN.of(c)) || c; } catch (e) { return c; } };
  function installPromoter() {
    if (!A.SCREENS || !A.ROSTER || !A.VENUES || !A.DIV) return;
    const { SCREENS, ROSTER, VENUES, DIV } = A;
    // commissions (the MCP path loads them here; the REST path in the connection check)
    mcpReady.then(m => { if (m) rpc("fn_app_commissions", {}).then(r => { COMMS = r || []; applyComms(); }).catch(fail); });
    // venues: search the database as the promoter types, add the matches to the venue list
    let vt = null, vLast = "";
    document.addEventListener("input", ev => {
      const el = ev.target; if (!el || el.id !== "ce-venue" || ev.fnReplay) return;
      const q = el.value.trim(); clearTimeout(vt); if (q.length < 2 || q === vLast) return;
      vt = setTimeout(async () => {
        vLast = q;
        try {
          const rows = (await rpc("fn_app_venues", { q })) || []; let n = 0;
          rows.forEach(v => { const id = "V" + v.venue_code; if (VENUES.some(x => x.id === id)) return;
            VENUES.unshift({ id, name: v.name, city: v.city || "", ctry: enCountry(v.country), real: true }); n++; });
          const cur = document.getElementById("ce-venue");
          if (n && cur) { const e2 = new Event("input", { bubbles: true }); e2.fnReplay = true; cur.dispatchEvent(e2); }
        } catch (e) { fail(e); }
      }, 250);
    }, true);
    // fighters: the Pick corner list shows fighters from the database for the bout's division
    const DIVI = {}; DIV.forEach((d, i) => DIVI[d[0]] = i);
    const RF = {}, BYKEY = {}, LOADK = {}; let NEXT = 500000;
    const realF = (r, g) => {                     // one pick-list entry per fighter and gender list
      const key = r.person_code + ":" + g; if (RF[key]) return RF[key];
      const name = KO && r.ko_name && pickHangul(r.ko_name) ? pickHangul(r.ko_name) : showName(r);
      const f = { id: NEXT++, n: name, en: r.display_name, g, d: DIVI[r.division], w: +r.w || 0, l: +r.l || 0, dr: +r.d || 0, ko: +r.ko || 0, cty: r.nationality || "", mgr: null, kyc: true, code: r.person_code, real: true };
      RF[key] = f; ROSTER.push(f); PEOPLE[r.person_code] = Object.assign(PEOPLE[r.person_code] || {}, r); return f;
    };
    // Korean mode: Korean boxers show their Korean name; when none is recorded, Claude writes one (kept on this device)
    const showName = r => KO && (HG[r.person_code] || HGAUTO[r.person_code]) || r.display_name;
    async function koNames(rows) {
      if (!KO) return;
      rows.forEach(r => { const h = r.ko_name && pickHangul(r.ko_name); if (h) HG[r.person_code] = h; });
      const need = rows.filter(r => (r.nationality === "KR" || r.nationality === "KP") && !HG[r.person_code] && !HGAUTO[r.person_code]).map(r => r.person_code);
      for (let i = 0; i < need.length; i += 30) await autoHangul(need.slice(i, i + 30));
      let n = 0; Object.values(RF).forEach(f => { const r = { person_code: f.code, display_name: f.en || f.n }; const nm = showName(r); if (nm !== f.n) { f.en = f.en || f.n; f.n = nm; n++; } });
      if (n && A.nav && (A.nav[A.nav.length - 1] || {}).s === "pick") { const y = (document.getElementById("view") || {}).scrollTop; rerender(); const v = document.getElementById("view"); if (v) v.scrollTop = y; }
    }
    const fits = (r, g) => r.division in DIVI && (!r.gender || (g === "F" ? r.gender === "female" : r.gender === "male"));
    async function loadPick(g, d) {
      const k = g + ":" + d; if (LOADK[k]) return; LOADK[k] = 1;
      const names = DIV.map(x => x[0]).filter((_, i) => Math.abs(i - d) <= 2);
      try { const rows = (await rpc("fn_app_fighters", { divs: names, q: null })) || []; BYKEY[k] = rows.filter(r => fits(r, g)).map(r => realF(r, g)); koNames(rows); }
      catch (e) { fail(e); BYKEY[k] = []; } finally { LOADK[k] = 2; rerender(); }
    }
    const SEARCHED = {};
    const origPick = SCREENS.pick;
    SCREENS.pick = function () {
      const dr = A.draft; if (!dr) return origPick.apply(this, arguments);
      const k = dr.g + ":" + dr.d; if (LOADK[k] !== 2) loadPick(dr.g, dr.d);
      const list = (BYKEY[k] || []).concat(SEARCHED[k] || []);
      const keep = ROSTER.splice(0, ROSTER.length);              // show only database fighters while drawing the list
      const other = dr.red && keep.find(f => f.id === dr.red), other2 = dr.blue && keep.find(f => f.id === dr.blue);
      [...new Set(list.concat([other, other2].filter(Boolean)))].forEach(f => ROSTER.push(f));
      let html;
      try { html = origPick.apply(this, arguments); } finally { ROSTER.splice(0, ROSTER.length); keep.forEach(f => ROSTER.push(f)); }
      const note = LOADK[k] !== 2 ? (KO ? "Fannet 데이터베이스에서 선수를 불러오는 중…" : "Loading fighters from the Fannet database…")
        : (KO ? "Fannet 데이터베이스의 선수입니다. 최근 경기 순. 이름으로 검색하면 전체 데이터베이스에서 찾습니다." : "Fighters from the Fannet database, most recently active first. Search by name to look across the whole database.");
      return html.replace(/(<div class="alert a-info"[^>]*>)/, `<div class="alert a-info" style="margin-bottom:10px">${note}</div>$1`);
    };
    // name search in Pick reaches the whole database (any division)
    let pt = null;
    document.addEventListener("input", ev => {
      const el = ev.target; if (!el || el.id !== "pk-q" || ev.fnReplay) return;
      const q = el.value.trim(); clearTimeout(pt); if (q.length < 2 && !/[^\x00-\x7f]/.test(q)) return;
      pt = setTimeout(async () => {
        const dr = A.draft; if (!dr) return; const k = dr.g + ":" + dr.d;
        try {
          const rows = (await rpc("fn_app_fighters", { divs: null, q })) || [];
          koNames(rows);
          const add = rows.filter(r => r.division in DIVI && (!r.gender || (dr.g === "F" ? r.gender === "female" : r.gender === "male"))).map(r => realF(r, dr.g));
          const have = new Set((BYKEY[k] || []).concat(SEARCHED[k] || []).map(f => f.id)), fresh = add.filter(f => !have.has(f.id));
          if (!fresh.length) return;
          SEARCHED[k] = (SEARCHED[k] || []).concat(fresh);
          rerender();
          const n = document.getElementById("pk-q");
          if (n) { n.value = q; n.focus(); const e2 = new Event("input", { bubbles: true }); e2.fnReplay = true; n.dispatchEvent(e2); }
        } catch (e) { fail(e); }
      }, 300);
    }, true);
  }
  // ---------- Fan: real events at the top of the Events tab ----------
  let FEED = null, FEEDL = 0;
  function installFanEvents() {
    if (!A.SCREENS || !A.SCREENS.events || A.ROSTER) return;     // the fan app only (the promoter app has its own events)
    const origEv = A.SCREENS.events;
    A.SCREENS.events = function () {
      const html = origEv.apply(this, arguments);
      if (!FEEDL) { FEEDL = 1; rpc("fn_app_events_feed", {}).then(r => { FEED = r || { upcoming: [], recent: [] }; (FEED.upcoming || []).concat(FEED.recent || []).forEach(eventObj); }).catch(e => { fail(e); FEED = { upcoming: [], recent: [] }; }).finally(() => { FEEDL = 2; rerender(); }); }
      const card = e => { const x = eventObj(e); return `<div class="card tap" data-act="sdet" data-k="events" data-id="${x.id}" tabindex="0"><div class="row"><span class="pill p-violet">${esc(e.commission || "Pro Boxing")}</span><span class="muted" style="font-size:13px;font-weight:600">${e.starts_on ? hDate(e.starts_on) : ""}</span></div><div class="title" style="margin-top:8px;font-size:17px">${esc(x.name)}</div><div class="meta">${esc(((v => v && v !== x.name ? v : "")([e.venue, e.city].filter(Boolean).join(", ")) || cname(e.country)))} · ${KO ? e.bouts + "경기" : e.bouts + " bout" + (e.bouts == 1 ? "" : "s")}</div></div>`; };
      const sec = FEEDL !== 2 ? `<div class="card meta">${KO ? "실제 이벤트 불러오는 중…" : "Loading real events…"}</div>`
        : `${FEED.upcoming.length ? `<div class="h2">${KO ? "예정된 이벤트" : "Upcoming"}</div><div class="stack">${FEED.upcoming.map(card).join("")}</div>` : ""}
           <div class="h2">${KO ? "최근 결과" : "Recent results"}</div><div class="stack">${FEED.recent.map(card).join("") || `<div class="card meta">${KO ? "이벤트가 없습니다." : "No events."}</div>`}</div>
           <div class="h2" style="margin-top:18px">${KO ? "팬 펀딩 데모 이벤트" : "Fan funding demo events"}</div>`;
      const mark = "<h1>Events</h1><div></div></div>";
      const i = html.indexOf(mark);
      return i < 0 ? html : html.slice(0, i + mark.length) + `<div style="margin-bottom:14px">${sec}</div>` + html.slice(i + mark.length);
    };
  }
  // ---------- Boxer names anywhere in the app open a profile on top, and Back returns to the same spot ----------
  // The profile is a layer over the phone screen: the screen underneath (its scroll position, an open
  // sheet) is left untouched, so closing the layer puts the organizer exactly where they were.
  function installProfileLinks() {
    const phone = document.getElementById("phone") || document.querySelector(".phone"); if (!phone) return;
    const st = document.createElement("style");
    st.textContent = ".fn-pl{text-decoration:underline;text-decoration-color:rgba(0,0,0,.28);text-underline-offset:3px;cursor:pointer}" +
      "#fn-ov{position:absolute;inset:0;z-index:70;background:var(--white,#fff);display:flex;flex-direction:column}#fn-ov .fn-ovv{flex:1;overflow:auto;padding:0 16px 24px}";
    document.head.appendChild(st);
    // who can be linked: fighters the app knows (database fighters in pick lists, and the demo fighters with their card info)
    let MAP = {}, RE = null, SIG = "";
    function buildMap() {
      const m = {};
      // Korean names are often just 3 letters (박주영), so the length floor only applies to Latin names
      const add = (name, v) => { if (name && typeof name === "string" && (name.length > 3 || (/[가-힣]/.test(name) && name.length >= 2)) && !m[name]) m[name] = v; };
      (A.ROSTER || []).forEach(f => add(f.n, f.code ? { code: f.code } : { demo: true, rec: `${f.w}-${f.l}-${f.dr}`, ko: f.ko, div: A.DIV && A.DIV[f.d] ? A.DIV[f.d][0] : "", from: f.cty }));
      [A.FX, A.MFX].forEach(X => X && Object.values(X).forEach(f => f && f.rec && add(f.name, { demo: true, rec: f.rec, ko: f.ko, div: f.div, from: f.from })));
      (DIR.people || []).forEach(x => { if (x.real || x.role !== "Fighter" || !x.rec) return; add(x.name, { demo: true, rec: x.rec, ko: x.ko, div: x.div, from: x.where }); });
      const sig = Object.keys(m).join("|");   // names change in place (e.g. a Korean name arrives), so compare the names themselves
      if (sig === SIG) return; SIG = sig; MAP = m;
      const keys = Object.keys(m).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      RE = keys.length ? new RegExp("(^|[^A-Za-z\u00C0-\u024F가-힣])(" + keys.join("|") + ")(?![A-Za-z\u00C0-\u024F가-힣])") : null;
    }
    const SKIP = /^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION|BUTTON|H1)$/;
    const skip = el => { for (; el && el !== phone; el = el.parentElement) { if (SKIP.test(el.tagName) || el.id === "fn-ov" || (el.classList && (el.classList.contains("fn-pl") || el.classList.contains("navbar") || el.classList.contains("chip") || el.classList.contains("tabs")))) return true; } return false; };
    function wrap(n) {
      if (!RE || !n.nodeValue) return; const p = n.parentElement; if (!p || skip(p)) return;
      // a name the name-variant script already wrapped
      const ln = p.closest && p.closest(".fn-ln"); if (ln) { const k = ln.getAttribute("data-n"); if (MAP[k] && !ln.classList.contains("fn-pl")) { ln.classList.add("fn-pl"); ln.setAttribute("data-pn", k); } return; }
      const mm = n.nodeValue.match(RE); if (!mm) return;
      const at = mm.index + mm[1].length, rest = n.splitText(at), after = rest.splitText(mm[2].length);
      const w = document.createElement("span"); w.className = "fn-pl"; w.setAttribute("data-pn", mm[2]); w.setAttribute("role", "link");
      p.insertBefore(w, rest); w.appendChild(rest); wrap(after);
    }
    function scan(root) {
      buildMap(); if (!RE || !root) return;
      if (root.nodeType === 3) return wrap(root);
      if (root.nodeType !== 1 || skip(root)) return;
      root.querySelectorAll && root.querySelectorAll(".fn-ln:not(.fn-pl)").forEach(el => { const k = el.getAttribute("data-n"); if (MAP[k]) { el.classList.add("fn-pl"); el.setAttribute("data-pn", k); } });
      const tw = document.createTreeWalker(root, 4), a = []; let t; while ((t = tw.nextNode())) a.push(t); a.forEach(wrap);
    }
    let pend = false;
    new MutationObserver(() => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; scan(document.getElementById("view")); scan(document.getElementById("sheetHost")); }); })
      .observe(phone, { childList: true, subtree: true, characterData: true });
    setTimeout(() => { scan(document.getElementById("view")); scan(document.getElementById("sheetHost")); }, 300);

    // the layer
    const STACK = []; let OPEN = new Set();
    function close() { STACK.pop(); OPEN = new Set(); if (STACK.length) draw(); else { const o = document.getElementById("fn-ov"); if (o) o.remove(); } }
    function open(item) { STACK.push(item); OPEN = new Set(); draw(true); if (item.code && LOADING["ov:" + item.code] !== 2) ovLoad(item.code); }
    async function ovLoad(code) {
      if (LOADING["ov:" + code]) return; LOADING["ov:" + code] = 1;
      try {
        CODE(code); const r = (await rpc("fn_app_person", { code })) || {};
        if (r.person) { PEOPLE[code] = Object.assign(PEOPLE[code] || {}, r.person); NAMES[code] = r.person.display_name; }
        KONAME[code] = r.ko_name || ""; const h = r.ko_name && pickHangul(r.ko_name); if (h) HG[code] = h;
        BOUTS[code] = (r.bouts || []).map(boutObj);
        (r.opponents || []).forEach(x => { PEOPLE[x.person_code] = Object.assign(PEOPLE[x.person_code] || {}, x); NAMES[x.person_code] = x.display_name; });
        (r.bouts || []).forEach(b => { if (!EVOFF[b.event_code]) EVOFF[b.event_code] = []; });
        const seen = new Set(); (r.event_officials || []).forEach(o => { const k = o.event_code + o.role + o.name; if (seen.has(k)) return; seen.add(k); (EVOFF[o.event_code] = EVOFF[o.event_code] || []).push(o); });
      } catch (e) { fail(e); } finally { LOADING["ov:" + code] = 2; draw(); }
    }
    const pnm = c => esc((KO && HG[c]) || pn(c) || (KO ? "연결 안 된 상대" : "Opponent not linked"));
    function body(it) {
      const back = `<div class="navbar"><button class="icon-btn" data-fnov="back" aria-label="Back">${(A.navbar("").match(/<svg[\s\S]*?<\/svg>/) || ["‹"])[0]}</button><h1>${KO ? "경기 이력" : "Fight history"}</h1><div></div></div>`;
      if (it.demo) {
        const [w, l, d] = String(it.rec || "0-0-0").split("-");
        const loc = KO && window.fnLocalName ? window.fnLocalName(it.name, "ko") : "";
        return `${back}${hHead({ name: it.name, role: "Fighter" }, subj(esc(loc), esc(KO ? (DIVKO_[it.div] || it.div || "") : it.div || ""), esc(it.from || "")))}
          <div class="srec" style="margin-top:10px"><div><b class="res-w">${w || 0}</b><span>${KO ? "승리" : "Wins"}</span></div><div><b class="res-l">${l || 0}</b><span>${KO ? "패" : "Losses"}</span></div><div><b class="res-d">${d || 0}</b><span>${KO ? "무승부" : "Draws"}</span></div><div><b>${it.ko ?? 0}</b><span>KO</span></div></div>
          <div class="card meta" style="margin-top:12px">${KO ? "데모 선수입니다. Fannet 데이터베이스에 경기 기록이 없습니다." : "Demo fighter. There are no fight records for this person in the Fannet database."}</div>`;
      }
      const me = it.code, p = PEOPLE[me] || {};
      if (LOADING["ov:" + me] !== 2) return `${back}${hHead({ name: it.name, role: "Fighter" }, KO ? esc(HG[me] || HGAUTO[me] || "") : esc(me))}<div class="card meta" style="margin-top:10px">${KO ? "실제 기록 불러오는 중…" : "Loading real records…"}</div>`;
      const B = (BOUTS[me] || []).filter(b => b.status !== "cancelled"), played = B.filter(b => b.status === "played");
      const w = p.w ?? 0, l = p.l ?? 0, d = p.d ?? 0, ko = p.ko ?? 0, div = (B.find(b => b.div) || {}).div || "";
      const nm = p.display_name || it.name, loc = HG[me] || HGAUTO[me] || "";
      if (KO && !loc && !AUTO_ASKED.has(me)) autoHangul([me]).then(() => { if (STACK.length && STACK[STACK.length - 1].code === me) draw(); });
      return `${back}${hHead({ name: nm, role: "Fighter" }, subj(KO ? esc(loc) : esc(me), esc(KO ? (DIVKO_[div] || div) : div)))}
        <div class="srec" style="margin-top:10px"><div><b class="res-w">${w}</b><span>${KO ? "승리" : "Wins"}</span></div><div><b class="res-l">${l}</b><span>${KO ? "패" : "Losses"}</span></div><div><b class="res-d">${d}</b><span>${KO ? "무승부" : "Draws"}</span></div><div><b>${ko}</b><span>KO</span></div></div>
        <div class="card" style="margin-top:10px;padding-block:4px">${[[KO ? "경기" : "Bouts", B.length], [KO ? "승률/KO율" : "Win / KO rate", (w + l + d) ? `${Math.round(w / (w + l + d) * 100)}% / ${w ? Math.round(ko / w * 100) + "%" : "–"}` : "–"],
          [KO ? "현재 연속 기록" : "Current streak", form(played, me)], [KO ? "최근 경기" : "Last fight", played[0] ? hDate(played[0].date) : "–"], [KO ? "국적" : "Nationality", esc(cname(p.nationality) || "–")]].map(([a, v]) => `<div class="kv"><span>${a}</span><b>${v}</b></div>`).join("")}</div>
        <div class="h2">${KO ? "경기 기록" : "Bouts"}</div>
        <div style="display:grid;gap:8px">${B.map((b, i) => { const o = OPEN.has(i), R = resFor(b, me), opp = b.a === me ? b.b : b.a, e = b.ev, orec = recOf(opp);
          return `<div class="card hrow tap ${o ? "open" : ""}" data-fnx="${i}"><div class="hres res-${(R || "d").toLowerCase()}">${R ? (KO ? ({ W: "승", L: "패", D: "무", NC: "무효" })[R] : R) : "–"}</div><div style="min-width:0"><div class="row"><div class="title" style="font-size:15.5px">vs ${opp && PEOPLE[opp] ? `<span class="fn-pl" data-pcode="${esc(opp)}">${pnm(opp)}</span>` : pnm(opp)}</div><span class="muted" style="font-size:13px;font-weight:600">${b.date ? hDate(b.date) : ""}</span></div><div class="meta">${orec ? wld(orec) + " · " : ""}${esc(b.method || "–")}${b.rd && /KO|RTD/.test(b.method || "") ? " R" + b.rd : ""}</div><div class="meta" style="font-size:13px">${esc([e.venue, e.city].filter(Boolean).join(", "))}${e.commission ? " · " + esc(e.commission) : ""}</div></div>${o ? expand(b, me) : ""}</div>`; }).join("") || `<div class="card meta">${KO ? "경기 기록이 없습니다." : "No bouts on record."}</div>`}</div>`;
    }
    function draw(fresh) {
      let o = document.getElementById("fn-ov");
      if (!o) { o = document.createElement("div"); o.id = "fn-ov"; const stb = phone.querySelector(".status"); o.innerHTML = (stb ? stb.outerHTML : "") + `<div class="fn-ovv view"></div>`; phone.appendChild(o); }
      const v = o.querySelector(".fn-ovv"), y = fresh ? 0 : v.scrollTop; v.innerHTML = body(STACK[STACK.length - 1]); v.scrollTop = y;
    }
    // clicks: capture phase, before the page's own handlers
    document.addEventListener("click", ev => {
      const t = ev.target; if (!t || !t.closest) return;
      const inOv = t.closest("#fn-ov");
      const b = t.closest("[data-fnov]"); if (b) { ev.preventDefault(); ev.stopPropagation(); close(); return; }
      const pl = t.closest(".fn-pl");
      if (pl) {
        ev.preventDefault(); ev.stopPropagation();
        const code = pl.getAttribute("data-pcode");
        if (code) return open({ code, name: PEOPLE[code] && PEOPLE[code].display_name || pl.textContent });
        // same names are common (two 김민수): on a pick-list card, use that card's own fighter
        const card = pl.closest("[data-f]"), rf = card && A.ROSTER && A.ROSTER.find(f => f.id === +card.getAttribute("data-f"));
        if (rf && rf.code) return open({ code: rf.code, name: rf.en || rf.n });
        buildMap(); const k = pl.getAttribute("data-pn"), v = MAP[k]; if (!v) return;
        return open(Object.assign({ name: k }, v));
      }
      if (inOv) { const x = t.closest("[data-fnx]"); ev.stopPropagation(); if (x) { const i = +x.getAttribute("data-fnx"); OPEN.has(i) ? OPEN.delete(i) : OPEN.add(i); draw(); } }
    }, true);
  }
  // ---------- Korean mode: English dates, times and units left in the screens, written the Korean way ----------
  function installKoDates() {
    const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    const WD = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" };
    const M = "(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?", W = "(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*";  // matched ignoring case
    const mo = x => MON[x.slice(0, 3).toLowerCase()], wd = x => WD[x.slice(0, 3).toLowerCase()];
    const hm = (h, m, ap) => { ap = ap.toLowerCase(); return `${ap === "am" ? "오전" : "오후"} ${+h}${m ? ":" + m : "시"}`; };
    const RULES = [
      [new RegExp("\\b" + W + ",? (\\d{1,2}) " + M + "(?:,? (\\d{4}))?", "gi"), (a, w, d, m, y) => `${y ? y + "년 " : ""}${mo(m)}월 ${+d}일 (${wd(w)})`],
      [new RegExp("\\b(\\d{1,2}) ?[–-] ?(\\d{1,2}) " + M + "(?: (\\d{4}))?", "gi"), (a, d1, d2, m, y) => `${y ? y + "년 " : ""}${mo(m)}월 ${+d1}–${+d2}일`],
      [new RegExp("\\b(\\d{1,2}) " + M + "(?:,? (\\d{4}))?\\b", "gi"), (a, d, m, y) => `${y ? y + "년 " : ""}${mo(m)}월 ${+d}일`],
      [new RegExp("\\b" + M + " (\\d{1,2}),? (\\d{4})\\b", "gi"), (a, m, d, y) => `${y}년 ${mo(m)}월 ${+d}일`],
      [new RegExp("\\b" + M + " (\\d{4})\\b", "gi"), (a, m, y) => `${y}년 ${mo(m)}월`],
      [/\b(\d{1,2}):(\d{2}) ?(am|pm)\b/gi, (a, h, m, ap) => hm(h, m, ap)],
      [/\b(\d{1,2}) ?(am|pm)\b/gi, (a, h, ap) => hm(h, "", ap)],
      [/(\d+) ?min\b/g, "$1분"], [/(\d+) rds\b/g, "$1라운드"], [/(\d+) days?\b/g, "$1일"], [/(\d+) weeks?\b/g, "$1주"],
      [/(\d+)d ago\b/g, "$1일 전"], [/(\d+)m ago\b/g, "$1분 전"], [/\b[Kk]ick-off\b/g, "킥오프"], [/(오[전후] [\d:시]+) to (오[전후])/g, "$1 ~ $2"], [/\bDue\b/g, "마감"], [/(\d+)w ago\b/g, "$1주 전"], [/(\d+)h ago\b/g, "$1시간 전"], [/\bexpires\b/g, "만료"], [/\bdue\b/g, "마감"]];
    const fix = n => { const v = n.nodeValue; if (!v || !/[A-Za-z]/.test(v)) return; const el = n.parentElement; if (!el || el.closest("script,style,textarea,input,[data-noi18n],.fn-pl")) return;
      let t = v; RULES.forEach(([re, f]) => { t = t.replace(re, f); }); if (t !== v) n.nodeValue = t; };
    const walk = r => { if (!r) return; if (r.nodeType === 3) return fix(r); const tw = document.createTreeWalker(r, 4); let x; const a = []; while ((x = tw.nextNode())) a.push(x); a.forEach(fix); };
    const root = document.getElementById("phone") || document.body;
    let pend = false;
    new MutationObserver(() => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; walk(root); }); }).observe(root, { childList: true, subtree: true, characterData: true });
    walk(root);
  }
  const DIVKO_ = { "Super Bantamweight": "슈퍼 밴텀급", "Featherweight": "페더급", "Bantamweight": "밴텀급", "Flyweight": "플라이급", "Super Flyweight": "슈퍼 플라이급", "Super Featherweight": "슈퍼 페더급", "Lightweight": "라이트급", "Light Flyweight": "라이트 플라이급", "Super Lightweight": "슈퍼 라이트급", "Welterweight": "웰터급", "Minimumweight": "미니멈급", "Super Welterweight": "슈퍼 웰터급", "Middleweight": "미들급", "Super Middleweight": "슈퍼 미들급", "Light Heavyweight": "라이트 헤비급", "Heavyweight": "헤비급", "Cruiserweight": "크루저급" };
  const orig = A.orig;
  const live = function () {
    const nav = A.nav, top = nav[nav.length - 1] || {}, x = LIVE[top.id];
    if (x && x.org) {
      const fwd0 = `<button class="btn btn-red" style="margin-top:16px" data-act="sfwd" data-k="${top.k}" data-id="${top.id}">Forward</button>`;
      if (LOADING[x.org] !== 2) { loadComm(x.org); return `${navbar("Commission")}${hHead({ name: x.name }, esc(x.full))}<div class="card meta" style="margin-top:10px">${STATE.mode === "blocked" ? "Could not load records." : "Loading real records…"}</div>${src()}`; }
      return commScreen(x, fwd0);
    }
    if (!x || !x.live) return orig.apply(this, arguments);
    const fwd = `<button class="btn btn-red" style="margin-top:16px" data-act="sfwd" data-k="${top.k}" data-id="${top.id}">Forward</button>`;
    if (top.k === "events") { if (LOADING[x.live] !== 2) { loadEvent(x.live); return loadingScreen("Event", { name: x.name, venue: 1, fid: x.live }); } return eventScreen(x, fwd); }
    if (LOADING[x.live] !== 2) { loadPerson(x.live); return loadingScreen(x.role === "Fighter" ? "Fight history" : x.role, x); }
    return x.role === "Fighter" ? fighter(x, fwd) : official(x, fwd);
  };
  // connection check, so a blocked network shows up at once
  // (outside claude.ai the REST API is used, so only warn when that fails too)
  mcpReady.then(m => { if (!m) rpc("fn_app_commissions", {}).then(r => { STATE.mode = "live"; COMMS = r || []; applyComms(); }).catch(fail); });
  window.FN_LIVE = { STATE, PEOPLE, BOUTS, OFFBOUTS, EVB, LIVE, sql, rpc };
  try { installPromoter(); } catch (e) { console.warn("Fannet promoter data:", e); }
  try { installFanEvents(); } catch (e) { console.warn("Fannet fan events:", e); }
  try { installProfileLinks(); } catch (e) { console.warn("Fannet profile links:", e); }
  try { if (KO) installKoDates(); } catch (e) { console.warn("Fannet Korean dates:", e); }
  return live;
};
