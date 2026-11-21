# NOCTURNE — Static HTML

This is a static site (HTML/CSS/JavaScript/JSON). No PHP or server-side editor is included.

## Run locally (important)
Do **not** open `index.html` directly with a `file://` URL. Browsers block `fetch()` from reading the character manifest and JSON files in that mode, so the orbit appears empty.

- Windows: double-click `run-local.bat` (requires Python installed), then open `http://localhost:8000`.
- Or run `python -m http.server 8000` in this folder and visit `http://localhost:8000`.
- On GitHub Pages, the site works over HTTP automatically.

## Add a character
1. Create a folder in `karakter/`, with `image/` and optionally `video/`.
2. Copy/edit `data.json` and `informasi.md` from a sample character.
3. Add image/video paths to the data JSON.
4. Add the folder name to `karakter/manifest.json`.

## Add music
Put audio files in `music/`, then add their relative paths in `music-data.json`. The player accepts local audio paths; it does not stream YouTube/Spotify links. A short original demo tone is included.
