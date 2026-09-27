"""Robotics with mBot2: AI Vision & Programming - session demos.

Every block uses the real mBlock 5 (v5.6.0) wording for CyberPi, mBot2,
mBuild sensors and AI Camera 2.0.

Label syntax (drawn as mBlock-style shapes in the browser):
  (value)        white input       (#d0021b)   color swatch input
  [value]        dropdown          [#hex|v]    dropdown with a color dot
  {cat|content}  round reporter    \\( \\)       literal parentheses
"""

COURSE_TITLE = "Robotics with mBot2: AI Vision & Programming"

# ------------------------------------------------------------ reporters

def lit(x):
    return not isinstance(x, dict)


def label(e):
    if lit(e):
        return str(e)
    k = e["k"]
    fixed = {
        "distance": "{mbuild|ultrasonic 2 [1] distance to an object \\(cm\\)}",
        "blob_count": "{cam_color|Number of [color 1] color blocks}",
        "blob_x": "{cam_color|The [X Coordinate] of the blob with [Middle position]}",
        "blob_w": "{cam_color|The [Width] of the blob with [Middle position]}",
        "tag_id": "{cam_tag|The identify result of the tag with [Middle position]}",
        "pose_x": "{cam_pose|The [X Coordinate] of the posture with [Middle position]}",
    }
    if k in fixed:
        return fixed[k]
    if k == "var":
        return "{variables|" + e["n"] + "}"
    if k == "join":
        return "{operators|join " + slot(e["a"]) + " " + slot(e["b"]) + "}"
    if k == "rand":
        return "{operators|pick random " + slot(e["a"]) + " to " + slot(e["b"]) + "}"
    ops = {"add": "+", "sub": "-", "mul": "*", "div": "/"}
    if k in ops:
        return "{operators|" + slot(e["a"]) + " " + ops[k] + " " + slot(e["b"]) + "}"
    raise ValueError(k)


def slot(e):
    return f"({e})" if lit(e) else label(e)


DIST = {"k": "distance"}
BLOBS = {"k": "blob_count"}
BLOB_X = {"k": "blob_x"}
BLOB_W = {"k": "blob_w"}
TAG = {"k": "tag_id"}
POSE_X = {"k": "pose_x"}


def var(n):
    return {"k": "var", "n": n}


def join(a, b):
    return {"k": "join", "a": a, "b": b}


def div(a, b):
    return {"k": "div", "a": a, "b": b}


def rand(a, b):
    return {"k": "rand", "a": a, "b": b}

# ------------------------------------------------------------ blocks

def blk(op, cat, label_text, **args):
    return {"op": op, "cat": cat, "text": label_text, "args": args}


def cond(op, cat, label_text, **args):
    return {"op": op, "cat": cat, "text": label_text, "args": args}


def hat():
    return blk("when_start", "events", "when button [A] pressed", button="a")


def define(name):
    return blk("define", "myblocks", f"define [{name}]", name=name)


def call(name):
    return blk("call", "myblocks", name, name=name)


def forever(*body):
    return {"op": "forever", "cat": "control", "text": "forever", "args": {}, "body": list(body)}


def repeat(n, *body):
    return {"op": "repeat", "cat": "control", "text": f"repeat ({n})", "args": {"n": n}, "body": list(body)}


def repeat_until(c, *body):
    return {"op": "repeat_until", "cat": "control", "text": "repeat until %c", "args": {}, "cond": c, "body": list(body)}


def if_(c, body, else_=None):
    d = {"op": "if", "cat": "control", "text": "if %c then", "args": {}, "cond": c, "body": body}
    if else_ is not None:
        d["else"] = else_
    return d


def elif_chain(*pairs, otherwise=None):
    (c, body), rest = pairs[0], pairs[1:]
    if rest:
        return if_(c, body, [elif_chain(*rest, otherwise=otherwise)])
    return if_(c, body, otherwise)


LED_HEX = {
    "red": "#d0021b", "orange": "#f5a623", "yellow": "#f8e71c", "green": "#7ed321",
    "cyan": "#50e3c2", "blue": "#0113d0", "purple": "#9013fe", "white": "#ffffff",
}


def led(color):
    return blk("led", "cp_led", f"LED [all] displays ({LED_HEX[color]})", color=color, hex=LED_HEX[color])


def led_random():
    return blk("led_rgb", "cp_led",
               "LED [all] displays R " + label(rand(0, 255)) + " G " + label(rand(0, 255)) + " B " + label(rand(0, 255)),
               r=rand(0, 255), g=rand(0, 255), b=rand(0, 255))


def rainbow():
    return blk("led_anim", "cp_led", "play LED animation [rainbow] until done", name="rainbow")


def sound(name):
    return blk("sound", "cp_audio", f"play [{name}]", name=name)


def note(midi, beats):
    return blk("note", "cp_audio", f"play note ({midi}) for ({beats}) beat", note=midi, beats=beats)


def show(text):
    return blk("display", "cp_display",
               f"show label [1] {slot(text)} at [center of screen] by [middle] pixel", text=text)


def moves(rpm, direction="forward"):
    return blk("move", "chassis", f"moves [{direction}] at ({rpm}) RPM",
               l=rpm if direction == "forward" else -rpm, r=rpm if direction == "forward" else -rpm,
               direction=direction, rpm=rpm)


def moves_for(rpm, sec, direction="forward"):
    s = 1 if direction == "forward" else -1
    return blk("move_for", "chassis", f"moves [{direction}] at ({rpm}) RPM for ({sec}) secs",
               l=s * rpm, r=s * rpm, sec=sec, direction=direction, rpm=rpm)


def turn(deg, rpm=40):
    side = "right" if deg > 0 else "left"
    return blk("turn", "chassis", f"turns [{side}] ({abs(deg)}) ° until done", deg=deg, rpm=rpm)


def wheels(left, right):
    """Left/right wheel speeds. EM2 is mounted mirrored, so its RPM is negative to drive forward."""
    return blk("move", "chassis",
               f"encoder motor EM1 ↺ rotates at ({left}) RPM, encoder motor EM2 ↺ rotates at ({-right}) RPM",
               l=left, r=right, em1=left, em2=-right)


def stop():
    return blk("stop_move", "chassis", "stop encoder motor [all]")


def wait(sec):
    return blk("wait", "control", f"wait {slot(sec)} seconds", sec=sec)


def stop_all():
    return blk("stop_all", "control", "stop [all]")


def set_var(name, value):
    return blk("set_var", "variables", f"set [{name}] to {slot(value)}", name=name, value=value)


def change_var(name, value):
    return blk("change_var", "variables", f"change [{name}] by {slot(value)}", name=name, value=value)


def pen(down):
    return blk("pen", "pen", "marker " + ("down" if down else "up") + " \\(simulator only\\)", down=down)


def cam_mode(mode):
    return blk("cam_mode", "cam_tag", f"Switch to [{mode}] mode", mode=mode)


def tag_size(cm):
    return blk("tag_size", "cam_tag", f"Set AprilTag size to ({cm}) cm", cm=cm)

# ------------------------------------------------------------ conditions

LINE_STATUS = {"11": "(3) 11", "10": "(2) 10", "01": "(1) 01", "00": "(0) 00"}


def line_is(pattern):
    return cond("line", "mbuild", f"quad rgb sensor [1] L1, R1's [line] in status [{LINE_STATUS[pattern]}] ?",
                pattern=pattern, status=int(pattern, 2))


FLOOR_HEX = {"red": "#e11d2e", "yellow": "#facc15", "green": "#22c55e", "blue": "#2563eb"}


def floor_is(color):
    return cond("floor_color", "mbuild",
                f"quad rgb sensor [1] probe [(2) R1] detects [{FLOOR_HEX[color]}|{color}] ?", color=color, probe="R1")


def cmp(a, op, b):
    return cond("cmp", "operators", f"{slot(a)} {op} {slot(b)}", a=a, cmp=op, b=b)

# ================================================================ sessions
# Sessions 2-6: basics with few blocks.  Sessions 7-10: AI Camera 2.0.  Session 11: mission.

S2 = {
    "session": 2, "id": "hello", "title": "Hello, mBot2!",
    "world": "arena", "camera": False, "level": 1,
    "summary": "Your first program: blocks run one after another, from top to bottom.",
    "concepts": ["Sequence", "Motors", "LEDs & sound"],
    "challenge": "Change the message to YOUR name and make mBot2 come back to where it started.",
    "scripts": [[
        hat(),
        show("Hello! I am mBot2"),
        led("blue"),
        sound("hi"),
        moves_for(50, 1),
        turn(180),
        moves_for(50, 1),
        rainbow(),
        show("Nice to meet you!"),
    ]],
}

S3 = {
    "session": 3, "id": "shapes", "title": "Shape Artist",
    "world": "arena", "camera": False, "level": 1,
    "summary": "Tape a marker to mBot2. One repeat loop draws a whole square.",
    "concepts": ["Repeat loops", "Angles"],
    "challenge": "Draw a star: repeat (5), turn (144)°. What does repeat (6) with (60)° make?",
    "scripts": [[
        hat(),
        led("red"),
        pen(True),
        repeat(4, moves_for(60, 1.5), turn(-90)),
        pen(False),
        rainbow(),
    ]],
}

S4 = {
    "session": 4, "id": "wall", "title": "Wall Bounce",
    "world": "corridor", "camera": False, "level": 2,
    "summary": "The ultrasonic sensor shows the distance to the wall. Too close? Turn around 180°!",
    "concepts": ["Ultrasonic sensor", "If / else", "Forever loop"],
    "challenge": "Try 10 cm and 40 cm. Which distance is safest? Add a sound before turning.",
    "scripts": [[
        hat(),
        forever(
            show(DIST),
            if_(cmp(DIST, "<", 20),
                [sound("beeps"), turn(180)],
                [moves(50)]),
        ),
    ]],
}

S5 = {
    "session": 5, "id": "line", "title": "Line Follower",
    "world": "line", "camera": False, "level": 2,
    "summary": "Two light sensors watch the black line. The robot steers to keep the line between them.",
    "concepts": ["Line sensor", "Nested if", "Steering"],
    "challenge": "Make it faster! How high can the RPM go before the robot loses the line?",
    "scripts": [[
        hat(),
        forever(
            elif_chain(
                (line_is("11"), [wheels(35, 35)]),
                (line_is("10"), [wheels(10, 35)]),
                (line_is("01"), [wheels(35, 10)]),
            ),
        ),
    ]],
}

S6 = {
    "session": 6, "id": "traffic", "title": "Traffic Light Robot",
    "world": "traffic", "camera": False, "level": 2,
    "summary": "The color sensor reads the road: red means stop, blue means finish line.",
    "concepts": ["Color sensor", "If / else if", "Stop"],
    "challenge": "Add a rule: on green, drive faster (60 RPM).",
    "scripts": [[
        hat(),
        moves(40),
        forever(
            elif_chain(
                (floor_is("red"), [stop(), led("red"), wait(2), led("green"), moves_for(40, 1.5), moves(40)]),
                (floor_is("blue"), [stop(), rainbow(), stop_all()]),
            ),
        ),
    ]],
}

S7 = {
    "session": 7, "id": "guard", "title": "AI Color Guard",
    "world": "guard", "camera": True, "level": 3,
    "summary": "Meet AI Camera 2.0! Teach it the red ball as color 1. The guard robot turns until it spots the ball.",
    "concepts": ["AI Camera 2.0", "Learning a color", "Searching"],
    "challenge": "Teach a second color. Make the LEDs match the color the camera sees.",
    "scripts": [[
        hat(),
        forever(
            if_(cmp(BLOBS, ">", 0),
                [led("green"), show("I see it!"), sound("beeps"), wait(1)],
                [led("red"), show("Searching..."), turn(-20)]),
        ),
    ]],
}

S8 = {
    "session": 8, "id": "ball", "title": "Ball Chaser",
    "world": "ball", "camera": True, "level": 3,
    "summary": "The camera tells WHERE the ball is (x from 0 to 320). Left, right or center? Steer to chase it!",
    "concepts": ["x-coordinate", "Tracking", "Blob width"],
    "challenge": "Make the robot back away when the ball gets too close, like a shy puppy.",
    "scripts": [[
        hat(),
        forever(
            if_(cmp(BLOBS, ">", 0),
                [elif_chain(
                    (cmp(BLOB_X, "<", 110), [wheels(10, 40)]),
                    (cmp(BLOB_X, ">", 210), [wheels(40, 10)]),
                    (cmp(BLOB_W, ">", 90), [stop(), show("Got you!"), sound("beeps")]),
                    otherwise=[moves(45)],
                )],
                [show("Where is the ball?"), wheels(-20, 20)]),
        ),
    ]],
}

S9 = {
    "session": 9, "id": "signs", "title": "AprilTag Explorer",
    "world": "camera", "camera": True, "level": 4,
    "summary": "AI Camera 2.0 reads AprilTag signs: tag 1 = turn left, tag 2 = turn right, tag 3 = goal!",
    "concepts": ["AprilTags", "Variables", "Navigation"],
    "challenge": "Add tag 4: when the camera sees it, mBot2 does a victory dance.",
    "scripts": [[
        hat(),
        cam_mode("AprilTag"),
        tag_size(10),
        forever(
            set_var("tag", TAG),
            elif_chain(
                (cmp(var("tag"), "=", 1), [stop(), show("Tag 1 = LEFT"), turn(-90)]),
                (cmp(var("tag"), "=", 2), [stop(), show("Tag 2 = RIGHT"), turn(90)]),
                (cmp(var("tag"), "=", 3), [stop(), show("GOAL!"), sound("magic"), rainbow(), stop_all()]),
                otherwise=[moves(40)],
            ),
        ),
    ]],
}

S10 = {
    "session": 10, "id": "follow", "title": "Follow Me",
    "world": "person", "camera": True, "level": 4,
    "summary": "Posture recognition finds a person. The robot follows them, and the ultrasonic sensor keeps a safe distance.",
    "concepts": ["Posture recognition", "AI + sensors", "Safe distance"],
    "challenge": "Make the robot say hello (sound + LEDs) when it catches up with you.",
    "scripts": [[
        hat(),
        forever(
            set_var("x", POSE_X),
            if_(cmp(var("x"), ">", 0),
                [elif_chain(
                    (cmp(DIST, "<", 30), [stop(), led("green")]),
                    (cmp(var("x"), "<", 110), [led("blue"), wheels(10, 40)]),
                    (cmp(var("x"), ">", 210), [led("blue"), wheels(40, 10)]),
                    otherwise=[led("white"), moves(45)],
                )],
                [led("red"), wheels(-20, 20)]),
        ),
    ]],
}

S11 = {
    "session": 11, "id": "train", "title": "Robot Train Mission",
    "world": "train", "camera": False, "level": 5,
    "summary": "Everything together: follow the track, stop at 3 stations, and wait for the cat to move!",
    "concepts": ["Combine sensors", "Counting variable", "My Blocks"],
    "challenge": "Add a 4th station and make the train announce each station's name.",
    "scripts": [
        [hat(),
         set_var("stations", 0),
         show("All aboard!"),
         led("green"),
         sound("start"),
         repeat_until(cmp(var("stations"), "=", 3),
                      elif_chain(
                          (cmp(DIST, "<", 15), [
                              stop(), led("red"), show("Cat on the track!"), sound("meow"), wait(0.5)]),
                          (floor_is("green"), [
                              stop(), change_var("stations", 1), led("blue"),
                              show(join("Station ", var("stations"))), sound("ring"), wait(2),
                              led("green"), moves_for(30, 1.2)]),
                          otherwise=[call("follow line")],
                      )),
         stop(),
         show("Last stop! Thank you!"),
         sound("magic"),
         rainbow()],
        [define("follow line"),
         elif_chain(
             (line_is("11"), [wheels(30, 30)]),
             (line_is("10"), [wheels(8, 30)]),
             (line_is("01"), [wheels(30, 8)]),
         )],
    ],
}

DEMOS = [S2, S3, S4, S5, S6, S7, S8, S9, S10, S11]

# ------------------------------------------------------------ Session 1: Build Day
# Pictures are loaded from the official Makeblock guide (credited and linked in the page).
IMG = "https://support.makeblock.com/hc/article_attachments/"
BUILD_GUIDE = {
    "source": "https://support.makeblock.com/hc/en-us/articles/1500006253942-Assemble-mBot-Neo-mBot2",
    "parts": [
        ["CyberPi", "4412035667351"], ["mBot2 Shield", "4412055742487"],
        ["Ultrasonic sensor 2", "4412039018903"], ["Quad RGB sensor", "4412035668631"],
        ["Encoder motor", "4412035667735"], ["Wheel hub", "4412039019159"],
        ["Slick tyre", "4412039018519"], ["Mini wheel", "4412039017623"],
        ["Chassis", "4412039016727"], ["USB cable", "4412035669911"],
        ["Motor cable", "4412039017879"], ["mBuild cable (10 cm)", "4412035667991"],
        ["mBuild cable (20 cm)", "4412035668247"], ["Line-following track map", "4412039017367"],
        ["Screw M4×25 mm", "4412035669399"], ["Screw M4×14 mm", "4412035669143"],
        ["Screw M4×8 mm", "4412035668887"], ["Screw M2.5×12 mm", "4412047239703"],
        ["Screwdriver", "4412035669655"],
    ],
    "steps": ["4412039398935", "4412039476503", "4412039499031", "4412055994647", "4412036303383",
              "4412036305815", "4412056006935", "4412036310423", "4412039624471", "4412039634711",
              "4412056023703"],
    "completed": "4412039642903",
    "camera_guide": "https://support.makeblock.com/hc/en-us/articles/35026070429463-Assemble-AI-Camera-2-0-to-mBot2",
    "img_base": IMG,
}

# Class dates: 10/25/26 - 1/31/27 (Sundays).
NO_CLASS = [
    {"date": "2026-11-29", "name": "Thanksgiving"},
    {"date": "2026-12-27", "name": "Christmas"},
    {"date": "2027-01-17", "name": "MLK Jr. Day"},
]

CURRICULUM = [
    {"n": 1, "short": "Build Day", "date": "2026-10-25", "title": "Build Day", "desc": "Assemble mBot2 and AI Camera 2.0", "demo": "build"},
    {"n": 2, "short": "Hello mBot2", "date": "2026-11-01", "title": "Hello, mBot2!", "desc": "Sequence: move, light, sound", "demo": "hello"},
    {"n": 3, "short": "Shapes", "date": "2026-11-08", "title": "Shape Artist", "desc": "Repeat loops and angles", "demo": "shapes"},
    {"n": 4, "short": "Wall Bounce", "date": "2026-11-15", "title": "Wall Bounce", "desc": "Ultrasonic distance and if / else", "demo": "wall"},
    {"n": 5, "short": "Line Follow", "date": "2026-11-22", "title": "Line Follower", "desc": "Line sensor and steering", "demo": "line"},
    {"n": 6, "short": "Traffic Light", "date": "2026-12-06", "title": "Traffic Light Robot", "desc": "Color sensor decisions", "demo": "traffic"},
    {"n": 7, "short": "Color Guard", "date": "2026-12-13", "title": "AI Color Guard", "desc": "AI Camera 2.0: learn and find a color", "demo": "guard"},
    {"n": 8, "short": "Ball Chaser", "date": "2026-12-20", "title": "Ball Chaser", "desc": "AI Camera 2.0: track with x-coordinates", "demo": "ball"},
    {"n": 9, "short": "AprilTags", "date": "2027-01-03", "title": "AprilTag Explorer", "desc": "AI Camera 2.0: read tags and navigate", "demo": "signs"},
    {"n": 10, "short": "Follow Me", "date": "2027-01-10", "title": "Follow Me", "desc": "AI Camera 2.0: posture recognition + ultrasonic", "demo": "follow"},
    {"n": 11, "short": "Train", "date": "2027-01-24", "title": "Robot Train Mission", "desc": "Combine everything into one mission", "demo": "train"},
    {"n": 12, "short": "Projects", "date": "2027-01-31", "title": "Project Day", "desc": "Design, build and present your own robot program", "demo": "project"},
]


# ------------------------------------------------------------ Session 12: Project Day ideas
SKILLS = [
    {"id": "move", "label": "Move & turn", "s": 2, "color": "#189ff2"},
    {"id": "fx", "label": "LEDs & sound", "s": 2, "color": "#9a24d9"},
    {"id": "loop", "label": "Repeat loops", "s": 3, "color": "#ffab19"},
    {"id": "dist", "label": "Distance sensor", "s": 4, "color": "#16a085"},
    {"id": "line", "label": "Line sensor", "s": 5, "color": "#111827"},
    {"id": "color", "label": "Color sensor", "s": 6, "color": "#e11d2e"},
    {"id": "aicolor", "label": "AI: find a color", "s": 7, "color": "#2f9b5c"},
    {"id": "track", "label": "AI: track a ball", "s": 8, "color": "#0f9d8a"},
    {"id": "tag", "label": "AI: AprilTags", "s": 9, "color": "#16a53a"},
    {"id": "pose", "label": "AI: posture", "s": 10, "color": "#9b22d8"},
]

PROJECT_IDEAS = [
    {"title": "Robot Vacuum", "level": "Easy", "skills": ["move", "dist", "loop"],
     "idea": "Drive around a room. At a wall, back up and turn 90° instead of 180°.",
     "hint": ["forever", "if distance < 15 → turns right 90°", "else → moves forward"]},
    {"title": "Dance Party", "level": "Easy", "skills": ["pose", "fx", "loop"],
     "idea": "When the camera sees a person, the robot dances with rainbow lights.",
     "hint": ["if posture X > 0", "repeat 4: turn left 45°, turn right 45°", "play LED animation rainbow"]},
    {"title": "Robot Pet", "level": "Medium", "skills": ["pose", "dist", "fx"],
     "idea": "Your robot puppy follows you, stops close to you and 'barks' hello.",
     "hint": ["Start from Session 10 Follow Me", "if distance < 30 → play sound + green LEDs"]},
    {"title": "Police Patrol", "level": "Medium", "skills": ["line", "aicolor", "fx"],
     "idea": "Patrol along a line. When the red 'thief' ball appears, stop and flash red/blue lights.",
     "hint": ["Line Follower blocks", "if Number of color blocks > 0 → stop", "repeat: LED red, LED blue"]},
    {"title": "Color Art Bot", "level": "Medium", "skills": ["loop", "color", "move"],
     "idea": "Draw a pattern. The floor color decides which shape to draw next.",
     "hint": ["if detects red → square (repeat 4)", "if detects blue → star (repeat 5, 144°)"]},
    {"title": "Smart Car", "level": "Medium", "skills": ["color", "dist", "move"],
     "idea": "Obey traffic lights AND never crash: stop for red or for a car in front.",
     "hint": ["if detects red OR distance < 20 → stop", "else → moves forward"]},
    {"title": "Pizza Delivery", "level": "Challenge", "skills": ["line", "tag", "fx"],
     "idea": "Follow the road and stop only at the house with the right AprilTag number.",
     "hint": ["set house to 2", "if tag = house → stop, play sound", "else → follow line"]},
    {"title": "Robot Soccer", "level": "Challenge", "skills": ["track", "tag", "move"],
     "idea": "Chase the ball, then push it toward the goal marked with an AprilTag.",
     "hint": ["Ball Chaser blocks", "when the ball is close → find the goal tag", "then drive forward to push"]},
]
