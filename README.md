# Study Material

A website for studying class material. Each class is split into modules and lessons. For each lesson the site shows:

- **Summary**: condensed study notes for the lesson.
- **Reading**: the assigned textbook sections, rewritten as web pages.
- **Charts**: interactive graphs inside the summary and reading. Readers can drag a price line or shift a curve to see what changes.
- **Glossary**: terms marked in the text open a definition popup. Each class also has a glossary page that lists every place a term appears.
- **Credits**: the sources each lesson draws on, with their licenses.

## How it works

The site is a **React** app built with **Vite**. It runs entirely in the browser; there is no server of our own.

| Piece | What it does |
| --- | --- |
| React + React Router | Builds the pages and moves between them (home → class → lesson → summary / reading / glossary). |
| D3 | Draws the charts (step and line charts, time series, circular flow) and makes them interactive. |
| KaTeX | Displays math equations. |
| Firebase Firestore | A cloud database that stores all class content. The site only reads from it. |
| Firebase Hosting | Serves the built site. |

Content flows in one direction:

```
content/ (JSON files on your machine, not committed)
   │  pnpm validate    checks the files for mistakes
   │  pnpm upload      writes them to Firestore
   ▼
Firestore (read-only to the public)
   │
   ▼
React app in the browser  →  pages, charts, glossary popups
```

- **Content is not stored in this repo.** Lessons are written as JSON in a local `content/` folder, which is gitignored. The upload script checks the files and writes them to Firestore. It uses your own Google credentials, so nothing in the browser can change the data.
- **The browser can read Firestore but not write to it** (see `firestore.rules`).
- **Pages work offline after the first visit.** The app keeps a copy of what it has loaded in the browser.

### Where things live

```
src/
  views/       pages (home, class, lesson summary, reading, glossary, credits)
  components/  building blocks for text: paragraphs, tables, equations, glossary terms
  charts/      the D3 charts
  content/     the content format (types.ts) and its validation rules (validate.ts)
  data/        Firebase connection and Firestore reads
scripts/       command-line tools for preparing and uploading content
```

## Getting started

Requires Node 24 and pnpm.

```sh
pnpm install
cp .env.example .env   # then fill in the Firebase values (see below)
pnpm dev               # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `pnpm dev` | Runs the site locally. |
| `pnpm test` | Runs the tests. |
| `pnpm build` | Type-checks the code and builds the site into `dist/`. |
| `pnpm validate [classId]` | Checks local content for mistakes without uploading anything. |
| `pnpm upload <classId>` | Validates a class and writes it to Firestore. Add `--check` to only compare. |
| `pnpm deploy` | Builds the site and deploys hosting and Firestore rules. |
| `pnpm scrape <pdf> <out.json>` | Drafts a reading chapter from a textbook PDF. The output needs a review pass. |
| `pnpm mark-terms <classId> <m>/<l>` | Marks glossary terms in a lesson's reading. |
| `pnpm figures <pdf> [pages]` | Renders PDF pages to PNG so you can inspect figures. |

## Connecting to Firebase

1. In the [Firebase console](https://console.firebase.google.com/), create a project, enable **Firestore**, and add a **Web app**.
2. Copy the web app's config values (Project settings → Your apps → SDK setup and configuration) into `.env`:

   ```sh
   # .env
   VITE_FIREBASE_API_KEY=<your-api-key>
   VITE_FIREBASE_AUTH_DOMAIN=<your-project-id>.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=<your-project-id>
   VITE_FIREBASE_APP_ID=<your-app-id>
   ```

   These values are built into the public site, which is expected for Firebase web apps. The data is protected by the Firestore rules, not by keeping these values secret. If any value is missing, the site shows a setup message instead of loading.

3. **To upload content or deploy**, sign in with Google credentials that have access to the project:

   ```sh
   gcloud auth application-default login   # used by pnpm upload
   npx firebase login                      # used by pnpm deploy
   ```

   The scripts take the project ID from `.env`, so the repo does not include a `.firebaserc`.

4. **CI (optional):** `.github/workflows/ci.yml` runs the tests and build on every push. To deploy `main` to Hosting and post preview links on PRs, add the four `VITE_FIREBASE_*` values and a `FIREBASE_SERVICE_ACCOUNT` key (with the Firebase Hosting Admin role) as repository secrets.

## Content format

The full schema, with comments, is in [`src/content/types.ts`](src/content/types.ts). `pnpm validate` lists any problems before you upload. All names and values below are placeholders.

### Folder layout

```
content/
  sample-101/              one folder per class; the name is the class id
    class.json             outline: modules and lessons
    glossary.json          glossary terms
    credits.json           sources and licenses
    1/                     module id
      1/                   lesson id  →  URL /sample-101/1/1
        summary.json
        charts.json
        reading/
          ch1.json         one file per reading chapter
          ch2.json
```

IDs may contain only lowercase letters, digits and dashes. Every lesson in `class.json` needs a matching folder, and every lesson folder must be listed in `class.json`.

### Rich text

Most text fields accept **rich text**: either a plain string or a list of pieces. A styled piece is an object with exactly one key:

```json
["A ",
 {"term": "widget"},
 " costs ",
 {"strong": ["$", {"num": "3"}]},
 " to make."]
```

| Key | Meaning |
| --- | --- |
| `term` | Glossary term. Shows the definition on hover or tap. Must match a glossary entry's term or alias. |
| `num` | Number, shown in the monospace number style. |
| `strong` / `em` | Bold / italic. |
| `good` / `bad` | Shown in green / red, e.g. a gain versus a loss. |

### Blocks

The body of a section is a list of blocks:

| `type` | Fields | Use |
| --- | --- | --- |
| `p` | `text` | Paragraph |
| `h` | `text` | Subheading inside a section |
| `list` | `items`, `ordered?`, `start?` | Bullet or numbered list. An item can be `{ "text", "sub": <list> }` to nest a list. |
| `table` | `columns`, `rows`, `numeric?`, `highlight?`, `note?` | Table |
| `example` | `label`, `blocks` | Worked example |
| `box` | `label`, `blocks` | Callout box from the book, e.g. "Learning Objectives" |
| `quote` | `text`, `cite?` | Quotation |
| `equation` | `tex` | Display equation in TeX |
| `chart` | `charts` (chart ids), `caption` | One or more charts from the lesson's `charts.json`, shown side by side |
| `figure` | `label`, `caption` | A book figure shown as its caption only (photos and diagrams) |

### Class outline: `class.json`

```json
{
  "id": "sample-101",
  "code": "SAMPLE 101",
  "title": "Sample Course",
  "modules": [
    {
      "id": "1",
      "title": "First Module",
      "lessons": [
        { "id": "1", "title": "First Lesson" },
        { "id": "2", "title": "Second Lesson" }
      ]
    }
  ]
}
```

Titles leave out the "Module 1:" or "Lesson 1:" prefix; the app adds it.

### Summary: `summary.json`

A summary has an intro, a list of sources, and chapters. A chapter has sections, and a section has blocks.

```json
{
  "intro": "Notes for the assigned sections of Chapters 1 and 2.",
  "sources": ["Sample Textbook, Ch. 1.1 and 2.1"],
  "chapters": [
    {
      "id": "ch1",
      "label": "Chapter 1",
      "navLabel": "Ch 1.1",
      "title": "Chapter Title",
      "navTitle": "Chapter Title",
      "sourceTag": "Sample Textbook 1.1",
      "sections": [
        {
          "id": "first-section",
          "sec": "1.1",
          "title": "Section Title",
          "blocks": [
            { "type": "p", "text": ["A ", { "term": "widget" }, " is a sample product."] },
            {
              "type": "list",
              "items": [
                "First point.",
                { "text": "Point with sub-points:", "sub": { "type": "list", "items": ["Sub-point A", "Sub-point B"] } }
              ]
            },
            {
              "type": "example",
              "label": "Example: buying widgets",
              "blocks": [
                {
                  "type": "table",
                  "columns": ["Unit", "Value", "Price"],
                  "rows": [["1", "$5", "$3"], ["2", "$4", "$3"], ["3", "$2", "$3"]],
                  "numeric": [1, 2],
                  "highlight": [2],
                  "note": "The third unit is worth less than its price."
                }
              ]
            },
            { "type": "equation", "tex": "\\text{Net} = \\text{Value} - \\text{Price}" },
            { "type": "chart", "charts": ["widget-demand"], "caption": "Demand for widgets at a $3 price." }
          ]
        }
      ]
    }
  ]
}
```

### Reading: `reading/<chapter>.json`

Each file is **one chapter**, in the same shape as a summary chapter. An optional `order` field sets the chapter order; otherwise chapters are sorted by file name. Readings typically use `h`, `box` and `figure` blocks to follow the book's layout.

```json
{
  "order": 0,
  "id": "ch1",
  "label": "Chapter 1",
  "navLabel": "Ch 1",
  "title": "Chapter Title",
  "navTitle": "Chapter Title",
  "sourceTag": "Sample Textbook Ch 1",
  "sections": [
    {
      "id": "intro",
      "title": "Introduction",
      "blocks": [
        { "type": "box", "label": "Learning Objectives", "blocks": [
          { "type": "list", "items": ["First objective", "Second objective"] }
        ] },
        { "type": "p", "text": ["This chapter introduces the ", { "term": "widget" }, "."] },
        { "type": "figure", "label": "Figure 1.1", "caption": "A photo described by its caption." }
      ]
    },
    {
      "id": "second-section",
      "sec": "1.1",
      "title": "Section Title",
      "aside": "(partial; the reading ends partway through)",
      "blocks": [
        { "type": "h", "text": "A Subheading" },
        { "type": "p", "text": ["Every ", { "term": "sample term" }, " links to the glossary."] },
        { "type": "quote", "text": "A quoted passage.", "cite": "Author Name" }
      ]
    }
  ]
}
```

### Graphs: `charts.json`

A lesson's `charts.json` contains **schedules**, which are shared step data such as a table of values per unit, and **charts**. A `chart` block in the summary or reading refers to a chart by its `id`.

Every chart records where its numbers come from. `source` gives the PDF and page. `provenance` is one of `"text"` (stated in the text), `"derived"` (calculated from the text) or `"read-from-image"` (estimated from the figure).

**Step curve with a draggable price** (a staircase curve from a schedule, with the area above the price shaded):

```json
{
  "schedules": {
    "widget-value": {
      "description": "Value of each additional widget",
      "provenance": "text",
      "steps": [
        { "from": 0, "to": 1, "value": 5 },
        { "from": 1, "to": 2, "value": 4 },
        { "from": 2, "to": 3, "value": 2 }
      ]
    }
  },
  "charts": [
    {
      "id": "widget-demand",
      "kind": "xy",
      "title": "Demand for widgets",
      "figure": "Figure 1.2",
      "source": { "pdf": "sample-textbook.pdf", "page": 10 },
      "provenance": "text",
      "xLabel": "Quantity",
      "yLabel": "Price",
      "xDomain": [0, 4],
      "yDomain": [0, 6],
      "yPrefix": "$",
      "curves": [
        { "id": "d", "label": "D", "role": "demand", "shape": "steps", "schedule": "widget-value", "dots": true }
      ],
      "priceLines": [{ "price": 3, "label": "P = $3" }],
      "areas": [{ "kind": "cs", "curve": "d", "price": 3 }],
      "labels": [{ "at": [0.5, 4.2], "text": "CS = $3", "value": true }],
      "interactive": { "price": { "min": 1, "max": 5, "step": 0.5 } }
    }
  ]
}
```

**Two lines with a marked point** (curves through `points`; the reader can shift one curve):

```json
{
  "id": "widget-market",
  "kind": "xy",
  "title": "Widget market",
  "figure": "Figure 1.3",
  "source": { "pdf": "sample-textbook.pdf", "page": 12 },
  "provenance": "read-from-image",
  "xLabel": "Quantity",
  "yLabel": "Price",
  "yPrefix": "$",
  "curves": [
    { "id": "d", "label": "D", "role": "demand", "shape": "line", "points": [[10, 8], [50, 2]] },
    { "id": "s", "label": "S", "role": "supply", "shape": "line", "points": [[10, 2], [50, 8]] }
  ],
  "marker": { "at": [30, 5], "label": "E" },
  "guides": [[30, 5]],
  "interactive": { "shift": { "curves": ["d"], "range": 10, "step": 1 } }
}
```

**Time series** (years on the x axis):

```json
{
  "id": "widget-prices",
  "kind": "xy",
  "title": "Widget prices over time",
  "figure": "Figure 2.1",
  "source": { "pdf": "sample-textbook.pdf", "page": 20 },
  "provenance": "read-from-image",
  "xFormat": "year",
  "yPrefix": "$",
  "curves": [
    { "id": "price", "label": "Price", "role": "series-1", "shape": "smooth",
      "points": [[2000, 1.5], [2005, 2.5], [2010, 3.0], [2015, 2.0]] }
  ]
}
```

Use `"xFormat": "month"` for decimal years, where `2005.5` means July 2005.

**Circular flow diagram:**

```json
{
  "id": "sample-flow",
  "kind": "circular-flow",
  "title": "Sample flow",
  "figure": "Figure 2.2",
  "source": { "pdf": "sample-textbook.pdf", "page": 22 },
  "provenance": "text",
  "flow": {
    "left": "Group A",
    "right": "Group B",
    "outer": [
      { "key": "item-1", "label": "Item 1", "kind": "goods" },
      { "key": "item-2", "label": "Item 2", "kind": "goods" }
    ],
    "inner": [
      { "key": "payment-1", "label": "Payment 1", "kind": "money" },
      { "key": "payment-2", "label": "Payment 2", "kind": "money" }
    ],
    "legend": { "goods": "Goods and services", "money": "Payments" },
    "description": "Group A and Group B exchange items in the outer loop and payments in the inner loop."
  }
}
```

Curve `shape` can be `steps` (a staircase from a schedule), `line`, `smooth`, or `points` (dots only, not connected). Shaded `areas` require a `steps` curve. The area kinds are `cs` (consumer surplus), `tb` (total benefit), `tc` (total cost), `ps` (producer surplus), `tvc` (total variable cost) and `tr` (total revenue).

### Glossary and credits

`glossary.json`:

```json
[
  {
    "id": "widget",
    "term": "Widget",
    "definition": "A sample product used in examples."
  },
  {
    "id": "sample-term",
    "term": "Sample term (ST)",
    "aliases": ["sample terms"],
    "definition": ["A placeholder definition; see ", { "em": "widget" }, "."]
  }
]
```

A `{"term": ...}` mark matches an entry by its term, its term without the trailing parenthetical ("Sample term"), or any alias. Matching ignores case. Validation fails if a mark has no entry, or if an entry is never marked in any lesson. `pnpm mark-terms` adds marks to readings for you.

`credits.json`:

```json
[
  {
    "title": "Sample Textbook",
    "authors": "Author One, Author Two",
    "publisher": "Sample Publisher",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "url": "https://example.com/sample-textbook",
    "usedIn": ["1/1", "1/2"]
  }
]
```

### How it's stored in Firestore

`pnpm upload` handles this for you; it is described here for reference. Firestore cannot store nested arrays, so each document stores its content as a JSON string in a `body` field.

```
classes/{classId}                                   class.json (+ code, title)
classes/{classId}/meta/glossary                     { entries, appearsIn }
classes/{classId}/meta/credits                      credits.json
classes/{classId}/lessons/{m}-{l}                   summary.json
classes/{classId}/lessons/{m}-{l}/parts/charts      charts.json
classes/{classId}/lessons/{m}-{l}/reading/{chId}    one reading chapter (+ order)
```

The upload also computes `appearsIn`, the list of places each glossary term appears, and deletes any documents in Firestore that no longer exist locally.

## License

MIT. See [LICENSE](LICENSE). Course content is not part of this repo and keeps its own licenses (see each class's credits page).
