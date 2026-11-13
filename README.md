# Undergrillion

A daily rare-answer trivia game for underground rap heads, from 2010 cloud rap to pluggnb to today's new wave. The deeper the cut, the more fans you gain. Go from bedroom SoundCloud uploads to the Rolling Loud main stage.

**Play:** https://jarrenrosadini-max.github.io/undergrillion/

## How it works
- **Daily Set:** 7 prompts, 25 s each, the same for everyone that day. **Open Mic:** endless practice at half the fans, with era filters.
- Type any correct answer and press Enter. If it's close to a known name, the game asks "Did you mean → ___?" ("carti" → Playboi Carti). Every prompt has at least one Elite Ball and one Day One answer, and the Daily Set is about 75% new underground. Rarity sets the score: Mainstream 5 · Common Ball 10 · Rare 25 · Niche 40 · Tapped In 60 · Elite Ball 80 · Day One 100. 3 tries per prompt.
- Points become fans (1 pt = 10 fans). The background is your current venue (11 of them, bedroom to stadium) and it reacts to every answer: rarer = faster, harder.

## Project layout
| Path | What it is |
|---|---|
| `site/` | The whole game (static HTML/CSS/JS, no build step). This folder is what gets published. |
| `site/data/questions.json` | Hand-curated prompts, plus the `solo` list: the only artists who get their own "Name a ___ song" prompts (everyone else appears inside broader ones, many tied to a year). Format: `{"id","era","p":prompt,"f":fact,"a":[[answer, tier, [aliases]]]}`. Eras: `early`, `soundcloud`, `pluggnb`, `opium`, `newwave`, `wildcard`. |
| `site/data/catalog.json` | **Generated.** Every roster artist's released discography (with popularity) + unreleased songs. Prompts like "Name a Che song" are built from it. |
| `site/data/leaks.json` | Hand-picked leak facts (plays, grails) merged into the catalog. |
| `tools/roster.json` | The artist list: scene, aliases, tracker sheet, archive accounts. Add an artist here and push. |
| `tools/build-catalog.mjs` | Pulls discographies (Deezer public API) and leaks (community tracker sheets + fan archive accounts). Runs in GitHub Actions on roster changes and every Monday. Writes `tools/catalog-report.md`. |
| `tools/overrides.json` | Pin the right Deezer artist when a name collides: `{"Che": {"deezerId": 123}}`. |
| `site/js/config.js` | Switches: `ADS_ENABLED`, timer length, attempts. |
| `tests/engine.test.mjs` | Checks matching + data. It runs before every deploy, so broken data never ships. |

## Adding questions
Add a line to `site/data/questions.json` and push. Tiers: 1 = most common, 6 = grail. Use aliases for spellings ($/s, `!`, nicknames). Matching already ignores case, spaces and punctuation and allows small typos.

## Catalog bot
Every Monday (and whenever `tools/roster.json` changes) the **Build catalog** workflow refreshes `site/data/catalog.json` and redeploys. Check `tools/catalog-report.md` after a run: it lists each artist's match, fan count, song counts and anything that wasn't found.

## Deploying
Every push to `main` deploys via `.github/workflows/deploy.yml` (Settings → Pages → Source must be **GitHub Actions**). All paths are relative, so a custom domain (Phase 4) needs only a `site/CNAME` file plus DNS. No code changes.

Fan-made. Leak questions name songs only; Undergrillion never hosts or links audio.
