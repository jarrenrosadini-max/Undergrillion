# Undergrillion

A daily rare-answer trivia game for underground rap heads, from 2010 cloud rap to pluggnb to today's new wave. The deeper the cut, the more fans you gain. Go from bedroom SoundCloud uploads to the Rolling Loud main stage.

**Play:** https://jarrenrosadini-max.github.io/undergrillion/

## How it works
- **Daily Set:** 7 prompts, 25 s each, the same for everyone that day. **Open Mic:** endless practice at half the fans, with era filters.
- Type any correct answer. Rarity sets the score: Common Ball 10 · Playlist Pick 25 · Heads Know 40 · Deep Cut 60 · Vault 80 · Day One 100. You get 3 tries per prompt.
- Points become fans (1 pt = 10 fans), and fans unlock 11 venues up to Rolling Loud and a secret stadium.

## Project layout
| Path | What it is |
|---|---|
| `site/` | The whole game (static HTML/CSS/JS, no build step). This folder is what gets published. |
| `site/data/questions.json` | Hand-curated prompts. Format: `{"id","era","p":prompt,"f":fact,"a":[[answer, tier, [aliases]]]}`. Eras: `early`, `soundcloud`, `pluggnb`, `opium`, `newwave`, `wildcard`. |
| `site/data/leaks.json` | Leak titles (no links, no audio). Leak prompts are generated from this automatically. |
| `site/js/config.js` | Switches: `ADS_ENABLED`, timer length, attempts. |
| `tools/update-leaks.mjs` + `tools/trackers.json` | Weekly leak bot. |
| `tests/engine.test.mjs` | Checks matching + data. It runs before every deploy, so broken data never ships. |

## Adding questions
Add a line to `site/data/questions.json` and push. Tiers: 1 = most common, 6 = grail. Use aliases for spellings ($/s, `!`, nicknames). Matching already ignores case, spaces and punctuation and allows small typos.

## Leak bot
Every Monday, `.github/workflows/update-leaks.yml` reads the public community tracker sheets listed in `tools/trackers.json` and opens a **pull request** with any new leaks. Nothing goes live until you merge it.
**Setup:** fill in each artist's `sheetId` (open the artist on unreleased.world → "Open the tracker sheet" → copy the ID from the URL). Artists without a sheetId are skipped. Run it any time from Actions → "Weekly leak update" → Run workflow.

## Deploying
Every push to `main` deploys via `.github/workflows/deploy.yml` (Settings → Pages → Source must be **GitHub Actions**). All paths are relative, so a custom domain (Phase 4) needs only a `site/CNAME` file plus DNS. No code changes.

Fan-made. Leak questions name songs only; Undergrillion never hosts or links audio.
