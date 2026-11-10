// Schema for lesson content (summary, reading, charts), class outlines, glossaries and credits.

/** Inline styling. Each object has exactly one key, e.g. {"term": "Scarcity"} or {"strong": ["net benefit ", {"num": "$18"}]}. */
export const INLINE_KINDS = ['term', 'num', 'strong', 'em', 'good', 'bad'] as const;
export type InlineKind = (typeof INLINE_KINDS)[number];
export type Inline = string | { [K in InlineKind]: { [P in K]: Rich } }[InlineKind];
/** Rich text: plain string or a run of inline pieces. */
export type Rich = string | Inline[];

/** A list item is rich text, or rich text followed by a nested list. */
export type ListItem = Rich | { text: Rich; sub: ListBlock };

export interface ListBlock {
  type: 'list';
  ordered?: boolean;
  /** First number of an ordered list that continues an earlier one. */
  start?: number;
  items: ListItem[];
}

export interface TableBlock {
  type: 'table';
  columns: string[];
  rows: Rich[][];
  /** Column indexes rendered in the mono numeric style. */
  numeric?: number[];
  /** Row indexes to highlight. */
  highlight?: number[];
  note?: Rich;
}

export type Block =
  | { type: 'p'; text: Rich }
  | ListBlock
  | { type: 'example'; label: string; blocks: Block[] }
  | TableBlock
  | { type: 'quote'; text: Rich; cite?: string }
  /** One chart, or several shown side by side (e.g. Total Benefit vs Total Cost). */
  | { type: 'chart'; charts: string[]; caption: Rich }
  /** A subheading inside a section (reading text). */
  | { type: 'h'; text: Rich }
  /** A book figure that is a photo or diagram: shown as its label and caption only. */
  | { type: 'figure'; label: string; caption: Rich }
  /** A callout box from the book, e.g. learning objectives or "Clear It Up". */
  | { type: 'box'; label: string; blocks: Block[] }
  /** A display equation, written in TeX (rendered with KaTeX). */
  | { type: 'equation'; tex: string };

export interface Section {
  id: string;
  sec?: string;
  title?: string;
  /** Muted aside after the title, e.g. "(partial; the reading ends partway through)". */
  aside?: string;
  blocks: Block[];
}

export interface Chapter {
  id: string;
  label: string;
  navLabel: string;
  title: string;
  navTitle: string;
  sourceTag: string;
  sections: Section[];
}

/** A lesson's summary notes. */
export interface Summary {
  intro: Rich;
  sources: Rich[];
  chapters: Chapter[];
}

// ---------- Charts ----------

export type Point = [x: number, y: number];

/** A horizontal block of a staircase curve: units in (from, to] have marginal value `value`. */
export interface Step {
  from: number;
  to: number;
  value: number;
}

export interface Curve {
  id: string;
  label: string;
  /** demand/supply for market curves; series-1/series-2 for other data (e.g. a price history). */
  role: 'demand' | 'supply' | 'series-1' | 'series-2';
  /** steps: staircase from a named schedule; line/smooth: through `points`; points: the `points` alone, unconnected. */
  shape: 'steps' | 'line' | 'smooth' | 'points';
  /** Key into ChartData.schedules (for shape 'steps'). */
  schedule?: string;
  points?: Point[];
  /** true: a dot at each point (or each step's right edge); a list: dots only there. */
  dots?: boolean | Point[];
  /** Drawn faint and dashed: the original position of a curve the reader has shifted. */
  ghost?: boolean;
}

export interface PriceLine {
  price: number;
  label: string;
  /** A previous price, drawn dashed. */
  old?: boolean;
  /** Put the label under the line when a curve sits just above it. */
  labelBelow?: boolean;
}

/**
 * Shaded region between a staircase curve and a price.
 * cs: demand above price · tb: under demand up to Qd · tc: price × Qd
 * ps: supply below price · tvc: under supply up to Qs · tr: price × Qs
 */
export interface Area {
  kind: 'cs' | 'tb' | 'tc' | 'ps' | 'tvc' | 'tr';
  curve: string;
  price: number;
  faded?: boolean;
}

/** A marginal benefit or marginal cost schedule shared by several charts. */
export interface Schedule {
  description: string;
  steps: Step[];
  provenance: Provenance;
  provenanceNote?: string;
}

export interface ChartData {
  schedules: Record<string, Schedule>;
  charts: ChartSpec[];
}

export interface ChartLabel {
  at: Point;
  text: string;
  anchor?: 'start' | 'middle' | 'end';
  small?: boolean;
  /** States a value that holds only at the default price (e.g. "CS = $240"); hidden once the reader changes the chart. */
  value?: boolean;
}

/** One arc of a circular flow diagram. */
export interface FlowArc {
  key: string;
  label: string;
  /** goods: goods, services or labor; money: payments. */
  kind: 'goods' | 'money';
}

/** Two actors joined by an outer and an inner loop. Top arcs run right → left, bottom arcs left → right. */
export interface FlowSpec {
  left: string;
  right: string;
  outer: [top: FlowArc, bottom: FlowArc];
  inner: [top: FlowArc, bottom: FlowArc];
  legend: { goods: string; money: string };
  /** Text alternative for screen readers. */
  description: string;
}

export type Provenance = 'text' | 'derived' | 'read-from-image';

/** 100% stacked horizontal bars: each bar splits a whole into the same parts (e.g. time on strategy vs other work). */
export interface ShareSpec {
  /** The parts, in stacking order; colored series-1, series-2, … */
  parts: string[];
  bars: { label: string; values: number[] }[];
  /** Appended to values, e.g. "%". */
  unit?: string;
  /** Text alternative for screen readers. */
  description: string;
}

/** Labeled bubbles on two qualitative axes (low → high), e.g. a strategic group map. Coordinates run 0–10. */
export interface ScatterSpec {
  xTicks: [low: string, high: string];
  yTicks: [low: string, high: string];
  points: { label: string; x: number; y: number; /** Radius in axis units (an ellipse on non-square plots), as drawn. */ r: number }[];
  description: string;
}

/** A 2×2 framework grid. Rows run top to bottom; axis ticks run low → high (left → right, bottom → top). */
export interface MatrixSpec {
  xTicks?: [left: string, right: string];
  yTicks?: [bottom: string, top: string];
  cells: [[MatrixCell, MatrixCell], [MatrixCell, MatrixCell]];
  /** Text placed over the middle of the grid (e.g. hybrid strategies). */
  center?: string;
  description: string;
}

export interface MatrixCell {
  text: string;
  /** Colors the cell as a go / no-go signal; omit for neutral. */
  tone?: 'good' | 'bad' | 'caution';
}

export interface ChartSpec {
  id: string;
  kind: 'xy' | 'circular-flow' | 'share' | 'scatter' | 'matrix';
  title: string;
  figure: string;
  source: { pdf: string; page: number };
  /** Where the plotted numbers come from: stated in the PDF text, computed from it, or read off the figure image. */
  provenance: Provenance;
  provenanceNote?: string;
  xLabel?: string;
  yLabel?: string;
  xDomain?: [number, number];
  yDomain?: [number, number];
  yPrefix?: string;
  /** Decimal places on y values (default 2). Values of 1,000 and up get thousands separators when set. */
  yDecimals?: number;
  /** How x values read: as quantities (default), as years, or as decimal years with month ticks and dated readouts (2005.5 = Jul 1, 2005). */
  xFormat?: 'quantity' | 'year' | 'month';
  /** Name of the x variable in the hover readout for quantity axes (default "Q"). */
  xName?: string;
  curves?: Curve[];
  priceLines?: PriceLine[];
  areas?: Area[];
  /** Highlighted point, e.g. equilibrium E. */
  marker?: { at: Point; label: string };
  /** Dashed guide lines from a point to both axes. */
  guides?: Point[];
  labels?: ChartLabel[];
  /** Names for x = 0, 1, 2, … (a category axis): used as tick labels and in the hover readout. */
  xCategories?: string[];
  /** Text ticks in place of numbers on the y axis, e.g. [[0, "Low"], [10, "High"]]. */
  yTickLabels?: [number, string][];
  /** false hides the hover readout (for charts traced without real values). */
  readout?: boolean;
  /** For kind 'circular-flow'. */
  flow?: FlowSpec;
  share?: ShareSpec;
  scatter?: ScatterSpec;
  matrix?: MatrixSpec;
  /** Controls for the reader: drag the active price line, shift curves by id (in x units). */
  interactive?: { price?: { min: number; max: number; step: number }; shift?: { curves: string[]; range: number; step: number } };
}

// ---------- Classes, glossary, credits ----------

export interface LessonOutline {
  id: string;
  /** Without the "Lesson N:" prefix, which is added from the id when displayed. */
  title: string;
}

export interface ModuleOutline {
  id: string;
  /** Without the "Module N:" prefix. */
  title: string;
  lessons: LessonOutline[];
}

export interface ClassOutline {
  id: string;
  /** Short code, e.g. "MBA 702". */
  code: string;
  title: string;
  modules: ModuleOutline[];
}

export interface GlossaryEntry {
  id: string;
  term: string;
  /** Other spellings used by {"term"} marks, e.g. "Producer surplus (PS)". */
  aliases?: string[];
  definition: Rich;
}

/** A place a glossary term is marked: lesson "module/lesson", which view, and which section. */
export interface TermRef {
  lesson: string;
  view: 'summary' | 'reading';
  section: string;
  /** e.g. "Ch 3.2" or "Ch 1.1 §1.2". */
  label: string;
  title?: string;
}

/** The class glossary as stored: entries plus where each term appears (computed at upload). */
export interface Glossary {
  entries: GlossaryEntry[];
  appearsIn: Record<string, TermRef[]>;
}

export interface Credit {
  title: string;
  authors: string;
  publisher?: string;
  license: string;
  licenseUrl?: string;
  url?: string;
  /** Lessons ("module/lesson") that use this source. */
  usedIn: string[];
}
