import { useState, useMemo } from "react";
import {
  Search,
  Plus,
  X,
  ChevronDown,
  Check,
  Pencil,
  Trash2,
  UserPlus,
  Settings,
  Award,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const CATEGORIES = [
  { id: "compulsory", label: "Compulsory", code: "CMP" },
  { id: "interest", label: "Interest — Group A", code: "INT" },
  { id: "adventure", label: "Adventure — Group B", code: "ADV" },
  { id: "community", label: "Community — Group C", code: "COM" },
  { id: "physical", label: "Physical — Group D", code: "PHY" },
];

const SECTIONS = ["Pre-Junior", "Junior", "Senior"];

let seq = 0;
const uid = (prefix) => {
  seq += 1;
  return `${prefix}_${seq}_${Date.now().toString(36)}`;
};

const req = (text) => ({ id: uid("r"), text });

const seedBadges = [
  // Compulsory
  {
    id: uid("b"),
    name: "Christian Education",
    category: "compulsory",
    level: null,
    requirements: [
      req("Attend Bible class / devotional sessions for the term"),
      req("Complete the term's scripture assignment"),
      req("Take part in one devotional or chapel duty"),
      req("Pass a short scripture assessment set by the Chaplain"),
    ],
  },
  {
    id: uid("b"),
    name: "Drill",
    category: "compulsory",
    level: null,
    requirements: [
      req("Attend the term's required drill parades"),
      req("Pass squad drill assessment"),
      req("Demonstrate correct word-of-command response"),
      req("Take a turn leading a squad in drill"),
    ],
  },
  {
    id: uid("b"),
    name: "Recruitment",
    category: "compulsory",
    level: null,
    requirements: [
      req("Introduce a prospective member to a Company activity"),
      req("Assist at one recruitment or open-company event"),
      req("Help welcome and orientate a new recruit"),
    ],
  },
  // Interest — Group A
  {
    id: uid("b"),
    name: "Arts & Crafts",
    category: "interest",
    level: "Basic",
    requirements: [
      req("Complete a term of craft sessions"),
      req("Produce two finished craft pieces"),
      req("Display or present work to the Officer-in-charge"),
    ],
  },
  {
    id: uid("b"),
    name: "Photography",
    category: "interest",
    level: "Basic",
    requirements: [
      req("Learn basic camera handling and composition"),
      req("Submit a portfolio of at least 6 photographs"),
      req("Take part in one Company photography assignment"),
    ],
  },
  {
    id: uid("b"),
    name: "Cooking",
    category: "interest",
    level: "Basic",
    requirements: [
      req("Attend cooking / food-preparation sessions"),
      req("Prepare a simple meal unsupervised for assessment"),
      req("Demonstrate basic kitchen hygiene and safety"),
    ],
  },
  {
    id: uid("b"),
    name: "Music",
    category: "interest",
    level: "Basic",
    requirements: [
      req("Attend band / music practice sessions for the term"),
      req("Perform a piece individually or with the Company band"),
      req("Show basic music theory or notation knowledge"),
    ],
  },
  // Adventure — Group B
  {
    id: uid("b"),
    name: "Camping",
    category: "adventure",
    level: "Basic",
    requirements: [
      req("Attend one Company camp overnight or longer"),
      req("Demonstrate tent pitching and campsite care"),
      req("Take a duty role during camp (cooking, watch, etc.)"),
      req("Practise basic campcraft and fire safety"),
    ],
  },
  {
    id: uid("b"),
    name: "Hiking & Expedition",
    category: "adventure",
    level: "Basic",
    requirements: [
      req("Complete a hike of the set minimum distance"),
      req("Read a map and compass correctly"),
      req("Pack and carry a day pack appropriate for the route"),
    ],
  },
  {
    id: uid("b"),
    name: "Cycling",
    category: "adventure",
    level: "Basic",
    requirements: [
      req("Demonstrate safe road cycling and hand signals"),
      req("Complete a ride of the set minimum distance"),
      req("Show basic bicycle maintenance (tyres, brakes, chain)"),
    ],
  },
  {
    id: uid("b"),
    name: "Water Activities",
    category: "adventure",
    level: "Basic",
    requirements: [
      req("Demonstrate basic water safety awareness"),
      req("Take part in one supervised water activity session"),
      req("Show correct use of a life jacket / PFD"),
    ],
  },
  // Community — Group C
  {
    id: uid("b"),
    name: "First Aid",
    category: "community",
    level: "Basic",
    requirements: [
      req("Complete basic first-aid training session"),
      req("Pass practical bandaging / CPR assessment"),
      req("Assist at one Company first-aid post or event"),
    ],
  },
  {
    id: uid("b"),
    name: "Community Service",
    category: "community",
    level: "Basic",
    requirements: [
      req("Complete the set minimum of community-service hours"),
      req("Take part in one organised outreach project"),
      req("Submit a short reflection on the service done"),
    ],
  },
  {
    id: uid("b"),
    name: "Citizenship",
    category: "community",
    level: "Basic",
    requirements: [
      req("Attend a talk or session on civic responsibility"),
      req("Take part in a flag-day or national-day activity"),
      req("Know key national symbols and the national anthem"),
    ],
  },
  {
    id: uid("b"),
    name: "Road Safety",
    category: "community",
    level: "Basic",
    requirements: [
      req("Attend a road safety briefing"),
      req("Demonstrate safe pedestrian / passenger practice"),
      req("Take part in a road-safety awareness activity"),
    ],
  },
  // Physical — Group D
  {
    id: uid("b"),
    name: "Sportsman",
    category: "physical",
    level: "Basic",
    requirements: [
      req("Participate regularly in the sport for one academic year"),
      req("Attend coaching / instructional sessions"),
      req("Show measurable improvement in personal performance"),
    ],
  },
  {
    id: uid("b"),
    name: "Physical Fitness",
    category: "physical",
    level: "Basic",
    requirements: [
      req("Pass the Company's basic fitness assessment"),
      req("Attend physical training sessions for the term"),
      req("Show improvement across a follow-up fitness test"),
    ],
  },
  {
    id: uid("b"),
    name: "Swimming",
    category: "physical",
    level: "Basic",
    requirements: [
      req("Swim the set minimum distance unaided"),
      req("Demonstrate basic water survival skills"),
      req("Pass a practical swim assessment by a qualified instructor"),
    ],
  },
  {
    id: uid("b"),
    name: "Games & Athletics",
    category: "physical",
    level: "Basic",
    requirements: [
      req("Take part in Company sports day or athletics events"),
      req("Learn and demonstrate the rules of at least two games"),
      req("Show good sportsmanship, assessed by the Officer-in-charge"),
    ],
  },
];

const seedMembers = [
  { id: uid("m"), name: "Ashley Anak Jelian", section: "Senior", rank: "Private", progress: {} },
  { id: uid("m"), name: "Muhammad Haziq", section: "Senior", rank: "Lance-Corporal", progress: {} },
  { id: uid("m"), name: "Timothy Wong", section: "Junior", rank: "—", progress: {} },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getBadgeState(member, badge) {
  const p = member.progress[badge.id] || { checked: {}, earned: false };
  const total = badge.requirements.length;
  const done = badge.requirements.filter((r) => p.checked[r.id]).length;
  const complete = total > 0 && done === total;
  const earned = p.earned || complete;
  return { checked: p.checked, earned, done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

function memberSummary(member, badges) {
  const total = badges.length;
  const earned = badges.filter((b) => getBadgeState(member, b).earned).length;
  return { earned, total };
}

function categoryFill(member, badges, categoryId) {
  const inCat = badges.filter((b) => b.category === categoryId);
  if (inCat.length === 0) return 0;
  const earned = inCat.filter((b) => getBadgeState(member, b).earned).length;
  return Math.round((earned / inCat.length) * 100);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function BadgeLedger() {
  const [companyName, setCompanyName] = useState("");
  const [badges, setBadges] = useState(seedBadges);
  const [members, setMembers] = useState(seedMembers);
  const [selectedId, setSelectedId] = useState(seedMembers[0].id);
  const [search, setSearch] = useState("");
  const [openCategory, setOpenCategory] = useState("compulsory");
  const [showAddMember, setShowAddMember] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  const selected = members.find((m) => m.id === selectedId) || members[0];

  const filteredMembers = useMemo(
    () =>
      members.filter((m) => m.name.toLowerCase().includes(search.trim().toLowerCase())),
    [members, search]
  );

  function toggleRequirement(badgeId, reqId) {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id !== selected.id) return m;
        const bp = m.progress[badgeId] || { checked: {}, earned: false };
        const checked = { ...bp.checked, [reqId]: !bp.checked[reqId] };
        return { ...m, progress: { ...m.progress, [badgeId]: { ...bp, checked } } };
      })
    );
  }

  function toggleEarnedOverride(badgeId) {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id !== selected.id) return m;
        const bp = m.progress[badgeId] || { checked: {}, earned: false };
        return { ...m, progress: { ...m.progress, [badgeId]: { ...bp, earned: !bp.earned } } };
      })
    );
  }

  function addMember(name, section, rank) {
    if (!name.trim()) return;
    const id = uid("m");
    setMembers((prev) => [...prev, { id, name: name.trim(), section, rank: rank.trim() || "—", progress: {} }]);
    setSelectedId(id);
    setShowAddMember(false);
  }

  function removeMember(id) {
    setMembers((prev) => {
      const next = prev.filter((m) => m.id !== id);
      if (selectedId === id && next.length) setSelectedId(next[0].id);
      return next;
    });
  }

  function addBadge(name, category, level) {
    if (!name.trim()) return;
    setBadges((prev) => [...prev, { id: uid("b"), name: name.trim(), category, level: level || null, requirements: [] }]);
  }

  function removeBadge(id) {
    setBadges((prev) => prev.filter((b) => b.id !== id));
  }

  function renameBadge(id, name) {
    setBadges((prev) => prev.map((b) => (b.id === id ? { ...b, name } : b)));
  }

  function addRequirement(badgeId, text) {
    if (!text.trim()) return;
    setBadges((prev) =>
      prev.map((b) => (b.id === badgeId ? { ...b, requirements: [...b.requirements, req(text.trim())] } : b))
    );
  }

  function removeRequirement(badgeId, reqId) {
    setBadges((prev) =>
      prev.map((b) =>
        b.id === badgeId ? { ...b, requirements: b.requirements.filter((r) => r.id !== reqId) } : b
      )
    );
  }

  const summary = selected ? memberSummary(selected, badges) : { earned: 0, total: 0 };

  return (
    <div className="bl-root">
      <style>{`
        .bl-root {
          --navy: #14213D;
          --navy-deep: #0E1830;
          --parchment: #F1E9D8;
          --parchment-line: #D9CBA8;
          --red: #A32638;
          --brass: #B8933E;
          --ink: #241F14;
          --paper-text: #EDE7D9;
          --muted: #8B93A8;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background: var(--navy);
          color: var(--paper-text);
          min-height: 640px;
          border-radius: 10px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 1px 0 rgba(255,255,255,0.05) inset;
        }
        .bl-root * { box-sizing: border-box; }
        .bl-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 18px 24px;
          background: var(--navy-deep);
          border-bottom: 1px solid rgba(184,147,62,0.35);
        }
        .bl-brand { display: flex; align-items: center; gap: 12px; }
        .bl-mark {
          width: 34px; height: 34px; border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #cba24f, var(--brass) 60%, #8a6c2c 100%);
          display: flex; align-items: center; justify-content: center;
          color: var(--navy-deep); flex-shrink: 0;
          box-shadow: 0 0 0 3px rgba(184,147,62,0.18);
        }
        .bl-brand-text h1 {
          font-family: Georgia, 'Iowan Old Style', serif;
          font-size: 17px; letter-spacing: 0.02em; margin: 0; color: var(--paper-text);
        }
        .bl-brand-text input {
          background: transparent; border: none; color: var(--muted);
          font-size: 12px; padding: 0; outline: none; width: 220px;
          font-family: inherit;
        }
        .bl-brand-text input::placeholder { color: #5C6480; }
        .bl-topbar-actions { display: flex; gap: 8px; }
        .bl-btn {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12.5px; font-weight: 600; letter-spacing: 0.02em;
          padding: 8px 12px; border-radius: 6px; border: 1px solid transparent;
          cursor: pointer; font-family: inherit; white-space: nowrap;
        }
        .bl-btn-red { background: var(--red); color: #F6E9EA; }
        .bl-btn-red:hover { background: #8f2130; }
        .bl-btn-ghost { background: transparent; color: var(--paper-text); border-color: rgba(237,231,217,0.25); }
        .bl-btn-ghost:hover { border-color: rgba(237,231,217,0.5); }
        .bl-body { display: flex; flex: 1; min-height: 0; }

        .bl-sidebar {
          width: 260px; flex-shrink: 0; background: var(--navy-deep);
          border-right: 1px solid rgba(184,147,62,0.25);
          display: flex; flex-direction: column;
        }
        .bl-search {
          margin: 14px; display: flex; align-items: center; gap: 8px;
          background: rgba(237,231,217,0.06); border: 1px solid rgba(237,231,217,0.15);
          border-radius: 6px; padding: 8px 10px;
        }
        .bl-search input {
          background: transparent; border: none; outline: none; color: var(--paper-text);
          font-size: 13px; width: 100%; font-family: inherit;
        }
        .bl-search input::placeholder { color: #6B7290; }
        .bl-roster { flex: 1; overflow-y: auto; padding: 0 8px 8px; }
        .bl-roster-item {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          padding: 10px 10px; border-radius: 6px; cursor: pointer; margin-bottom: 2px;
        }
        .bl-roster-item:hover { background: rgba(237,231,217,0.05); }
        .bl-roster-item.is-selected { background: rgba(184,147,62,0.16); }
        .bl-roster-main { min-width: 0; }
        .bl-roster-name {
          font-size: 13.5px; font-weight: 600; color: var(--paper-text);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .bl-roster-meta { font-size: 11px; color: var(--muted); margin-top: 2px; }
        .bl-roster-x {
          opacity: 0; background: none; border: none; color: var(--muted); cursor: pointer;
          padding: 4px; display: flex; flex-shrink: 0;
        }
        .bl-roster-item:hover .bl-roster-x { opacity: 1; }
        .bl-roster-x:hover { color: var(--red); }
        .bl-add-member {
          margin: 10px 14px 16px; display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 9px; border-radius: 6px; border: 1px dashed rgba(237,231,217,0.3);
          background: transparent; color: var(--muted); font-size: 12.5px; cursor: pointer; font-family: inherit;
        }
        .bl-add-member:hover { border-color: var(--brass); color: var(--brass); }

        .bl-main { flex: 1; min-width: 0; overflow-y: auto; padding: 24px 28px 40px; }
        .bl-empty { color: var(--muted); padding: 60px 0; text-align: center; }

        .bl-member-head {
          background: var(--parchment); color: var(--ink); border-radius: 8px;
          padding: 20px 22px; display: flex; align-items: flex-start; justify-content: space-between; gap: 18px;
          box-shadow: 0 6px 18px rgba(0,0,0,0.25);
        }
        .bl-member-name { font-family: Georgia, 'Iowan Old Style', serif; font-size: 21px; margin: 0 0 2px; }
        .bl-member-meta { font-size: 12.5px; color: #5B5240; letter-spacing: 0.02em; }
        .bl-member-progress { font-size: 12px; color: #5B5240; margin-top: 10px; }
        .bl-member-progress b { color: var(--ink); font-size: 13px; }

        .bl-sleeve { display: flex; gap: 8px; flex-shrink: 0; }
        .bl-patch {
          width: 40px; height: 46px; border-radius: 5px 5px 3px 3px;
          border: 1.5px solid #8a7752; position: relative; overflow: hidden;
          background: #E4D7B8;
          display: flex; align-items: flex-end; justify-content: center;
        }
        .bl-patch-fill {
          position: absolute; left: 0; right: 0; bottom: 0;
          background: linear-gradient(180deg, #d3ae5c, var(--brass));
        }
        .bl-patch-code {
          position: relative; font-size: 9px; font-weight: 700; letter-spacing: 0.03em;
          color: #4a3f22; margin-bottom: 4px;
        }

        .bl-categories { margin-top: 22px; display: flex; flex-direction: column; gap: 10px; }
        .bl-category { border: 1px solid rgba(184,147,62,0.25); border-radius: 8px; overflow: hidden; }
        .bl-category-head {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 12px 16px; cursor: pointer; background: rgba(237,231,217,0.03);
        }
        .bl-category-head:hover { background: rgba(237,231,217,0.06); }
        .bl-category-title { display: flex; align-items: center; gap: 10px; font-size: 13.5px; font-weight: 600; }
        .bl-category-code {
          font-size: 10px; font-weight: 700; color: var(--brass); border: 1px solid rgba(184,147,62,0.4);
          border-radius: 4px; padding: 2px 6px; letter-spacing: 0.04em;
        }
        .bl-category-frac { font-size: 12px; color: var(--muted); }
        .bl-chev { transition: transform 0.15s ease; color: var(--muted); }
        .bl-chev.is-open { transform: rotate(180deg); }
        .bl-category-body { padding: 4px 14px 14px; display: flex; flex-direction: column; gap: 10px; }
        .bl-no-badges { font-size: 12.5px; color: var(--muted); padding: 8px 2px; }

        .bl-badge-card { background: rgba(237,231,217,0.04); border: 1px solid rgba(237,231,217,0.1); border-radius: 7px; padding: 12px 14px; }
        .bl-badge-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
        .bl-badge-title { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 600; }
        .bl-badge-level { font-size: 10.5px; color: var(--muted); font-weight: 500; border: 1px solid rgba(237,231,217,0.2); border-radius: 4px; padding: 1px 6px; }
        .bl-earned-pill {
          display: flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700;
          padding: 4px 9px; border-radius: 20px; cursor: pointer; border: 1px solid transparent; font-family: inherit;
        }
        .bl-earned-pill.is-earned { background: rgba(184,147,62,0.22); color: var(--brass); border-color: rgba(184,147,62,0.5); }
        .bl-earned-pill.not-earned { background: transparent; color: var(--muted); border-color: rgba(237,231,217,0.2); }
        .bl-bar { height: 4px; background: rgba(237,231,217,0.1); border-radius: 3px; overflow: hidden; margin-bottom: 10px; }
        .bl-bar-fill { height: 100%; background: linear-gradient(90deg, #8a6c2c, var(--brass)); }
        .bl-req-list { display: flex; flex-direction: column; gap: 6px; }
        .bl-req-item { display: flex; align-items: center; gap: 9px; font-size: 12.5px; cursor: pointer; color: var(--paper-text); }
        .bl-req-box {
          width: 16px; height: 16px; border-radius: 4px; border: 1.5px solid rgba(237,231,217,0.35);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .bl-req-item.is-done .bl-req-box { background: var(--brass); border-color: var(--brass); }
        .bl-req-item.is-done span { color: var(--muted); text-decoration: line-through; }
        .bl-no-reqs { font-size: 12px; color: var(--muted); font-style: italic; }

        .bl-modal-overlay {
          position: fixed; inset: 0; background: rgba(6,10,22,0.6); backdrop-filter: blur(2px);
          display: flex; align-items: center; justify-content: center; z-index: 40; padding: 20px;
        }
        .bl-modal {
          background: var(--parchment); color: var(--ink); border-radius: 10px; width: 100%; max-width: 480px;
          max-height: 85vh; overflow-y: auto; padding: 22px 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.4);
        }
        .bl-modal-wide { max-width: 640px; }
        .bl-modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .bl-modal-head h2 { font-family: Georgia, serif; font-size: 18px; margin: 0; }
        .bl-modal-close { background: none; border: none; cursor: pointer; color: #5B5240; padding: 4px; }
        .bl-field { margin-bottom: 12px; }
        .bl-field label { display: block; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #6b5f42; margin-bottom: 5px; }
        .bl-field input, .bl-field select {
          width: 100%; padding: 9px 10px; border-radius: 6px; border: 1px solid #C9B98C;
          background: #FBF7EE; font-size: 13.5px; font-family: inherit; color: var(--ink); outline: none;
        }
        .bl-field input:focus, .bl-field select:focus { border-color: var(--brass); }
        .bl-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
        .bl-btn-solid { background: var(--navy); color: var(--paper-text); }
        .bl-btn-solid:hover { background: #1c2e52; }
        .bl-btn-line { background: transparent; color: #5B5240; border: 1px solid #C9B98C; }

        .bl-lib-badge { border: 1px solid #D9CBA8; border-radius: 7px; padding: 12px; margin-bottom: 10px; background: #FBF7EE; }
        .bl-lib-badge-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .bl-lib-badge-head input { flex: 1; border: none; background: transparent; font-size: 13.5px; font-weight: 700; padding: 3px 0; outline: none; border-bottom: 1px solid transparent; }
        .bl-lib-badge-head input:focus { border-bottom-color: var(--brass); }
        .bl-lib-tag { font-size: 10px; color: #7a6c47; border: 1px solid #C9B98C; border-radius: 4px; padding: 1px 6px; white-space: nowrap; }
        .bl-lib-del { background: none; border: none; color: #A32638; cursor: pointer; padding: 3px; }
        .bl-lib-reqs { display: flex; flex-direction: column; gap: 5px; margin-bottom: 8px; }
        .bl-lib-req { display: flex; align-items: center; gap: 6px; font-size: 12.5px; }
        .bl-lib-req span { flex: 1; }
        .bl-lib-req button { background: none; border: none; color: #9a8c63; cursor: pointer; padding: 2px; }
        .bl-lib-req button:hover { color: var(--red); }
        .bl-lib-add-req { display: flex; gap: 6px; }
        .bl-lib-add-req input {
          flex: 1; font-size: 12.5px; padding: 6px 8px; border-radius: 5px; border: 1px solid #D9CBA8; outline: none; background: #fff;
        }
        .bl-lib-add-req button {
          background: var(--navy); color: #fff; border: none; border-radius: 5px; padding: 0 10px; cursor: pointer;
        }
        .bl-lib-new {
          display: grid; grid-template-columns: 1.4fr 1fr 0.8fr auto; gap: 8px; align-items: end;
          border-top: 1px dashed #C9B98C; padding-top: 14px; margin-top: 4px;
        }
        .bl-lib-new label { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: #6b5f42; margin-bottom: 4px; }
        .bl-lib-new input, .bl-lib-new select { width: 100%; padding: 7px 8px; border-radius: 5px; border: 1px solid #C9B98C; font-size: 12.5px; background: #fff; }

        @media (max-width: 760px) {
          .bl-body { flex-direction: column; }
          .bl-sidebar { width: 100%; max-height: 200px; }
          .bl-member-head { flex-direction: column; }
        }
      `}</style>

      {/* Top bar */}
      <div className="bl-topbar">
        <div className="bl-brand">
          <div className="bl-mark"><Award size={17} /></div>
          <div className="bl-brand-text">
            <h1>Badge Ledger</h1>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Enter your Company name…"
            />
          </div>
        </div>
        <div className="bl-topbar-actions">
          <button className="bl-btn bl-btn-ghost" onClick={() => setShowLibrary(true)}>
            <Settings size={14} /> Badge library
          </button>
          <button className="bl-btn bl-btn-red" onClick={() => setShowAddMember(true)}>
            <UserPlus size={14} /> Add member
          </button>
        </div>
      </div>

      <div className="bl-body">
        {/* Sidebar roster */}
        <div className="bl-sidebar">
          <div className="bl-search">
            <Search size={14} color="#6B7290" />
            <input placeholder="Search roll…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="bl-roster">
            {filteredMembers.map((m) => {
              const s = memberSummary(m, badges);
              return (
                <div
                  key={m.id}
                  className={`bl-roster-item ${m.id === selectedId ? "is-selected" : ""}`}
                  onClick={() => setSelectedId(m.id)}
                >
                  <div className="bl-roster-main">
                    <div className="bl-roster-name">{m.name}</div>
                    <div className="bl-roster-meta">{m.section} · {s.earned}/{s.total} badges</div>
                  </div>
                  <button
                    className="bl-roster-x"
                    onClick={(e) => { e.stopPropagation(); removeMember(m.id); }}
                    title="Remove member"
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })}
            {filteredMembers.length === 0 && <div className="bl-no-badges">No members match “{search}”.</div>}
          </div>
          <button className="bl-add-member" onClick={() => setShowAddMember(true)}>
            <Plus size={13} /> Add member
          </button>
        </div>

        {/* Main panel */}
        <div className="bl-main">
          {!selected ? (
            <div className="bl-empty">Add a member to start tracking badges.</div>
          ) : (
            <>
              <div className="bl-member-head">
                <div>
                  <h2 className="bl-member-name">{selected.name}</h2>
                  <div className="bl-member-meta">{selected.section} Section · {selected.rank}</div>
                  <div className="bl-member-progress">
                    <b>{summary.earned}</b> of <b>{summary.total}</b> badges earned
                  </div>
                </div>
                <div className="bl-sleeve">
                  {CATEGORIES.map((c) => {
                    const fill = categoryFill(selected, badges, c.id);
                    return (
                      <div className="bl-patch" key={c.id} title={`${c.label}: ${fill}% complete`}>
                        <div className="bl-patch-fill" style={{ height: `${fill}%` }} />
                        <span className="bl-patch-code">{c.code}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bl-categories">
                {CATEGORIES.map((cat) => {
                  const catBadges = badges.filter((b) => b.category === cat.id);
                  const earnedInCat = catBadges.filter((b) => getBadgeState(selected, b).earned).length;
                  const isOpen = openCategory === cat.id;
                  return (
                    <div className="bl-category" key={cat.id}>
                      <div className="bl-category-head" onClick={() => setOpenCategory(isOpen ? "" : cat.id)}>
                        <div className="bl-category-title">
                          <span className="bl-category-code">{cat.code}</span>
                          {cat.label}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span className="bl-category-frac">{earnedInCat}/{catBadges.length}</span>
                          <ChevronDown size={16} className={`bl-chev ${isOpen ? "is-open" : ""}`} />
                        </div>
                      </div>
                      {isOpen && (
                        <div className="bl-category-body">
                          {catBadges.length === 0 && <div className="bl-no-badges">No badges in this group yet — add one from the badge library.</div>}
                          {catBadges.map((b) => {
                            const st = getBadgeState(selected, b);
                            return (
                              <div className="bl-badge-card" key={b.id}>
                                <div className="bl-badge-head">
                                  <div className="bl-badge-title">
                                    {b.name}
                                    {b.level && <span className="bl-badge-level">{b.level}</span>}
                                  </div>
                                  <button
                                    className={`bl-earned-pill ${st.earned ? "is-earned" : "not-earned"}`}
                                    onClick={() => toggleEarnedOverride(b.id)}
                                  >
                                    <Check size={12} /> {st.earned ? "Earned" : "Mark earned"}
                                  </button>
                                </div>
                                {b.requirements.length > 0 && (
                                  <div className="bl-bar">
                                    <div className="bl-bar-fill" style={{ width: `${st.pct}%` }} />
                                  </div>
                                )}
                                {b.requirements.length === 0 ? (
                                  <div className="bl-no-reqs">No checklist items yet — add them in the badge library.</div>
                                ) : (
                                  <div className="bl-req-list">
                                    {b.requirements.map((r) => (
                                      <div
                                        key={r.id}
                                        className={`bl-req-item ${st.checked[r.id] ? "is-done" : ""}`}
                                        onClick={() => toggleRequirement(b.id, r.id)}
                                      >
                                        <div className="bl-req-box">{st.checked[r.id] && <Check size={11} color="#241F14" />}</div>
                                        <span>{r.text}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {showAddMember && (
        <AddMemberModal onClose={() => setShowAddMember(false)} onAdd={addMember} />
      )}
      {showLibrary && (
        <LibraryModal
          badges={badges}
          onClose={() => setShowLibrary(false)}
          onAddBadge={addBadge}
          onRemoveBadge={removeBadge}
          onRenameBadge={renameBadge}
          onAddRequirement={addRequirement}
          onRemoveRequirement={removeRequirement}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Add member modal                                                   */
/* ------------------------------------------------------------------ */

function AddMemberModal({ onClose, onAdd }) {
  const [name, setName] = useState("");
  const [section, setSection] = useState("Senior");
  const [rank, setRank] = useState("");

  return (
    <div className="bl-modal-overlay" onClick={onClose}>
      <div className="bl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bl-modal-head">
          <h2>Add member</h2>
          <button className="bl-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="bl-field">
          <label>Full name</label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Tan" />
        </div>
        <div className="bl-field">
          <label>Section</label>
          <select value={section} onChange={(e) => setSection(e.target.value)}>
            {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="bl-field">
          <label>Rank (optional)</label>
          <input value={rank} onChange={(e) => setRank(e.target.value)} placeholder="e.g. Private, Corporal" />
        </div>
        <div className="bl-modal-actions">
          <button className="bl-btn bl-btn-line" onClick={onClose}>Cancel</button>
          <button className="bl-btn bl-btn-solid" onClick={() => onAdd(name, section, rank)}>Add member</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Badge library modal                                                */
/* ------------------------------------------------------------------ */

function LibraryModal({ badges, onClose, onAddBadge, onRemoveBadge, onRenameBadge, onAddRequirement, onRemoveRequirement }) {
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("interest");
  const [newLevel, setNewLevel] = useState("Basic");
  const [draftReq, setDraftReq] = useState({});

  return (
    <div className="bl-modal-overlay" onClick={onClose}>
      <div className="bl-modal bl-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="bl-modal-head">
          <h2>Badge library</h2>
          <button className="bl-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 12.5, color: "#6b5f42", marginTop: -8, marginBottom: 16 }}>
          Badges and checklist items below are based on the Senior Member's Handbook. Numbers like minimum distances,
          hours, or session counts were read visually off a design-heavy PDF, so double-check those specific figures
          against your copy and adjust anything that doesn't match — everything here is editable.
        </p>

        {CATEGORIES.map((cat) => {
          const inCat = badges.filter((b) => b.category === cat.id);
          if (inCat.length === 0) return null;
          return (
            <div key={cat.id} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em", color: "#6b5f42", marginBottom: 6 }}>
                {cat.label.toUpperCase()}
              </div>
              {inCat.map((b) => (
                <div className="bl-lib-badge" key={b.id}>
                  <div className="bl-lib-badge-head">
                    <input value={b.name} onChange={(e) => onRenameBadge(b.id, e.target.value)} />
                    {b.level && <span className="bl-lib-tag">{b.level}</span>}
                    <button className="bl-lib-del" onClick={() => onRemoveBadge(b.id)}><Trash2 size={14} /></button>
                  </div>
                  <div className="bl-lib-reqs">
                    {b.requirements.map((r) => (
                      <div className="bl-lib-req" key={r.id}>
                        <span>{r.text}</span>
                        <button onClick={() => onRemoveRequirement(b.id, r.id)}><X size={13} /></button>
                      </div>
                    ))}
                  </div>
                  <div className="bl-lib-add-req">
                    <input
                      placeholder="Add checklist item…"
                      value={draftReq[b.id] || ""}
                      onChange={(e) => setDraftReq((d) => ({ ...d, [b.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          onAddRequirement(b.id, draftReq[b.id] || "");
                          setDraftReq((d) => ({ ...d, [b.id]: "" }));
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        onAddRequirement(b.id, draftReq[b.id] || "");
                        setDraftReq((d) => ({ ...d, [b.id]: "" }));
                      }}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        <div className="bl-lib-new">
          <div>
            <label>New badge name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Cyclist" />
          </div>
          <div>
            <label>Category</label>
            <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label>Level</label>
            <select value={newLevel} onChange={(e) => setNewLevel(e.target.value)}>
              <option value="Basic">Basic</option>
              <option value="Advanced">Advanced</option>
              <option value="">None</option>
            </select>
          </div>
          <button
            className="bl-btn bl-btn-solid"
            style={{ padding: "9px 12px" }}
            onClick={() => { onAddBadge(newName, newCategory, newLevel); setNewName(""); }}
          >
            <Plus size={14} /> Add
          </button>
        </div>

        <div className="bl-modal-actions">
          <button className="bl-btn bl-btn-solid" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
