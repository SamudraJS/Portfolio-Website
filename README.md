# Samudra Jit Saha — Portfolio

A minimal, image-forward portfolio website. A full-screen cover photo, then your
name and intro, then each project category with swipeable photo galleries
(each photo carries its own caption).

**The whole point:** you add projects just by dropping photos into folders.
A script (and a GitHub Action) does the rest.

---

## How to add a project

1. Open the `projects/` folder. Inside are three categories:
   `Research Projects`, `Professional Projects`, `Personal Projects`.
2. Inside a category, make a folder named after your project, e.g. `Decipede`.
3. Drop your photos in, named **`<number>_<caption>.<ext>`**:

   ```
   projects/Research Projects/Decipede/
       1_A modular myriapod robot.jpg
       2_Close-up of a single segment.jpg
       3_Traversing rough terrain.jpg
   ```

   * The **number** sets the order the photos are swiped through.
   * Everything after the first `_` is the **caption** shown under the photo.
     Underscores become spaces, so `1_a_close_up.jpg` and `1_a close up.jpg`
     both read as *"a close up"*.
   * Supported types: `.jpg .jpeg .png .webp .gif .avif .svg`

4. Commit and push. That's it — the site rebuilds itself (see *Hosting*).

### Optional niceties
Drop any of these text files into a project folder (alongside the photos):

* **`description.txt`** — a short blurb shown under the project title.
* **`skills.txt`** — one skill per line; shown as small tags under the title.
  Quotes are optional:
  ```
  "CAD"
  "PCB Design"
  "FEA simulations"
  ```
* **`links.txt`** — one `"Label" : "URL"` per line; shown as clickable tags:
  ```
  "Video" : "https://www.youtube.com/watch?v=Z5v3K2po9FQ"
  "Paper" : "https://example.com/my-paper"
  ```
* **`achievements.txt`** — one per line; shown as ★ tags *below* the gallery:
  ```
  "4th Place, 1st GRIC"
  "2nd Place, 8th WICE"
  ```

Other options:
* **Order projects:** prefix a folder with `NN_`, e.g. `01_Decipede`. The number
  is stripped from the displayed title. (The sample folders use this.)
* **Cover photo:** replace `assets/cover.jpg` with your own (any name `cover.*`).
  Until you do, a placeholder (`assets/cover.svg`) is shown.

(See `projects/Research Projects/01_Decipede/` for working examples of all four files.)

### Edit your name / intro / email / socials
Open `index.html` and edit the clearly-marked block near the top
(name, tagline, intro paragraph, `mailto:` links). In the contact `<footer>`,
replace the **Instagram** and **LinkedIn** URLs with your own profile links.

---

## Preview locally

`data.js` is committed, so you can just open `index.html`. To be safe with
relative paths, serve it:

```bash
python generate_manifest.py     # regenerate after adding photos
python -m http.server 8000      # then open http://localhost:8000
```

---

## Hosting on GitHub Pages

1. Create a repo on GitHub and push this folder to the `main` branch.
2. In the repo: **Settings → Pages → Build and deployment → Source = GitHub Actions**.
3. Push. The included workflow (`.github/workflows/deploy.yml`) runs
   `generate_manifest.py` and publishes the site. Your URL appears under
   **Settings → Pages** (and in the Actions run summary).

After that, the flow is simply: **add photos → commit → push → site updates.**
You don't need Python installed locally for this; the Action runs it for you.

> Tip: for a `username.github.io` address, name the repo `username.github.io`.
> Any other repo name gives `username.github.io/repo-name/`.

---

## Files

| Path | What it is |
|------|------------|
| `index.html` | Page shell + your editable name/intro/contact |
| `css/style.css` | All styling (light theme + dark toggle) |
| `js/main.js` | Renders galleries, carousel, lightbox, theme, nav |
| `generate_manifest.py` | Scans `projects/` → writes `data.js` |
| `data.js` | Auto-generated gallery data (don't edit by hand) |
| `projects/` | Your photos, organised by category → project |
| `assets/cover.*` | The full-screen cover photo |
| `.github/workflows/deploy.yml` | Auto-build + deploy on push |
