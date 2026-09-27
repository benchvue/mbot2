# Robotics with mBot2: AI Vision & Programming

Interactive class demos for a 12-session mBot2 course (sessions 2–11).
Left: mBlock-style block code that highlights the running block. Right: a 3D mBot2 simulation with a compass.

**Live site:** https://benchvue.github.io/mbot2/

## Sessions
| # | Demo | Concepts |
|---|---|---|
| 1 | Build Day | Parts checklist, real-size screw ruler, 11 steps, AI Camera 2.0 |
| 2 | Hello, mBot2! | Sequence |
| 3 | Shape Artist | Repeat loop |
| 4 | Wall Bounce | Ultrasonic distance, if / else |
| 5 | Line Follower | Line sensor, steering |
| 6 | Traffic Light Robot | Color sensor |
| 7 | AI Color Guard | AI Camera 2.0: learn & find a color |
| 8 | Ball Chaser | AI Camera 2.0: x-coordinate tracking |
| 9 | AprilTag Explorer | AI Camera 2.0: tags & navigation |
| 10 | Follow Me | AI Camera 2.0: posture + ultrasonic |
| 11 | Robot Train Mission | Combine everything |
| 12 | Project Day | Student projects |

## Phones
On narrow screens the 3D view comes first, with a small Run button inside it.
**🧩 Hide blocks** gives the robot the whole screen. Turn tips appear as a small bar at the bottom edge.

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

## Blocks
All demos use the real mBlock 5 blocks (CyberPi, mBot2 chassis, quad RGB sensor, ultrasonic 2, AI Camera 2.0)
with mBlock's wording, colors and device icons. Programs start with **when button A pressed**.
Note: in the encoder-motor block, EM2 is mirrored, so driving forward means EM2 gets a negative RPM.

## Export (toolbar → Export)
- **mBlock 5 project (.mblock)** – opens in mBlock 5 with real blocks (IDs verified from files saved by mBlock 5.6.0).
  Works for all sessions (2–11).
- **mBlock Python (.py)** – for the Python tab in mBlock 5 (AI Camera 2.0 calls are left as helper stubs).
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
js/mblock.js           .mblock export (zip writer + verified block IDs)
js/mblock-template.js  Stage/Panda/device template from mBlock 5.6.0
js/audio.js            sounds and notes
js/app.js              UI, compass, sensor panel
tools/demos.py         demo source
tools/build_data.py    demos.py -> data/demos.js
```
