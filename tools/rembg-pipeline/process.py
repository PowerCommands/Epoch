#!/usr/bin/env python3
"""Remove backgrounds from game asset images in a small local pipeline."""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from html import escape
from pathlib import Path
from typing import Any
from urllib.parse import quote

from PIL import Image
from rembg import new_session, remove


SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
REPORT_FILENAME = "report.json"
PREVIEW_FILENAME = "index.html"


@dataclass(frozen=True)
class Config:
    base_dir: Path
    input_root: Path
    output_root: Path
    reports_root: Path
    preview_root: Path
    limit: int | None
    force: bool
    dry_run: bool


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Remove backgrounds from images in input/ and write transparent PNGs to output/.",
    )
    parser.add_argument("--input", default="input", help="Input folder to scan. Default: input")
    parser.add_argument("--output", default="output", help="Output folder for PNGs. Default: output")
    parser.add_argument("--reports", default="reports", help="Report folder. Default: reports")
    parser.add_argument("--preview", default="preview", help="Preview folder. Default: preview")
    parser.add_argument("--limit", type=int, help="Process only the first N discovered images.")
    parser.add_argument("--force", action="store_true", help="Reprocess files even if output exists.")
    parser.add_argument("--dry-run", action="store_true", help="Scan and report without writing processed images.")
    return parser.parse_args()


def resolve_path(base_dir: Path, value: str) -> Path:
    path = Path(value)
    if path.is_absolute():
        return path
    return base_dir / path


def build_config(args: argparse.Namespace) -> Config:
    base_dir = Path(__file__).resolve().parent
    return Config(
        base_dir=base_dir,
        input_root=resolve_path(base_dir, args.input),
        output_root=resolve_path(base_dir, args.output),
        reports_root=resolve_path(base_dir, args.reports),
        preview_root=resolve_path(base_dir, args.preview),
        limit=args.limit,
        force=args.force,
        dry_run=args.dry_run,
    )


def discover_images(input_root: Path) -> list[Path]:
    if not input_root.exists():
        return []

    files = [
        path
        for path in input_root.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    ]
    files.sort(key=lambda path: path.relative_to(input_root).as_posix().lower())
    return files


def output_path_for(input_path: Path, input_root: Path, output_root: Path) -> Path:
    relative_path = input_path.relative_to(input_root)
    return output_root / relative_path.with_suffix(".png")


def display_path(path: Path, base_dir: Path) -> str:
    try:
        return path.relative_to(base_dir).as_posix()
    except ValueError:
        return str(path)


def process_file(input_path: Path, config: Config, session: Any | None) -> dict[str, Any]:
    output_path = output_path_for(input_path, config.input_root, config.output_root)
    relative_path = input_path.relative_to(config.input_root).as_posix()
    entry: dict[str, Any] = {
        "inputPath": str(input_path),
        "outputPath": str(output_path),
        "relativePath": relative_path,
        "status": "failed",
        "originalFormat": None,
        "outputFormat": "PNG",
        "width": None,
        "height": None,
    }

    try:
        with Image.open(input_path) as image:
            entry["originalFormat"] = image.format
            entry["width"] = image.width
            entry["height"] = image.height
            source = image.convert("RGBA")

        if config.dry_run:
            entry["status"] = "skipped"
            entry["error"] = "Dry run: output not written."
            print(f"[dry-run] {relative_path} -> {display_path(output_path, config.base_dir)}")
            return entry

        if output_path.exists() and not config.force:
            entry["status"] = "skipped"
            entry["error"] = "Output already exists. Use --force to reprocess."
            print(f"[skipped] {relative_path} (output exists)")
            return entry

        output_path.parent.mkdir(parents=True, exist_ok=True)
        result = remove(source, session=session)
        if not isinstance(result, Image.Image):
            raise TypeError("rembg returned an unsupported result type")
        result.convert("RGBA").save(output_path, format="PNG")

        entry["status"] = "processed"
        print(f"[processed] {relative_path} -> {display_path(output_path, config.base_dir)}")
        return entry
    except Exception as exc:  # noqa: BLE001 - per-file errors should not stop the batch.
        entry["status"] = "failed"
        entry["error"] = str(exc)
        print(f"[failed] {relative_path}: {exc}")
        return entry


def make_report(config: Config, files_found: int, file_entries: list[dict[str, Any]]) -> dict[str, Any]:
    processed_count = sum(1 for entry in file_entries if entry["status"] == "processed")
    skipped_count = sum(1 for entry in file_entries if entry["status"] == "skipped")
    failed_count = sum(1 for entry in file_entries if entry["status"] == "failed")
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "inputRoot": str(config.input_root),
        "outputRoot": str(config.output_root),
        "totalFilesFound": files_found,
        "processedCount": processed_count,
        "skippedCount": skipped_count,
        "failedCount": failed_count,
        "files": file_entries,
    }


def write_report(config: Config, report: dict[str, Any]) -> Path:
    config.reports_root.mkdir(parents=True, exist_ok=True)
    report_path = config.reports_root / REPORT_FILENAME
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report_path


def relative_url(from_dir: Path, target: Path) -> str:
    relative = os.path.relpath(target.resolve(), start=from_dir.resolve())
    return quote(Path(relative).as_posix(), safe="/.:_-")


def preview_card(config: Config, entry: dict[str, Any]) -> str:
    input_path = Path(entry["inputPath"])
    output_path = Path(entry["outputPath"])
    input_src = relative_url(config.preview_root, input_path)
    output_src = relative_url(config.preview_root, output_path)
    status = escape(str(entry["status"]))
    relative_path = escape(str(entry["relativePath"]))
    error = entry.get("error")
    error_html = f'<p class="error">{escape(str(error))}</p>' if error else ""

    if entry["status"] == "processed" or output_path.exists():
        output_html = f'<img src="{output_src}" alt="Processed {relative_path}">'
    else:
        output_html = '<div class="missing-output">No processed output</div>'

    return f"""
      <article class="card status-{status}">
        <header>
          <h2>{relative_path}</h2>
          <span>{status}</span>
        </header>
        <div class="comparison">
          <figure>
            <figcaption>Before</figcaption>
            <img src="{input_src}" alt="Original {relative_path}">
          </figure>
          <figure>
            <figcaption>After</figcaption>
            {output_html}
          </figure>
        </div>
        {error_html}
      </article>
    """


def write_preview(config: Config, report: dict[str, Any]) -> Path:
    config.preview_root.mkdir(parents=True, exist_ok=True)
    cards = "\n".join(preview_card(config, entry) for entry in report["files"])
    if not cards:
        cards = '<p class="empty">No supported image files were found.</p>'

    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>rembg pipeline preview</title>
  <style>
    :root {{
      color-scheme: light dark;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #111827;
      color: #e5e7eb;
    }}
    body {{
      margin: 0;
      padding: 24px;
    }}
    h1 {{
      margin: 0 0 8px;
      font-size: 28px;
    }}
    .summary {{
      margin: 0 0 24px;
      color: #aab4c4;
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 16px;
    }}
    .card {{
      border: 1px solid #334155;
      border-radius: 8px;
      background: #182234;
      overflow: hidden;
    }}
    .card header {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      border-bottom: 1px solid #334155;
    }}
    .card h2 {{
      margin: 0;
      font-size: 15px;
      overflow-wrap: anywhere;
    }}
    .card span {{
      border-radius: 999px;
      padding: 3px 9px;
      background: #334155;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }}
    .status-processed span {{ background: #14532d; }}
    .status-skipped span {{ background: #713f12; }}
    .status-failed span {{ background: #7f1d1d; }}
    .comparison {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1px;
      background: #334155;
    }}
    figure {{
      margin: 0;
      padding: 12px;
      background:
        linear-gradient(45deg, #1f2937 25%, transparent 25%),
        linear-gradient(-45deg, #1f2937 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #1f2937 75%),
        linear-gradient(-45deg, transparent 75%, #1f2937 75%);
      background-color: #111827;
      background-size: 24px 24px;
      background-position: 0 0, 0 12px, 12px -12px, -12px 0;
      min-height: 180px;
    }}
    figcaption {{
      margin-bottom: 8px;
      color: #cbd5e1;
      font-size: 13px;
      font-weight: 700;
    }}
    img {{
      display: block;
      max-width: 100%;
      max-height: 420px;
      margin: 0 auto;
      object-fit: contain;
    }}
    .missing-output {{
      display: grid;
      place-items: center;
      min-height: 160px;
      color: #cbd5e1;
      border: 1px dashed #64748b;
      background: rgba(15, 23, 42, 0.72);
    }}
    .error {{
      margin: 0;
      padding: 12px 14px;
      color: #fecaca;
      border-top: 1px solid #7f1d1d;
      background: rgba(127, 29, 29, 0.28);
      overflow-wrap: anywhere;
    }}
    .empty {{
      padding: 16px;
      border: 1px solid #334155;
      border-radius: 8px;
      background: #182234;
    }}
  </style>
</head>
<body>
  <h1>rembg pipeline preview</h1>
  <p class="summary">
    Generated {escape(str(report["generatedAt"]))}.
    Files found: {report["totalFilesFound"]};
    processed: {report["processedCount"]};
    skipped: {report["skippedCount"]};
    failed: {report["failedCount"]}.
  </p>
  <main class="grid">
    {cards}
  </main>
</body>
</html>
"""
    preview_path = config.preview_root / PREVIEW_FILENAME
    preview_path.write_text(html, encoding="utf-8")
    return preview_path


def main() -> int:
    config = build_config(parse_args())
    all_files = discover_images(config.input_root)
    files = all_files[: max(0, config.limit)] if config.limit is not None else all_files
    session = None if config.dry_run or not files else new_session()
    entries = [process_file(path, config, session) for path in files]
    report = make_report(config, len(all_files), entries)
    report_path = write_report(config, report)
    preview_path = write_preview(config, report)

    print()
    print(f"Files found: {report['totalFilesFound']}")
    print(f"Processed: {report['processedCount']}")
    print(f"Skipped: {report['skippedCount']}")
    print(f"Failed: {report['failedCount']}")
    print(f"Report: {report_path}")
    print(f"Preview: {preview_path}")
    return 1 if report["failedCount"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
