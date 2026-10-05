# Music Toolbox

An offline-first, installable chord laboratory: explore chords on piano, guitar and ukulele, write songs with chords right in the lyrics, and run setlists on stage.

**This project has no subfolders.** Every file sits in one folder so it uploads to GitHub in one go. File names carry their old folder as a prefix, so related files sort together (`music-chords-parse.ts`, `storage-backup.ts`, `app-Songs.tsx`).

## Run
```bash
npm install
npm run dev      # development
npm test         # 200+ tests
npm run build    # type-check + production build into dist/
```

## Status
| Area | State |
|---|---|
| Music engine (notes, intervals, chords, identification, transposition, chord-symbol parser) | done, tested |
| Chord Lab (12 roots, 30 chord types, note picker, identification, transpose) | done |
| Guitar / ukulele shapes (generated and ranked, browsable, tap to edit with live chord detection) | done, tested |
| Piano view, audio playback | done |
| Songs: write chords inline, `[G]Amazing [C]grace`; chords drawn above the words; tap a chord for shapes | done, tested |
| Songs: import a pasted chord sheet (chords above lyrics, or ChordPro), export `.cho` | done, tested |
| Setlists + Performance Mode | done, tested |
| Storage (IndexedDB, migrations, backup/import) | done, tested |
| PWA (manifest, icons, offline service worker, update prompt) | done, tested against a fake worker |
| Search (chords under any spelling, several chords at once, words, lyrics), Recent, Favorites | done, tested |
| Save, rename and delete your own fretboard shapes (shown first for that chord, found in Search, included in backups) | done, tested |
| Custom tunings, more instruments | next |
| Custom tunings, more instruments | later |

## Files, by prefix
| Prefix | What it is |
|---|---|
| `music-*` | pure music theory, no React: notes, intervals, chords (including `music-chords-parse.ts` and `music-chords-identification.ts`), scales, theory |
| `instruments-*` | instrument views and `instruments-stringed-shapes.ts`, the fingering search |
| `search-engine.ts` | the search ranking and chord matching (pure, tested) |
| `saved-shapes.ts`, `app-useSavedShapes.ts` | saved-shape rules (which shapes belong to which chord, rename-instead-of-duplicate) and the hook the fretboard uses |
| `songs-*`, `setlists-*` | data types and logic (chord-sheet parser, line layout, setlist operations, performance view data) |
| `storage-*` | IndexedDB, repositories, versioned migrations, backup/import |
| `playback-*` | Web Audio engine |
| `app-*` | screens and components (`app-Songs.tsx`, `app-Setlists.tsx`, `app-PerformanceMode.tsx`, ...) and `app-styles.css` |
| `*.test.ts(x)` | tests |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | PWA files, copied into the build untouched |

Barrel files are named after their old folder: `music-chords.ts` re-exports everything in `music-chords-*.ts`. To change the database, add a numbered entry to `MIGRATIONS` in `storage-db.ts`; never edit an old one.

## Putting it on GitHub
1. Create a repository and use **Add file → Upload files**. Drag in everything from this folder. GitHub accepts up to 100 files per upload; there are fewer than that here. Do not upload `node_modules` or `dist` (the `.gitignore` already names them).
2. **Publish with GitHub Pages (automatic):** in the repository choose **Add file → Create new file**, type `.github/workflows/deploy.yml` as the name (typing the slashes makes the folders), paste in the contents of `github-pages-workflow.yml`, and commit. Then **Settings → Pages → Source: GitHub Actions**. Every push to `main` now tests, builds and publishes.
3. **Publish by hand instead:** run `npm run build`; `dist/` is also flat (8 files). Upload those files to the root of a branch or repository served by GitHub Pages.

Open the published address once while online and use *Add to Home screen*; after that it opens offline. A new release shows an "Update now" banner.

## Notes
- `sw.js` carries two placeholders that the build fills in (a version, and the list of files to cache). Don't remove them. See `vite.config.ts`.
- A setlist slot stores a semitone `transpose`; Performance Mode transposes chord symbols on the fly, so the song itself is never changed.
- The song editor stores chords as symbols (`F#m7/A`), not as references, so songs survive reloads and engine changes.
