const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PROJECTS_DIR = path.join(ROOT, 'projects');
const ASSETS_DIR = path.join(ROOT, 'assets');
const OUTPUT = path.join(ROOT, 'data.js');
const INDEX = path.join(ROOT, 'index.html');
const CSS_FILE = path.join(ROOT, 'css', 'style.css');
const JS_FILE = path.join(ROOT, 'js', 'main.js');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.svg', '.jfif']);
const CATEGORY_ORDER = [
  'Research Projects',
  'Professional Projects',
  'Personal Projects',
];
const DESCRIPTION_FILES = ['description.txt', '_description.txt', 'description.md'];
const COVER_EXT_ORDER = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg'];

const PREFIX_RE = /^\s*(\d+)\s*[_\-.)]\s*(.*)$/s;
const LINK_RE = /^\s*["']?(.*?)["']?\s*:\s*["']?(.*?)["']?\s*$/;

function naturalCompare(a, b) {
  const ax = [], bx = [];
  a.replace(/(\d+)|(\D+)/g, function(_, $1, $2) { ax.push([$1 || Infinity, $2 || '']); });
  b.replace(/(\d+)|(\D+)/g, function(_, $1, $2) { bx.push([$1 || Infinity, $2 || '']); });
  while (ax.length && bx.length) {
    const an = ax.shift();
    const bn = bx.shift();
    const nn = (an[0] - bn[0]) || an[1].localeCompare(bn[1]);
    if (nn) return nn;
  }
  return ax.length - bx.length;
}

function splitPrefix(name) {
  name = name.trim();
  const m = PREFIX_RE.exec(name);
  if (m) {
    const rest = m[2].trim();
    return [parseInt(m[1], 10), rest ? rest : name];
  }
  return [null, name];
}

function cleanCaption(raw) {
  return raw.replace(/_/g, ' ').trim();
}

function fileToken(filepath) {
  const buf = fs.readFileSync(filepath);
  return crypto.createHash('md5').update(buf).digest('hex').slice(0, 8);
}

function webPath(filepath) {
  const rel = path.relative(ROOT, filepath).replace(/\\/g, '/');
  return encodeURI(rel);
}

function versionedWebPath(filepath) {
  return `${webPath(filepath)}?v=${fileToken(filepath)}`;
}

function readExperience() {
  const candidates = ['experience.txt', 'experiences.txt', 'work_experience.txt'];
  let filepath = null;
  for (const c of candidates) {
    const p = path.join(ASSETS_DIR, c);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      filepath = p;
      break;
    }
  }
  if (!filepath) return [];

  const raw = fs.readFileSync(filepath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const items = [];
  let current = {};

  function pushCurrent() {
    if (current.company || current.name || current.role) {
      items.push({
        company: current.company || current.name || '',
        date: current.date || current.period || '',
        role: current.role || current.position || '',
        description: current.description || current.desc || current.details || '',
      });
      current = {};
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
      if (trimmed === '---') pushCurrent();
      continue;
    }
    if (trimmed === '---') {
      pushCurrent();
      continue;
    }
    const idx = trimmed.indexOf(':');
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim().toLowerCase();
      const val = trimmed.slice(idx + 1).trim();
      current[key] = val;
    } else if (trimmed.includes('|')) {
      const parts = trimmed.split('|').map(s => s.trim());
      if (parts.length >= 2) {
        pushCurrent();
        items.push({
          company: parts[0] || '',
          date: parts[1] || '',
          role: parts[2] || '',
          description: parts[3] || '',
        });
      }
    }
  }
  pushCurrent();
  return items;
}

function readCompany(projectDir) {
  const f = path.join(projectDir, 'company.txt');
  if (fs.existsSync(f) && fs.statSync(f).isFile()) {
    return fs.readFileSync(f, 'utf8').trim();
  }
  return '';
}

function readDescription(projectDir) {
  for (const candidate of DESCRIPTION_FILES) {
    const f = path.join(projectDir, candidate);
    if (fs.existsSync(f) && fs.statSync(f).isFile()) {
      return fs.readFileSync(f, 'utf8').trim();
    }
  }
  return '';
}

function readList(projectDir, filename) {
  const f = path.join(projectDir, filename);
  if (!fs.existsSync(f) || !fs.statSync(f).isFile()) return [];
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  const items = [];
  for (const line of lines) {
    const clean = line.trim().replace(/^["']|["']$/g, '').trim();
    if (clean) items.push(clean);
  }
  return items;
}

function readLinks(projectDir) {
  const f = path.join(projectDir, 'links.txt');
  if (!fs.existsSync(f) || !fs.statSync(f).isFile()) return [];
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  const links = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const m = LINK_RE.exec(line);
    if (!m) continue;
    const label = m[1].trim();
    const url = m[2].trim();
    if (label && url) links.push({ label, url });
  }
  return links;
}

function scanImages(projectDir, projectTitle) {
  const entries = fs.readdirSync(projectDir);
  const images = [];
  for (const filename of entries) {
    const filepath = path.join(projectDir, filename);
    if (!fs.statSync(filepath).isFile()) continue;
    const ext = path.extname(filename).toLowerCase();
    if (!IMAGE_EXTS.has(ext)) continue;

    const stem = path.basename(filename, ext).trim();
    let order, caption;
    if (/^\d+$/.test(stem)) {
      order = parseInt(stem, 10);
      caption = '';
    } else {
      const [ord, rest] = splitPrefix(stem);
      order = ord;
      caption = cleanCaption(rest);
    }
    images.push({
      _order: order,
      _name: filename,
      src: versionedWebPath(filepath),
      caption: caption,
      alt: caption ? `${projectTitle} — ${caption}` : projectTitle,
    });
  }

  images.sort((a, b) => {
    const aHas = a._order !== null;
    const bHas = b._order !== null;
    if (aHas && bHas) {
      if (a._order !== b._order) return a._order - b._order;
      return naturalCompare(a._name, b._name);
    }
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    return naturalCompare(a._name, b._name);
  });

  for (const img of images) {
    delete img._order;
    delete img._name;
  }
  return images;
}

function scanProject(projectDir) {
  const [, title] = splitPrefix(path.basename(projectDir));
  const images = scanImages(projectDir, title);
  if (!images || images.length === 0) return null;
  return {
    title,
    company: readCompany(projectDir),
    description: readDescription(projectDir),
    skills: readList(projectDir, 'skills.txt'),
    links: readLinks(projectDir),
    achievements: readList(projectDir, 'achievements.txt'),
    images,
  };
}

function scanCategory(categoryDir) {
  const [, name] = splitPrefix(path.basename(categoryDir));
  const entries = fs.readdirSync(categoryDir);
  const projectDirs = entries
    .filter(e => e !== '.trash')
    .map(e => path.join(categoryDir, e))
    .filter(p => fs.statSync(p).isDirectory())
    .sort((a, b) => {
      const [aOrd, aRest] = splitPrefix(path.basename(a));
      const [bOrd, bRest] = splitPrefix(path.basename(b));
      if (aOrd !== null && bOrd !== null) {
        if (aOrd !== bOrd) return aOrd - bOrd;
        return naturalCompare(aRest, bRest);
      }
      if (aOrd !== null && bOrd === null) return -1;
      if (aOrd === null && bOrd !== null) return 1;
      return naturalCompare(aRest, bRest);
    });

  const projects = [];
  for (const pDir of projectDirs) {
    const proj = scanProject(pDir);
    if (proj) projects.push(proj);
  }
  if (!projects.length) return null;
  return { name, projects };
}

function detectCover() {
  if (!fs.existsSync(ASSETS_DIR) || !fs.statSync(ASSETS_DIR).isDirectory()) return null;
  const entries = fs.readdirSync(ASSETS_DIR);
  const covers = entries
    .map(e => path.join(ASSETS_DIR, e))
    .filter(p => {
      if (!fs.statSync(p).isFile()) return false;
      const stem = path.basename(p, path.extname(p)).toLowerCase();
      const ext = path.extname(p).toLowerCase();
      return stem === 'cover' && IMAGE_EXTS.has(ext);
    });
  if (!covers.length) return null;

  covers.sort((a, b) => {
    const aPlace = path.basename(a).toLowerCase() === 'cover.svg' ? 1 : 0;
    const bPlace = path.basename(b).toLowerCase() === 'cover.svg' ? 1 : 0;
    if (aPlace !== bPlace) return aPlace - bPlace;
    const aExt = path.extname(a).toLowerCase();
    const bExt = path.extname(b).toLowerCase();
    const aIdx = COVER_EXT_ORDER.indexOf(aExt);
    const bIdx = COVER_EXT_ORDER.indexOf(bExt);
    return aIdx - bIdx;
  });

  return versionedWebPath(covers[0]);
}

function build() {
  const categories = [];
  if (fs.existsSync(PROJECTS_DIR) && fs.statSync(PROJECTS_DIR).isDirectory()) {
    const catDirs = fs.readdirSync(PROJECTS_DIR)
      .filter(e => e !== '.trash')
      .map(e => path.join(PROJECTS_DIR, e))
      .filter(p => fs.statSync(p).isDirectory())
      .sort((a, b) => {
        const [, aName] = splitPrefix(path.basename(a));
        const [, bName] = splitPrefix(path.basename(b));
        const aIdx = CATEGORY_ORDER.indexOf(aName);
        const bIdx = CATEGORY_ORDER.indexOf(bName);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return aName.localeCompare(bName);
      });

    for (const cDir of catDirs) {
      const cat = scanCategory(cDir);
      if (cat) categories.push(cat);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    cover: detectCover(),
    experience: readExperience(),
    categories,
  };
}

function cacheBust() {
  if (!fs.existsSync(INDEX)) return;
  let html = fs.readFileSync(INDEX, 'utf8');
  const targets = {
    'css/style.css': CSS_FILE,
    'js/main.js': JS_FILE,
    'data.js': OUTPUT,
  };
  for (const [rel, targetPath] of Object.entries(targets)) {
    const token = fs.existsSync(targetPath) ? fileToken(targetPath) : '0';
    const regex = new RegExp(`((?:href|src)=")${rel.replace('.', '\\.')}(?:\\?v=[^"]*)?(")`, 'g');
    html = html.replace(regex, `$1${rel}?v=${token}$2`);
  }
  fs.writeFileSync(INDEX, html, 'utf8');
}

function main() {
  const data = build();
  const payload = JSON.stringify(data, null, 2);
  fs.writeFileSync(
    OUTPUT,
    '// AUTO-GENERATED by generate_manifest.py / generate_manifest.js — do not edit by hand.\n' +
    '// Run `node generate_manifest.js` after adding or renaming photos.\n' +
    `window.PORTFOLIO_DATA = ${payload};\n`,
    'utf8'
  );
  cacheBust();

  const nCat = data.categories.length;
  const nProj = data.categories.reduce((acc, c) => acc + c.projects.length, 0);
  const nImg = data.categories.reduce((acc, c) => acc + c.projects.reduce((a2, p) => a2 + p.images.length, 0), 0);
  console.log(`Wrote ${path.basename(OUTPUT)}: ${nCat} categories, ${nProj} projects, ${nImg} images.`);
}

main();
