# Background Removal Pipeline

This tool removes backgrounds from game asset images placed in `input/` and writes transparent PNG files to `output/`. It also writes a machine-readable report and a local HTML before/after preview page.

The pipeline is intentionally isolated under `tools/rembg-pipeline/` and does not modify game source files.

## Setup

The virtual environment is expected to already contain `rembg`, `rembg[cpu]`, `pillow`, and `onnxruntime`.

Activate it from this folder:

```bash
source .venv/bin/activate
```

If setup is ever needed again, install the dependencies inside the venv:

```bash
python -m pip install "rembg[cpu]" pillow onnxruntime
```

## Input

Copy source images into `input/`. Nested folders are supported and preserved in `output/`.

Examples:

```text
input/units/warrior.png
input/leaders/gustav-vasa.jpg
```

The generated files will be:

```text
output/units/warrior.png
output/leaders/gustav-vasa.png
```

Supported input extensions:

- `.png`
- `.jpg`
- `.jpeg`
- `.webp`

## Usage

Run from `tools/rembg-pipeline/`:

```bash
source .venv/bin/activate
python process.py
python process.py --limit 5
python process.py --force
python process.py --dry-run
```

Useful options:

- `--input input` sets the source folder.
- `--output output` sets the processed PNG folder.
- `--reports reports` sets the report folder.
- `--preview preview` sets the preview folder.
- `--limit 5` processes only the first 5 discovered images.
- `--force` reprocesses files even when output already exists.
- `--dry-run` scans and writes report/preview metadata without writing processed images.

## Output

The tool writes:

- Transparent PNG files to `output/`
- JSON report to `reports/report.json`
- HTML preview to `preview/index.html`

Open `preview/index.html` in a browser to compare original and processed images.
