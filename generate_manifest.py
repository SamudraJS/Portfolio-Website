#!/usr/bin/env python3
"""
Portfolio manifest generator
============================

Scans the ``projects/`` folder and writes ``data.js`` (consumed by the website).

Expected folder layout::

    projects/
        <Category>/                 e.g. "Research Projects"
            <Project>/              e.g. "Decipede"  (optionally "01_Decipede" to force order)
                1_caption.jpg       <number>_<caption>.<ext>
                2_another caption.png
            description.txt         (optional) shown under the project title

Rules
-----
* Photo file names follow ``<number>_<caption>.<ext>``.
  - The leading number controls the display order inside a project.
  - Everything after the first underscore is the caption. Remaining
    underscores are turned into spaces, so ``1_a_close_up.jpg`` and
    ``1_a close up.jpg`` both render as "a close up".
  - A file with no leading number is allowed; its caption is the whole name
    and it sorts after the numbered photos (alphabetically).
* Project / category folders may use an optional ``NN_`` prefix to control
  order (stripped from the displayed name). Unnumbered folders sort
  alphabetically after numbered ones.
* Categories listed in CATEGORY_ORDER appear first, in that order; any other
  categories are appended alphabetically.
* An optional ``description.txt`` inside a project folder becomes its blurb.
* A cover image is auto-detected from ``assets/cover.*`` if present.

Run it with::

    python generate_manifest.py
"""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #
ROOT = Path(__file__).resolve().parent
PROJECTS_DIR = ROOT / "projects"
ASSETS_DIR = ROOT / "assets"
OUTPUT = ROOT / "data.js"
INDEX = ROOT / "index.html"
CSS_FILE = ROOT / "css" / "style.css"
JS_FILE = ROOT / "js" / "main.js"

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg", ".jfif"}

# Preferred display order of the top-level categories. Anything not listed
# here is appended afterwards in alphabetical order.
CATEGORY_ORDER = [
    "Research Projects",
    "Professional Projects",
    "Personal Projects",
]

DESCRIPTION_FILES = ("description.txt", "_description.txt", "description.md")


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
# A leading number is only treated as an ordering prefix when followed by a real
# separator (_ - . or ")"). This keeps captions/titles that merely *start* with a
# number intact, e.g. "3D printed gear", "2024 recap", "360 camera".
_PREFIX_RE = re.compile(r"^\s*(\d+)\s*[_\-.)]\s*(.*)$", re.DOTALL)


def _natural_key(text: str):
    """Sort key that treats embedded numbers numerically ("2" before "10")."""
    return [
        int(chunk) if chunk.isdigit() else chunk.lower()
        for chunk in re.split(r"(\d+)", text)
    ]


def split_prefix(name: str):
    """Return ``(order, rest)`` where order is an int or None.

    ``"01_Decipede"`` -> ``(1, "Decipede")``; ``"Decipede"`` -> ``(None, "Decipede")``.
    """
    name = name.strip()
    match = _PREFIX_RE.match(name)
    if match:
        rest = match.group(2).strip()
        return int(match.group(1)), (rest if rest else name)
    return None, name


def clean_caption(raw: str) -> str:
    """Turn the text-after-the-number into a human caption."""
    return raw.replace("_", " ").strip()


def web_path(path: Path) -> str:
    """Relative, URL-encoded path from the site root (forward slashes)."""
    rel = path.relative_to(ROOT).as_posix()
    return quote(rel, safe="/")


def file_token(path: Path) -> str:
    """Short content hash of a file — changes only when the file's bytes change."""
    return hashlib.md5(path.read_bytes()).hexdigest()[:8]


def versioned_web_path(path: Path) -> str:
    """Web path with a ``?v=<hash>`` cache-buster so the browser reloads an image
    the moment its contents change — even if you keep the same file name."""
    return f"{web_path(path)}?v={file_token(path)}"


def folder_sort_key(folder: Path):
    """Numbered folders first (by number), then the rest alphabetically."""
    order, rest = split_prefix(folder.name)
    return (0, order, _natural_key(rest)) if order is not None else (1, 0, _natural_key(rest))


def read_company(project_dir: Path) -> str:
    f = project_dir / "company.txt"
    if f.is_file():
        return f.read_text(encoding="utf-8").strip()
    return ""


def read_description(project_dir: Path) -> str:
    for candidate in DESCRIPTION_FILES:
        f = project_dir / candidate
        if f.is_file():
            return f.read_text(encoding="utf-8").strip()
    return ""


def _clean_item(line: str) -> str:
    """Strip whitespace and surrounding quotes from a single line entry."""
    return line.strip().strip("\"'").strip()


def read_list(project_dir: Path, filename: str) -> list:
    """Read a one-item-per-line file (e.g. skills.txt, achievements.txt).

    Lines may optionally be wrapped in quotes (e.g. "CAD"); blanks are skipped.
    """
    f = project_dir / filename
    if not f.is_file():
        return []
    items = []
    for line in f.read_text(encoding="utf-8").splitlines():
        item = _clean_item(line)
        if item:
            items.append(item)
    return items


# Matches a links.txt line:  "Label" : "https://..."   (quotes optional)
_LINK_RE = re.compile(r'^\s*["\']?(.*?)["\']?\s*:\s*["\']?(.*?)["\']?\s*$')


def read_links(project_dir: Path) -> list:
    """Read links.txt — each line ``"Label" : "URL"`` -> {label, url}."""
    f = project_dir / "links.txt"
    if not f.is_file():
        return []
    links = []
    for line in f.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        match = _LINK_RE.match(line)
        if not match:
            continue
        label = match.group(1).strip()
        url = match.group(2).strip()
        if label and url:
            links.append({"label": label, "url": url})
    return links


# --------------------------------------------------------------------------- #
# Scanning
# --------------------------------------------------------------------------- #
def scan_images(project_dir: Path, project_title: str):
    images = []
    for file in project_dir.iterdir():
        if not file.is_file() or file.suffix.lower() not in IMAGE_EXTS:
            continue
        stem = file.stem.strip()
        if stem.isdigit():
            # A file named with only a number ("5.jpg") is photo #5 with no caption.
            order, caption = int(stem), ""
        else:
            order, rest = split_prefix(file.stem)
            caption = clean_caption(rest)
        images.append(
            {
                "_order": order,
                "_name": file.name,
                "src": versioned_web_path(file),
                "caption": caption,
                "alt": f"{project_title} — {caption}" if caption else project_title,
            }
        )

    def image_key(img):
        # Raw file name is the final tie-breaker so leading-zero variants
        # (1_, 01_, 001_) order deterministically across machines/CI.
        if img["_order"] is not None:
            return (0, img["_order"], _natural_key(img["_name"]), img["_name"])
        return (1, 0, _natural_key(img["_name"]), img["_name"])

    images.sort(key=image_key)
    for img in images:  # drop private sort fields
        img.pop("_order", None)
        img.pop("_name", None)
    return images


def scan_project(project_dir: Path):
    _, title = split_prefix(project_dir.name)
    images = scan_images(project_dir, title)
    if not images:
        return None  # skip empty project folders
    return {
        "title": title,
        "company": read_company(project_dir),
        "description": read_description(project_dir),
        "skills": read_list(project_dir, "skills.txt"),
        "links": read_links(project_dir),
        "achievements": read_list(project_dir, "achievements.txt"),
        "images": images,
    }


def scan_category(category_dir: Path):
    _, name = split_prefix(category_dir.name)
    projects = []
    for project_dir in sorted(
        (p for p in category_dir.iterdir() if p.is_dir() and p.name != ".trash"), key=folder_sort_key
    ):
        project = scan_project(project_dir)
        if project:
            projects.append(project)
    if not projects:
        return None
    return {"name": name, "projects": projects}


def category_sort_key(category_dir: Path):
    _, name = split_prefix(category_dir.name)
    if name in CATEGORY_ORDER:
        return (0, CATEGORY_ORDER.index(name), "")
    return (1, 0, name.lower())


# Preferred cover format when several "cover.*" files exist (deterministic, no
# reliance on file mtime which is unstable in CI checkouts).
COVER_EXT_ORDER = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".svg"]


def detect_cover() -> str | None:
    if not ASSETS_DIR.is_dir():
        return None
    covers = [
        f
        for f in ASSETS_DIR.iterdir()
        if f.is_file() and f.stem.lower() == "cover" and f.suffix.lower() in IMAGE_EXTS
    ]
    if not covers:
        return None
    if len(covers) > 1:
        print(f"Note: multiple cover images found ({sorted(c.name for c in covers)}); "
              "a real cover wins over the bundled cover.svg placeholder.")

    def key(p: Path):
        is_placeholder = p.name.lower() == "cover.svg"  # the shipped placeholder
        ext = p.suffix.lower()
        idx = COVER_EXT_ORDER.index(ext) if ext in COVER_EXT_ORDER else len(COVER_EXT_ORDER)
        return (is_placeholder, idx, p.name.lower())

    return versioned_web_path(min(covers, key=key))


def read_experience() -> list:
    for candidate in ("experience.txt", "experiences.txt", "work_experience.txt"):
        f = ASSETS_DIR / candidate
        if f.is_file():
            items = []
            current = {}
            for line in f.read_text(encoding="utf-8").splitlines():
                trimmed = line.strip()
                if not trimmed or trimmed.startswith("#") or trimmed.startswith("//") or trimmed == "---":
                    if current.get("company") or current.get("name") or current.get("role"):
                        items.append({
                            "company": current.get("company", current.get("name", "")),
                            "date": current.get("date", current.get("period", "")),
                            "role": current.get("role", current.get("position", "")),
                            "description": current.get("description", current.get("desc", current.get("details", ""))),
                        })
                        current = {}
                    continue
                if ":" in trimmed:
                    key, _, val = trimmed.partition(":")
                    current[key.strip().lower()] = val.strip()
            if current.get("company") or current.get("name") or current.get("role"):
                items.append({
                    "company": current.get("company", current.get("name", "")),
                    "date": current.get("date", current.get("period", "")),
                    "role": current.get("role", current.get("position", "")),
                    "description": current.get("description", current.get("desc", current.get("details", ""))),
                })
            return items
    return []


def build():
    categories = []
    if PROJECTS_DIR.is_dir():
        for category_dir in sorted(
            (c for c in PROJECTS_DIR.iterdir() if c.is_dir() and c.name != ".trash"), key=category_sort_key
        ):
            category = scan_category(category_dir)
            if category:
                categories.append(category)

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "cover": detect_cover(),
        "experience": read_experience(),
        "categories": categories,
    }


def cache_bust():
    """Stamp a content hash onto the css / js / data.js URLs in index.html so a
    browser always loads the latest version after a rebuild — no stale cache.
    Only the ``?v=`` query on those three links is touched; nothing else in
    index.html is modified.
    """
    if not INDEX.is_file():
        return
    html = INDEX.read_text(encoding="utf-8")
    targets = {
        "css/style.css": CSS_FILE,
        "js/main.js": JS_FILE,
        "data.js": OUTPUT,
    }
    for rel, path in targets.items():
        token = hashlib.md5(path.read_bytes()).hexdigest()[:8] if path.is_file() else "0"
        pattern = re.compile(r'((?:href|src)=")' + re.escape(rel) + r'(?:\?v=[^"]*)?(")')
        html = pattern.sub(
            lambda m, r=rel, t=token: m.group(1) + r + "?v=" + t + m.group(2), html
        )
    INDEX.write_text(html, encoding="utf-8")


def main():
    data = build()
    payload = json.dumps(data, ensure_ascii=False, indent=2)
    OUTPUT.write_text(
        "// AUTO-GENERATED by generate_manifest.py — do not edit by hand.\n"
        "// Run `python generate_manifest.py` after adding or renaming photos.\n"
        f"window.PORTFOLIO_DATA = {payload};\n",
        encoding="utf-8",
    )
    cache_bust()

    n_cat = len(data["categories"])
    n_proj = sum(len(c["projects"]) for c in data["categories"])
    n_img = sum(len(p["images"]) for c in data["categories"] for p in c["projects"])
    print(f"Wrote {OUTPUT.name}: {n_cat} categories, {n_proj} projects, {n_img} images.")
    if data["cover"]:
        print(f"Cover image: {data['cover']}")
    else:
        print("No cover image found (add assets/cover.jpg).")


if __name__ == "__main__":
    main()
