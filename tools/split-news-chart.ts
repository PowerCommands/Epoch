import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "canvas";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_PATH = resolve(
  PROJECT_ROOT,
  "public/assets/sprites/news/news-chart.png",
);
const OUTPUT_DIR = dirname(SOURCE_PATH);

const EXPECTED_SOURCE_SIZE = { width: 1536, height: 1024 } as const;
const OUTPUT_SIZE = { width: 320, height: 224 } as const;

// The sheet has a visually regular 5 x 4 layout, but its generated divider
// positions vary by a few pixels. These bounds exclude the black dividers.
const columns = [
  { x: 7, width: 284 },
  { x: 294, width: 295 },
  { x: 592, width: 297 },
  { x: 892, width: 313 },
  { x: 1208, width: 321 },
] as const;

// Each height ends immediately above its row's explanatory label band.
const rows = [
  { y: 8, height: 215 },
  { y: 265, height: 215 },
  { y: 515, height: 190 },
  { y: 747, height: 225 },
] as const;

const filenames = [
  [
    "victory.png",
    "nation-defeated.png",
    "capital-lost.png",
    "war-declared.png",
    "alliance-formed.png",
  ],
  [
    "city-captured.png",
    "peace-signed.png",
    "war-joined.png",
    "world-council-founded.png",
    "major-resolution.png",
  ],
  [
    "wonder-built.png",
    "new-era.png",
    "corporation-founded.png",
    "government-changed.png",
    "discovery.png",
  ],
  [
    "city-founded.png",
    "first-contact.png",
    "trade-route.png",
    "embassy-established.png",
    "trade-relations.png",
  ],
] as const;

async function main(): Promise<void> {
  const source = await loadImage(SOURCE_PATH);

  if (
    source.width !== EXPECTED_SOURCE_SIZE.width ||
    source.height !== EXPECTED_SOURCE_SIZE.height
  ) {
    throw new Error(
      `Expected ${EXPECTED_SOURCE_SIZE.width}x${EXPECTED_SOURCE_SIZE.height} source, ` +
        `received ${source.width}x${source.height}`,
    );
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];

    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const column = columns[columnIndex];
      const canvas = createCanvas(OUTPUT_SIZE.width, OUTPUT_SIZE.height);
      const context = canvas.getContext("2d");

      // Preserve aspect ratio and every illustration pixel. The source artwork
      // already fades to near-black at its edges, so black is unobtrusive padding.
      context.fillStyle = "#000000";
      context.fillRect(0, 0, OUTPUT_SIZE.width, OUTPUT_SIZE.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      const scale = Math.min(
        OUTPUT_SIZE.width / column.width,
        OUTPUT_SIZE.height / row.height,
      );
      const destinationWidth = Math.round(column.width * scale);
      const destinationHeight = Math.round(row.height * scale);
      const destinationX = Math.floor((OUTPUT_SIZE.width - destinationWidth) / 2);
      const destinationY = Math.floor((OUTPUT_SIZE.height - destinationHeight) / 2);

      context.drawImage(
        source,
        column.x,
        row.y,
        column.width,
        row.height,
        destinationX,
        destinationY,
        destinationWidth,
        destinationHeight,
      );

      const outputPath = resolve(OUTPUT_DIR, filenames[rowIndex][columnIndex]);
      await writeFile(outputPath, canvas.toBuffer("image/png"));
      console.log(
        `${filenames[rowIndex][columnIndex]}: ` +
          `${column.width}x${row.height} source -> ` +
          `${OUTPUT_SIZE.width}x${OUTPUT_SIZE.height}`,
      );
    }
  }
}

await main();
