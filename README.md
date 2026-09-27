# Robotics with mBot2: AI Vision & Programming

Interactive class demos for a 12-session mBot2 course (sessions 2–11).
Left: mBlock-style block code that highlights the running block. Right: a 3D mBot2 simulation with a compass.

**Live site:** https://benchvue.github.io/mbot2/

## Sessions
| # | Demo | Concepts |
|---|---|---|
| 1 | Build Day | Assemble mBot2 (no demo) |
| 2 | Hello, mBot2! | Sequence |
| 3 | Shape Artist | Repeat loops, angles |
| 4 | Traffic Light Robot | If / else, color sensor |
| 5 | Line Follower | Forever, nested if |
| 6 | Parking Assistant | Variables, sensor math |
| 7 | Obstacle Avoider | Comparison, random numbers |
| 8 | Music & Light Show | My Blocks, parallel scripts |
| 9 | Ball Chaser | AI vision: tracking |
| 10 | AI Sign Explorer | AI vision: recognition |
| 11 | Robot Train Mission | Combine everything |
| 12 | Project Day | Student projects (no demo) |

## Run
Static site, no server needed.
- **Online:** GitHub Pages (below)
- **Offline check:** open `index.html` in Chrome/Edge (internet needed for three.js and fonts)

## Publish with GitHub Pages
1. Push these files to the root of the `main` branch.
2. Repo → **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main`, folder `/ (root)` → Save.
3. After about a minute the site is at `https://benchvue.github.io/mbot2/`.

## Edit the demos
Demo programs live in `tools/demos.py` (block helper functions keep it short):
```bash
cd tools
python build_data.py   # rewrites data/demos.js
```
Commit `data/demos.js` afterwards. Python is only needed for editing, not for hosting.

## Export (toolbar → Export)
- **mBlock Python (.py)** – paste into mBlock 5 → Upload mode → Python tab. Check smart-camera calls on your firmware.
- **Block sheet (.png)** – printable picture of the blocks
- **Program data (.json)**

## Files
```
index.html
css/style.css
data/demos.js          generated demo data
js/sim-core.js         worlds, sensors, robot motion (cm, north = -Z)
js/interpreter.js      block runner (variables, My Blocks, parallel scripts)
js/blocks.js           block drawing + yellow highlight
js/scene3d.js          three.js world and mBot2 model
js/export.js           Python / PNG / JSON export
js/audio.js            sounds and notes
js/app.js              UI, compass, sensor panel
tools/demos.py         demo source
tools/build_data.py    demos.py -> data/demos.js
```
