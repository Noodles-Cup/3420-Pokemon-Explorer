
const API_URL = "https://qoedx66hcfduny3qb5ivru7uva0wmkka.lambda-url.us-east-2.on.aws/";
const POKE = "https://pokeapi.co/api/v2/";

const GAMES = {
  1: {
    red: ["Red", "red-blue", "red"],
    blue: ["Blue", "red-blue", "blue"],
    yellow: ["Yellow", "yellow", "yellow"]
  },
  2: {
    gold: ["Gold", "gold-silver", "gold"],
    silver: ["Silver", "gold-silver", "silver"],
    crystal: ["Crystal", "crystal", "crystal"]
  },
  3: {
    "fire-red": ["FireRed", "firered-leafgreen", "firered"],
    "leaf-green": ["LeafGreen", "firered-leafgreen", "leafgreen"],
    ruby: ["Ruby", "ruby-sapphire", "ruby"],
    sapphire: ["Sapphire", "ruby-sapphire", "sapphire"],
    emerald: ["Emerald", "emerald", "emerald"]
  },
  4: {
    diamond: ["Diamond", "diamond-pearl", "diamond"],
    pearl: ["Pearl", "diamond-pearl", "pearl"],
    platinum: ["Platinum", "platinum", "platinum"],
    heartgold: ["HeartGold", "heartgold-soulsilver", "heartgold"],
    soulsilver: ["SoulSilver", "heartgold-soulsilver", "soulsilver"]
  },
  5: {
    black: ["Black", "black-white", "black"],
    white: ["White", "black-white", "white"],
    "black-2": ["Black 2", "black-2-white-2", "black-2"],
    "white-2": ["White 2", "black-2-white-2", "white-2"]
  }
};

const GEN_MAX = {1:151, 2:251, 3:386, 4:493, 5:649};
const ROMAN = ["", "I", "II", "III", "IV", "V"];

const TYPE_COLORS = {
  normal:"#9c9c8c", fire:"#f08030", water:"#3d8bff",
  electric:"#f8c800", grass:"#5cb85c", ice:"#74d0d0",
  fighting:"#c03028", poison:"#a040a0", ground:"#c9a54a",
  flying:"#8f9fe8", psychic:"#f85888", bug:"#a8b820",
  rock:"#b8a038", ghost:"#705898", dragon:"#7038f8",
  dark:"#705848", steel:"#a0a0b8", fairy:"#ee99ac"
};

const STAT_COLORS = ["#e57373", "#ff9d4d", "#ffc25c", "#64b5f6", "#66bb8a", "#b48be0"];

const STAT_NAMES = {
  hp:"HP",
  attack:"Attack",
  defense:"Defense",
  "special-attack":"Sp. Atk",
  "special-defense":"Sp. Def",
  speed:"Speed"
};

const $ = id => document.getElementById(id);

const esc = s => String(s).replace(/[&<>"']/g, c => ({
  "&":"&amp;",
  "<":"&lt;",
  ">":"&gt;",
  '"':"&quot;",
  "'":"&#39;"
}[c]));

const cap = s => s.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

const pill = t => `<span class="pill" style="background:${TYPE_COLORS[t] || "#777"}">${cap(t)}</span>`;

const gname = g => GAMES[gen][g] ? GAMES[gen][g][0] : cap(g);

function makeUid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "user-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

let uid = localStorage.getItem("pe-uid");

if (!uid) {
  uid = makeUid();
  localStorage.setItem("pe-uid", uid);
}

let gen = 3;
let game = "fire-red";
let cur = null;
let mine = {};

const cache = {};

const get = url => cache[url] ??= fetch(url)
  .then(r => {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  })
  .catch(e => {
    delete cache[url];
    throw e;
  });

const say = t => $("msg").textContent = t || "";

/* ---------- Storage ---------- */

async function api(body) {
  body.userId = uid;

  if (API_URL) {
    const r = await fetch(API_URL, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(body)
    });

    if (!r.ok) throw new Error("API " + r.status);

    return r.json();
  }

  const db = JSON.parse(localStorage.getItem("pe-local") || '{"prefs":{},"mons":{}}');

  if (body.action === "prefs") {
    db.prefs = {...db.prefs, ...body.prefs};
  }

  if (body.action === "save") {
    db.mons[body.id] = {
      id: body.id,
      name: body.name,
      status: body.status
    };
  }

  if (body.action === "remove") {
    delete db.mons[body.id];
  }

  localStorage.setItem("pe-local", JSON.stringify(db));

  return db;
}

/* ---------- Game selectors ---------- */

function fillGen() {
  $("gen").innerHTML = Object.keys(GAMES)
    .map(g => `<option value="${g}">Gen ${ROMAN[g]}</option>`)
    .join("");

  $("gen").value = gen;
  fillGames();
}

function fillGames() {
  $("game").innerHTML = Object.entries(GAMES[gen])
    .map(([k, v]) => `<option value="${k}">Pokémon ${v[0]}</option>`)
    .join("");

  if (!GAMES[gen][game]) {
    game = Object.keys(GAMES[gen])[0];
  }

  $("game").value = game;
  $("gameTitle").textContent = "Pokémon " + gname(game);

  $("others").textContent =
    "Other games in this generation: " +
    Object.keys(GAMES[gen])
      .filter(g => g !== game)
      .map(gname)
      .join(", ");
}

$("gen").onchange = e => {
  gen = +e.target.value;
  fillGames();
  persistPrefs();
  refresh();
};

$("game").onchange = e => {
  game = e.target.value;
  fillGames();
  persistPrefs();
  refresh();
};

const persistPrefs = () =>
  api({action:"prefs", prefs:{gen, game}})
    .catch(() => say("Could not save your game choice."));

const refresh = () => {
  show(cur ? cur.id : 1);

  if (!$("loc").hidden) {
    $("locTitle").textContent = "";
  }
};

/* ---------- Pokémon details ---------- */

async function show(q) {
  say("Loading…");

  try {
    const p = await get(POKE + "pokemon/" + String(q).toLowerCase().trim());

    const [sp, enc] = await Promise.all([
      get(p.species.url),
      get(p.location_area_encounters)
    ]);

    cur = p;

    $("pagerTitle").textContent =
      `#${String(p.id).padStart(3, "0")} ${cap(p.name)}`;

    $("art").src =
      p.sprites.other["official-artwork"].front_default ||
      p.sprites.front_default;

    $("art").alt = cap(p.name);

    const inches = Math.round(p.height * 3.937);

    $("info").innerHTML = [
      ["Pokédex No.", "#" + String(sp.id).padStart(3, "0")],
      ["Type", p.types.map(t => pill(t.type.name)).join("")],
      ["Species", esc(sp.genera.find(g => g.language.name === "en")?.genus || "—")],
      ["Height", `${Math.floor(inches / 12)}'${String(inches % 12).padStart(2, "0")}"`],
      ["Weight", (p.weight * 0.2205).toFixed(1) + " lbs"],
      ["Abilities", p.abilities.map(a => cap(a.ability.name)).join(" / ")],
      ["Evolution", await evolution(sp)]
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");

    availability(p, enc);
    stats(p);
    await learnset(p);

    markButtons();
    say("");

  } catch (e) {
    console.error(e);
    say("Pokémon not found. Try a name like “pikachu” or a number from 1 to 1025.");
  }
}

async function evolution(sp) {
  if (!sp.evolution_chain) return "—";

  const chain = (await get(sp.evolution_chain.url)).chain;

  const find = n =>
    n.species.name === sp.name
      ? n
      : n.evolves_to.map(find).find(Boolean);

  const node = find(chain);

  if (!node || !node.evolves_to.length) {
    return "Does not evolve" + (node === chain ? "" : " further");
  }

  return node.evolves_to.map(n => {
    const d = n.evolution_details[0] || {};

    const how = d.min_level
      ? "Lv. " + d.min_level
      : d.item
        ? cap(d.item.name)
        : d.trigger
          ? cap(d.trigger.name)
          : "special";

    return `${cap(n.species.name)} at ${how}`;
  }).join(", ");
}

function availability(p, enc) {
  const here = {};
  const inGen = new Set();

  enc.forEach(e => {
    e.version_details.forEach(v => {
      const version = v.version.name;

      const matchingGame = Object.entries(GAMES[gen])
        .find(([key, value]) => value[2] === version);

      if (matchingGame) {
        inGen.add(matchingGame[0]);
      }

      if (version === GAMES[gen][game][2]) {
        const location = cap(e.location_area.name);
        here[location] = (here[location] || 0) + v.max_chance;
      }
    });
  });

  const el = $("avail");
  const G = gname(game);

  const row = (k, v) =>
    `<div class="row"><span class="k">${k}</span><b>${v}</b></div>`;

  if (p.id > GEN_MAX[gen]) {
    el.className = "avail";
    el.innerHTML =
      `<h3>Not in Pokémon ${G}</h3>` +
      row("Reason", `Introduced after Gen ${ROMAN[gen]}`);

    return;
  }

  if (inGen.has(game)) {
    el.className = "avail ok";

    el.innerHTML =
      `<h3>Obtainable in Pokémon ${G}</h3>` +
      row(
        "Catch locations",
        Object.entries(here)
          .slice(0, 5)
          .map(([l, c]) => `${esc(l)} (${c}%)`)
          .join("<br>")
      );

  } else {
    const others = [...inGen];

    el.className = "avail";

    el.innerHTML =
      `<h3>Not obtainable in the wild in Pokémon ${G}</h3>` +
      row(
        "Exclusive",
        others.length
          ? others.map(gname).join(", ") +
            (others.length === 1 ? " exclusive" : " only")
          : "No wild encounters"
      ) +
      row(
        `How to obtain in ${G}`,
        others.length
          ? "Trade from " + others.map(gname).join(" / ")
          : "Evolve, breed, or in-game gift"
      ) +
      row(`Catch location in ${G}`, "None");
  }
}

function stats(p) {
  const total = p.stats.reduce((s, x) => s + x.base_stat, 0);

  $("stats").innerHTML =
    p.stats.map((s, i) => `
      <div class="stat">
        <span>${STAT_NAMES[s.stat.name]}</span>
        <span>${s.base_stat}</span>
        <div class="bar">
          <i style="width:${s.base_stat / 255 * 100}%;background:${STAT_COLORS[i]}"></i>
        </div>
      </div>
    `).join("") +
    `<div class="stat"><span>Total</span><span>${total}</span></div>`;
}

async function learnset(p) {
  const vg = GAMES[gen][game][1];

  const list = p.moves.map(m => ({
    name: m.move.name,
    d: m.version_group_details.find(d =>
      d.version_group.name === vg &&
      d.move_learn_method.name === "level-up"
    )
  }))
  .filter(m => m.d)
  .sort((a, b) => a.d.level_learned_at - b.d.level_learned_at);

  if (!list.length) {
    $("moves").innerHTML =
      "<tr><td>No level-up moves recorded for this game.</td></tr>";
    return;
  }

  const info = await Promise.all(
    list.map(m => get(POKE + "move/" + m.name).catch(() => null))
  );

  $("moves").innerHTML =
    "<tr><th>Lv.</th><th>Move</th><th>Type</th><th>Category</th></tr>" +
    list.map((m, i) => `
      <tr>
        <td>${m.d.level_learned_at}</td>
        <td>${cap(m.name)}</td>
        <td>${info[i] ? pill(info[i].type.name) : "—"}</td>
        <td>${info[i] ? cap(info[i].damage_class.name) : "—"}</td>
      </tr>
    `).join("");
}

/* ---------- Collection ---------- */

function markButtons() {
  const s = cur && mine[cur.id]?.status;

  $("own").textContent =
    s === "owned" ? "✓ Caught" : "Mark as caught";

  $("want").textContent =
    s === "want" ? "✓ On wishlist" : "Want to catch";

  $("drop").hidden = !s;
}

async function setStatus(status) {
  if (!cur) return;

  try {
    await api({
      action: "save",
      id: cur.id,
      name: cur.name,
      status
    });

    mine[cur.id] = {
      id: cur.id,
      name: cur.name,
      status
    };

    markButtons();
    say("Saved to your collection.");

  } catch (e) {
    console.error(e);
    say("Could not save. Check your connection and try again.");
  }
}

$("own").onclick = () => setStatus("owned");
$("want").onclick = () => setStatus("want");

$("drop").onclick = async () => {
  if (!cur) return;

  try {
    await api({action:"remove", id:cur.id});

    delete mine[cur.id];

    markButtons();
    say("Removed from your collection.");

  } catch (e) {
    console.error(e);
    say("Could not remove. Try again.");
  }
};

function renderCollection() {
  const items = Object.values(mine)
    .sort((a, b) => a.id - b.id);

  $("colList").innerHTML = items.length
    ? items.map(m => `
        <button data-id="${+m.id}">
          #${m.id} ${esc(cap(m.name))} —
          ${m.status === "owned" ? "caught" : "wishlist"}
        </button>
      `).join("")
    : "<p>Your collection is empty. Open a Pokémon and choose “Mark as caught” or “Want to catch”.</p>";
}

$("colList").onclick = e => {
  const id = e.target.dataset?.id;

  if (id) {
    tab("dex");
    show(id);
  }
};

/* ---------- Location search ---------- */

$("locForm").onsubmit = async e => {
  e.preventDefault();
  say("Searching…");

  try {
    const all = (await get(POKE + "location-area?limit=1500")).results;

    const q = $("locQ").value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-");

    const hits = all
      .filter(a => a.name.includes(q))
      .slice(0, 12);

    $("locList").innerHTML = hits
      .map(a => `<button data-url="${a.url}">${esc(cap(a.name))}</button>`)
      .join("");

    say(hits.length ? "" : "No locations match that search.");

  } catch (e) {
    console.error(e);
    say("Location search failed. Try again.");
  }
};

$("locList").onclick = async e => {
  const url = e.target.dataset?.url;

  if (!url) return;

  try {
    const a = await get(url);

    $("locTitle").textContent =
      `${cap(a.name)} in Pokémon ${gname(game)}`;

    const rows = a.pokemon_encounters
      .map(pe => ({
        n: pe.pokemon.name,
        v: pe.version_details.find(v =>
          v.version.name === GAMES[gen][game][2]
        )
      }))
      .filter(r => r.v);

    $("locTable").innerHTML = rows.length
      ? "<tr><th>Pokémon</th><th>Chance</th><th>Levels</th></tr>" +
        rows.map(r => {
          const d = r.v.encounter_details;
          const lo = Math.min(...d.map(x => x.min_level));
          const hi = Math.max(...d.map(x => x.max_level));

          return `
            <tr>
              <td>${cap(r.n)}</td>
              <td>${r.v.max_chance}%</td>
              <td>${lo === hi ? lo : lo + "–" + hi}</td>
            </tr>
          `;
        }).join("")
      : `<tr><td>No Pokémon recorded here for ${gname(game)}.</td></tr>`;

  } catch (e) {
    console.error(e);
    say("Could not load this location.");
  }
};

/* ---------- Navigation ---------- */

function tab(name) {
  document.querySelectorAll(".tab").forEach(t => {
    t.hidden = t.id !== name;
  });

  document.querySelectorAll(".tabs button").forEach(b => {
    b.classList.toggle("on", b.dataset.tab === name);
  });

  if (name === "col") {
    renderCollection();
  }
}

document.querySelector(".tabs").onclick = e => {
  if (e.target.dataset.tab) {
    tab(e.target.dataset.tab);
  }
};

$("searchForm").onsubmit = e => {
  e.preventDefault();
  tab("dex");
  show($("q").value);
};

$("prev").onclick = () => {
  if (cur) show(cur.id > 1 ? cur.id - 1 : 1025);
};

$("next").onclick = () => {
  if (cur) show(cur.id < 1025 ? cur.id + 1 : 1);
};

/* ---------- Initialization ---------- */

(async function init() {
  try {
    const db = await api({action:"load"});

    mine = db.mons || {};

    if (db.prefs?.gen && GAMES[db.prefs.gen]) {
      gen = +db.prefs.gen;

      if (GAMES[gen][db.prefs.game]) {
        game = db.prefs.game;
      }
    }

  } catch (e) {
    console.error(e);
    say("Collection service unavailable; using defaults.");
  }

  fillGen();
  show(79);
})();
