/**
 * Streaming PDF generator for realistic, *large* claim documents.
 *
 * Why hand-written instead of pdf-lib? pdf-lib builds the whole document in memory, which does
 * not work for 1 GB files. This writer streams object by object to disk, keeps only the xref
 * offsets in memory (O(pages)), and produces a standards-compliant PDF that pdf.js can open
 * with HTTP Range requests (xref table at the end, uncompressed objects).
 *
 * Usage:
 *   npm run generate:docs                      # small samples committed to the repo
 *   npm run generate:docs -- --preset large    # 250 MB + 1 GB documents (git-ignored)
 *   npm run generate:docs -- --name my-doc --pages 400 --mb 300
 */
import { once } from 'node:events';
import { createWriteStream, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const PAGE_WIDTH = 612; // US Letter, PDF points
const PAGE_HEIGHT = 792;

interface DocumentSpec {
  id: string;
  name: string;
  pages: number;
  /** Approximate target size in MB. Bulk comes from a "scanned" grayscale image per page. */
  targetMb: number;
  title: string;
}

interface ManifestEntry {
  id: string;
  name: string;
  file: string;
  pageCount: number;
  sizeBytes: number;
  pageWidth: number;
  pageHeight: number;
}

const SAMPLE_PRESET: DocumentSpec[] = [
  { id: 'fnol-report', name: 'FNOL Report.pdf', pages: 12, targetMb: 0.6, title: 'First Notice of Loss' },
  {
    id: 'medical-records',
    name: 'Medical Records.pdf',
    pages: 160,
    targetMb: 3,
    title: 'Medical Records Bundle',
  },
  {
    id: 'loss-photos',
    name: 'Loss Photos & Estimates.pdf',
    pages: 48,
    targetMb: 1.5,
    title: 'Loss Photos & Repair Estimates',
  },
];

const LARGE_PRESET: DocumentSpec[] = [
  {
    id: 'claim-archive-250mb',
    name: 'Claim Archive (250 MB).pdf',
    pages: 600,
    targetMb: 250,
    title: 'Claim Archive',
  },
  {
    id: 'litigation-bundle-1gb',
    name: 'Litigation Bundle (1 GB).pdf',
    pages: 1500,
    targetMb: 1024,
    title: 'Litigation Bundle',
  },
];

const ascii = (text: string) => text.replace(/[()\\]/g, '').replace(/[^\x20-\x7E]/g, '-');

/** Deterministic "paper texture" so builds are reproducible and the image looks like a scan. */
function createScanTexture(side: number): Buffer {
  const buf = Buffer.allocUnsafe(side * side);
  let seed = 0x2f6b4a1;
  for (let i = 0; i < buf.length; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const row = Math.floor(i / side);
    const ruled = row % 48 < 2 ? 40 : 0; // faint ruled lines like a form
    buf[i] = 228 + ((seed >>> 0) % 26) - ruled;
  }
  return buf;
}

function pageContent(spec: DocumentSpec, index: number, hasImage: boolean): string {
  const n = index + 1;
  const lines = [
    'BT /F1 9 Tf 0.45 0.45 0.5 rg 50 760 Td (ABC INSURANCE  -  CLAIMS DIVISION  -  CONFIDENTIAL) Tj ET',
    `BT /F1 20 Tf 0.13 0.13 0.2 rg 50 728 Td (${ascii(spec.title)}) Tj ET`,
    `BT /F1 10 Tf 0.35 0.35 0.4 rg 50 710 Td (Document ${ascii(spec.id)}  -  Page ${n} of ${spec.pages}) Tj ET`,
    '0.35 0.2 0.92 RG 2 w 50 698 m 562 698 l S',
  ];
  const fields = ['Policy holder', 'Date of loss', 'Line of business', 'Reported via', 'Reserve (USD)'];
  fields.forEach((field, i) => {
    const y = 672 - i * 18;
    lines.push(`BT /F1 10 Tf 0.3 0.3 0.35 rg 50 ${y} Td (${field}:) Tj ET`);
    lines.push(`0.8 0.8 0.85 RG 0.5 w 160 ${y - 3} m 562 ${y - 3} l S`);
  });
  if (hasImage) {
    lines.push('q 512 0 0 400 50 150 cm /Im1 Do Q');
    lines.push('0.75 0.75 0.8 RG 1 w 50 150 512 400 re S');
  }
  lines.push(`BT /F1 54 Tf 0.36 0.2 0.92 rg 240 ${hasImage ? 80 : 360} Td (${n}) Tj ET`);
  lines.push(`BT /F1 8 Tf 0.5 0.5 0.55 rg 50 40 Td (Generated sample for the ClaimSphere case study) Tj ET`);
  return lines.join('\n');
}

async function writePdf(spec: DocumentSpec, outFile: string): Promise<number> {
  const out = createWriteStream(outFile);
  let offset = 0;
  const offsets: number[] = [];

  const write = async (chunk: string | Buffer) => {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk, 'latin1') : chunk;
    offset += buf.length;
    if (!out.write(buf)) await once(out, 'drain'); // back-pressure keeps memory flat
  };
  const beginObject = async (id: number) => {
    offsets[id] = offset;
    await write(`${id} 0 obj\n`);
  };

  const bytesPerPage = Math.max(0, (spec.targetMb * 1024 * 1024) / spec.pages - 2_000);
  const imageSide = bytesPerPage > 10_000 ? Math.floor(Math.sqrt(bytesPerPage)) : 0;
  const texture = imageSide ? createScanTexture(imageSide) : null;

  /*
   * "Web-optimized" layout (what `qpdf --linearize` style tools produce): every page dictionary
   * and content stream is written contiguously at the HEAD of the file, the bulky images after.
   * Locating page N means walking the page tree; with this layout that walk touches only the first
   * ~1–2 MB (fetched once), and each page then costs exactly one Range request for its image.
   * An interleaved layout would force pdf.js to pull a chunk next to *every* preceding page.
   */
  const pageId = (i: number) => 4 + i;
  const contentId = (i: number) => 4 + spec.pages + i;
  const imageId = (i: number) => 4 + spec.pages * 2 + i;

  await write('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n');
  await beginObject(1);
  await write('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  await beginObject(2);
  const kids = Array.from({ length: spec.pages }, (_, i) => `${pageId(i)} 0 R`).join(' ');
  await write(`<< /Type /Pages /Count ${spec.pages} /Kids [${kids}] >>\nendobj\n`);
  await beginObject(3);
  await write('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

  for (let i = 0; i < spec.pages; i++) {
    const resources = texture
      ? `<< /Font << /F1 3 0 R >> /XObject << /Im1 ${imageId(i)} 0 R >> >>`
      : `<< /Font << /F1 3 0 R >> >>`;
    await beginObject(pageId(i));
    await write(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources ${resources} /Contents ${contentId(i)} 0 R >>\nendobj\n`,
    );
  }
  for (let i = 0; i < spec.pages; i++) {
    const content = pageContent(spec, i, Boolean(texture));
    await beginObject(contentId(i));
    await write(
      `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream\nendobj\n`,
    );
  }
  if (texture) {
    for (let i = 0; i < spec.pages; i++) {
      await beginObject(imageId(i));
      await write(
        `<< /Type /XObject /Subtype /Image /Width ${imageSide} /Height ${imageSide} /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${texture.length} >>\nstream\n`,
      );
      await write(texture);
      await write('\nendstream\nendobj\n');
    }
  }

  const xrefOffset = offset;
  const size = offsets.length;
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let id = 1; id < size; id++) xref += `${String(offsets[id] ?? 0).padStart(10, '0')} 00000 n \n`;
  await write(xref);
  await write(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  out.end();
  await once(out, 'finish');
  return offset;
}

function updateManifest(file: string, entries: ManifestEntry[]) {
  const existing: ManifestEntry[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  const byId = new Map(existing.map((e) => [e.id, e]));
  entries.forEach((e) => byId.set(e.id, e));
  writeFileSync(file, `${JSON.stringify([...byId.values()], null, 2)}\n`);
}

async function main() {
  const { values } = parseArgs({
    options: {
      preset: { type: 'string', default: 'samples' },
      name: { type: 'string' },
      pages: { type: 'string' },
      mb: { type: 'string' },
    },
  });

  const root = resolve(import.meta.dirname, '..', 'public', 'documents');
  let specs: DocumentSpec[];
  let dir: string;
  // Committed samples are bundled into the mock backend; large files are discovered at runtime.
  let manifestFile: string;

  if (values.name) {
    const id = values.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    specs = [
      {
        id,
        name: `${values.name}.pdf`,
        pages: Number(values.pages ?? 500),
        targetMb: Number(values.mb ?? 200),
        title: values.name,
      },
    ];
    dir = join(root, 'large');
    manifestFile = join(dir, 'manifest.json');
  } else if (values.preset === 'large') {
    specs = LARGE_PRESET;
    dir = join(root, 'large');
    manifestFile = join(dir, 'manifest.json');
  } else {
    specs = SAMPLE_PRESET;
    dir = root;
    manifestFile = resolve(import.meta.dirname, '..', 'src', 'mocks', 'data', 'sample-documents.json');
  }

  mkdirSync(dir, { recursive: true });
  const entries: ManifestEntry[] = [];
  for (const spec of specs) {
    const file = `${spec.id}.pdf`;
    const started = performance.now();
    const sizeBytes = await writePdf(spec, join(dir, file));
    const secs = ((performance.now() - started) / 1000).toFixed(1);
    console.info(`✔ ${file}  ${spec.pages} pages  ${(sizeBytes / 1024 / 1024).toFixed(1)} MB  (${secs}s)`);
    entries.push({
      id: spec.id,
      name: spec.name,
      file,
      pageCount: spec.pages,
      sizeBytes,
      pageWidth: PAGE_WIDTH,
      pageHeight: PAGE_HEIGHT,
    });
  }
  updateManifest(manifestFile, entries);
}

await main();
