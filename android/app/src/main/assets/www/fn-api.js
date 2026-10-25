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
  const lit = v => "'" + String(v).replace(/'/g, "''") + "'";
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
  const idLabel = x => { const c = x.live; if (KO && HG[c]) return esc(HG[c]); if (KO && HGAUTO[c]) return esc(HGAUTO[c]); return esc(x.fid); };
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
  const loadingScreen = (title, x) => `${navbar(title)}${hHead(x, x.live ? idLabel(x) : esc(x.fid))}<div class="card meta" style="margin-top:10px">${STATE.mode === "blocked" ? "Could not load records." : "Loading real records…"}</div>${src()}`;
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
      ${hHead(x, `${idLabel(x)} · Pro Boxing${div ? " · " + esc(div) : ""}`)}
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
    return `${navbar(x.role)}${hHead(x, `${idLabel(x)} · ${Object.entries(roles).map(([r, n]) => `${r} ${n}`).join(" · ") || x.role}`)}
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
  mcpReady.then(m => { if (!m) fail(new Error("Live data needs this page to be opened in claude.ai.")); });
  window.FN_LIVE = { STATE, PEOPLE, BOUTS, OFFBOUTS, EVB, LIVE, sql };
  return live;
};
