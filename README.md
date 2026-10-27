# United Realm: Spirit of the Twilight Vale (demo)

A pixel-art rewrite of the game: from the title menu you go straight into the boss arena against **Lord Kagetora, the Blighted Mask**.

**Created by Spian45 and Charlotte_B**. World: Charlotte_B. Music: Spian45. Testers: Muh. Gibran.

## Run it
Double-click **`run_game.bat`**, or run `python tools/serve.py` and open http://localhost:8000. (The server disables browser caching so a refresh always loads the latest code.)
(It has to be served over http; opening `index.html` directly won't load the ES modules.)

## Controls
| Action | Keys |
| :--- | :--- |
| Move | `A` / `D` or arrows |
| Walk (hold) | `C` |
| Jump / double jump | `W` / `Space` / `↑` |
| Drop through platform | `S` + jump |
| Slam attack (in the air) | `S` / `↓`: dive down; land on the boss's head to bounce off it |
| Dash / perfect dodge | `Shift` / `L`: dash *through* an attack in the first 0.16s for a perfect dodge (slow-mo, +20 mana, dash reset, next hit x1.5) |
| 3-hit combo | `J` / `Z` / left click |
| Foxfire (25 mana, homing) | `K` / `X` / right click |
| Pause / controls | `Esc` / `P` |
| Restart | `R` |
| Quit to title (paused or end screen) | `Q` |
| Debug mode | `F3` or `` ` `` |

## Debug mode
Press `F3` (or the backtick key) to turn it on. It shows hitboxes, a live stats panel (FPS, player and boss state, timers, counts), and enables these cheat keys:

| Key | Effect |
| :--- | :--- |
| `G` | God mode (no damage) |
| `F` | Freeze the boss AI |
| `T` | Slow motion (0.25x) |
| `H` | Show/hide hitboxes |
| `1`–`5` | Force attack: orbs, slam, claws, sweep, pillars (phase 2 only) |
| `6` | Skip to phase 2 |
| `9` | Kill the boss |
| `0` | Refill HP and mana |

## The boss
- **Phase I**: blight orb fans, the **mask slam** (jump the shockwaves, then punish the stun for 1.5x damage), claw strikes, and a low **sweep** (dodge it with a dash or by standing on a platform).
- **Phase II** (below 50% HP): the mask cracks and the scene turns blood red. Attacks get faster, the boss gains extra volleys and blight **pillars**, and the music speeds up.

## Project layout
- `src/main.js`: game loop, camera, combat resolution, game states
- `src/arena.js`: the arena (autumn parallax layers, floor tiles, decor, torches)
- `src/player.js`: player controller
- `src/character.js`: **character definition. Swap sprite sheets and sizes here to change the character.**
- `src/boss.js`: boss sprite (procedural pixel art) + AI
- `src/projectiles.js`: foxfire, orbs, shockwaves, pillars
- `src/title.js`: title menu (start, gallery, display mode, controls, credits)
- `src/gallery.js`: gallery: animation viewer, music player, sound test
- `src/hud.js`, `src/font.js`: pixel HUD and 5x7 bitmap font
- `src/fx.js`: particles, damage numbers, afterimages
- `src/audio.js`: procedural sound effects
- `src/music.js`: composed procedural soundtrack (title theme, two-phase boss theme, victory/defeat jingles)
- `tools/serve.py`: local server with browser caching disabled (used by `run_game.bat`)
- `_old_version/`: backup of the previous waterfall-stage version

Internal resolution is 640x360. **Display** on the title menu switches between *Fill Screen* (default: scales to fill the window) and *Pixel Perfect* (whole-number scaling only, every pixel exactly square, may leave a border). The choice is remembered.
Type `game` in the browser console to inspect the live game state.
