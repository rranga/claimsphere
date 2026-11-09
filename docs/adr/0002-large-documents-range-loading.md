# ADR-0002: Large documents via HTTP Range + pdf.js in a worker

**Status:** Accepted

## Context

Claim documents are 100 MB – 1 GB (scanned bundles, litigation files). Users need to open them quickly, jump anywhere, and edit their structure (split, merge, reorder, rotate, delete).

## Options

1. **Download the whole file**: impossible UX at 1 GB, and it exhausts browser memory.
2. **Server-rendered page tiles/images** (like Google Maps): fastest first paint, works on weak devices, server controls the bytes. The cost is a rendering pipeline, storage for renditions at several zoom levels, no text layer without extra work, and latency for every zoom level.
3. **pdf.js with Range requests**: renders the original file client-side and downloads only the bytes needed. No rendition pipeline. Needs CPU on the client, and works best with web-optimized (linearized) PDFs.

## Decision

Option 3 for this implementation:

- A **custom `PDFDataRangeTransport`**, because the size is known from the manifest. This skips pdf.js' probing full GET; every network byte is an explicit, abortable, counted Range request.
- 256 KB chunks, `disableAutoFetch`, parsing and rasterizing in pdf.js' **Web Worker**.
- **Virtualized** page list and thumbnails, with exact page heights from the manifest.
- Render after 60 ms of scroll idle; cancel on unmount; set `canvas.width = 0` to free bitmaps; cap DPR at 2. An LRU of 4 open documents.

**Structural edits never touch bytes on the client.** A document is an ordered list of `PageRef {id, fileId, sourcePageIndex, rotation}`. Split, merge and reorder are list operations, O(pages) regardless of file size. The server materializes the result.

## Findings

PDF layout matters as much as the client. With an interleaved layout (page dictionary next to each image), finding page 360 made pdf.js fetch **152 MB** of a 250 MB file, because it walks the page tree. With a head-first (linearized-style) layout it fetched **~10 MB**. The ingestion pipeline should therefore **linearize** documents (`qpdf --linearize`) as part of OCR and normalization.

## Consequences

- 1 GB file: first page in under 2 s after fetching 6.6 MB; jumping to page 900 adds ~10 MB.
- Storage must serve `206 Partial Content` without `Content-Encoding`. The transport fails loudly otherwise.
- A hybrid is a natural next step: server thumbnails for the rail (cheap images) plus pdf.js for the main view.
