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
        "blob_count": "{cam_color|Number of [#e11d2e|Red] color blocks}",
        "blob_x": "{cam_color|The [X Coordinate] of the blob with [Middle position]}",
        "blob_w": "{cam_color|The [Width] of the blob with [Middle position]}",
        "tag_id": "{cam_tag|The identify result of the tag with [Middle position]}",
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
    return blk("pen", "pen", "🖍 marker " + ("down" if down else "up") + " \\(simulator only\\)", down=down)


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
                f"quad rgb sensor [1] probe [(2) R1] detects [{FLOOR_HEX[color]}|{color}] ?", color=color)


def cmp(a, op, b):
    return cond("cmp", "operators", f"{slot(a)} {op} {slot(b)}", a=a, cmp=op, b=b)

# ================================================================ sessions

S2 = {
    "session": 2, "id": "hello", "title": "Hello, mBot2!", "emoji": "👋",
    "world": "arena", "camera": False, "level": 1,
    "summary": "Your robot's first program: talk, light up, move and dance, one block at a time.",
    "concepts": ["Sequence", "Motors", "LEDs & sound"],
    "challenge": "Make mBot2 introduce itself with YOUR name and invent a new dance move.",
    "scripts": [[
        hat(),
        show("Hello! I am mBot2"),
        led("blue"),
        sound("hi"),
        wait(1),
        moves_for(50, 1),
        turn(90),
        led("green"),
        moves_for(50, 1),
        show("Let's dance!"),
        sound("yeah"),
        turn(-360, 60),
        moves_for(40, 0.5, "backward"),
        turn(360, 60),
        rainbow(),
        show("Nice to meet you!"),
        sound("magic"),
    ]],
}

S3 = {
    "session": 3, "id": "shapes", "title": "Shape Artist", "emoji": "🎨",
    "world": "arena", "camera": False, "level": 1,
    "summary": "Tape a marker to mBot2 and let loops do the drawing: a square, then a star.",
    "concepts": ["Repeat loops", "Angles", "Patterns"],
    "challenge": "What shape do you get with repeat (6) and turn (60)°? Try repeat (36) and turn (10)°!",
    "scripts": [[
        hat(),
        show("I can draw!"),
        led("red"),
        pen(True),
        repeat(4, moves_for(60, 1.5), turn(-90)),
        pen(False),
        turn(-90),
        moves_for(60, 1.5),
        turn(-90),
        led("blue"),
        pen(True),
        repeat(5, moves_for(60, 1.5), turn(-144)),
        pen(False),
        show("Square + Star = Art!"),
        rainbow(),
        sound("magic"),
    ]],
}

S4 = {
    "session": 4, "id": "traffic", "title": "Traffic Light Robot", "emoji": "🚦",
    "world": "traffic", "camera": False, "level": 2,
    "summary": "The quad RGB sensor reads the colors on the road. Green means go, yellow slow down, red stop!",
    "concepts": ["If / else", "Color sensor", "Decisions"],
    "challenge": "Add a new rule: when the robot sees purple, it spins around once.",
    "scripts": [[
        hat(),
        show("Traffic Light Robot"),
        led("white"),
        moves(40),
        forever(
            elif_chain(
                (floor_is("red"), [
                    stop(), led("red"), show("RED: stop!"), sound("beeps"), wait(2),
                    led("green"), moves_for(50, 1.5), moves(40)]),
                (floor_is("yellow"), [led("yellow"), show("YELLOW: slow down"), moves(20)]),
                (floor_is("green"), [led("green"), show("GREEN: go!"), moves(60)]),
                (floor_is("blue"), [stop(), show("Finish line!"), sound("magic"), rainbow(), stop_all()]),
            ),
        ),
    ]],
}

S5 = {
    "session": 5, "id": "line", "title": "Line Follower", "emoji": "🛤️",
    "world": "line", "camera": False, "level": 2,
    "summary": "Two light sensors watch the black line. The robot steers to keep the line between them.",
    "concepts": ["Forever loop", "Nested if", "Steering"],
    "challenge": "Make it faster! How high can the RPM go before the robot loses the line?",
    "scripts": [[
        hat(),
        led("green"),
        sound("start"),
        show("Following the line"),
        wait(1),
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
    "session": 6, "id": "parking", "title": "Parking Assistant", "emoji": "🅿️",
    "world": "parking", "camera": False, "level": 3,
    "summary": "Like a real car: the closer the wall, the faster the beeps. Then park perfectly.",
    "concepts": ["Variables", "Math with sensors", "Thresholds"],
    "challenge": "Change the parking distance to 15 cm. Can you make the LEDs turn orange when very close?",
    "scripts": [[
        hat(),
        show("Parking Assistant"),
        led("white"),
        forever(
            set_var("dist", DIST),
            show(join("Distance: ", var("dist"))),
            elif_chain(
                (cmp(var("dist"), "<", 8), [
                    stop(), led("green"), show("Parked!"), sound("magic"), stop_all()]),
                (cmp(var("dist"), "<", 35), [
                    moves(15), led("yellow"), sound("beeps"), wait(div(var("dist"), 50))]),
                otherwise=[moves(50), led("white")],
            ),
        ),
    ]],
}

S7 = {
    "session": 7, "id": "obstacle", "title": "Obstacle Avoider", "emoji": "🧱",
    "world": "obstacle", "camera": False, "level": 3,
    "summary": "The ultrasonic 'eyes' measure distance. Too close? Back up and pick a random new direction.",
    "concepts": ["Comparison", "Random numbers", "Autonomy"],
    "challenge": "Instead of always 90°, turn a random angle between 60 and 150 degrees.",
    "scripts": [[
        hat(),
        show("Obstacle Avoider"),
        led("green"),
        sound("start"),
        forever(
            show(DIST),
            if_(cmp(DIST, "<", 20),
                [
                    stop(), led("red"), sound("warning"),
                    moves_for(30, 0.6, "backward"),
                    if_(cmp(rand(1, 2), "=", 1), [turn(-90)], [turn(90)]),
                    led("green"),
                ],
                [moves(50)]),
        ),
    ]],
}

E5, G5, C5, D5, F5 = 76, 79, 72, 74, 77
JINGLE = [note(E5, 0.5), note(E5, 0.5), note(E5, 1), note(E5, 0.5), note(E5, 0.5), note(E5, 1)]
ALL_THE_WAY = [note(E5, 0.5), note(G5, 0.5), note(C5, 0.75), note(D5, 0.25), note(E5, 2)]

S8 = {
    "session": 8, "id": "music", "title": "Music & Light Show", "emoji": "🎵",
    "world": "stage", "camera": False, "level": 3,
    "summary": "Two scripts run at the same time: one sings Jingle Bells, the other dances. My Blocks keep it tidy.",
    "concepts": ["My Blocks (functions)", "Parallel scripts", "Notes & beats"],
    "challenge": "Write your own song with a My Block for the chorus, and design a matching dance.",
    "scripts": [
        [hat(),
         show("Jingle Bells"),
         call("jingle bells"),
         call("all the way"),
         repeat(4, note(F5, 0.5)),
         repeat(3, note(E5, 0.5)),
         note(E5, 0.25), note(E5, 0.25),
         note(E5, 0.5), note(D5, 0.5), note(D5, 0.5), note(E5, 0.5),
         note(D5, 1), note(G5, 1),
         call("jingle bells"),
         call("all the way"),
         show("Happy holidays!")],
        [hat(),
         wait(0.5),
         repeat(10,
                led_random(),
                turn(-45, 50),
                turn(45, 50),
                moves_for(40, 0.4),
                moves_for(40, 0.4, "backward")),
         rainbow(),
         turn(360, 50)],
        [define("jingle bells")] + JINGLE,
        [define("all the way")] + ALL_THE_WAY,
    ],
}

S9 = {
    "session": 9, "id": "ball", "title": "Ball Chaser", "emoji": "⚽",
    "world": "ball", "camera": True, "level": 4,
    "summary": "AI Camera 2.0 finds the red ball and reports WHERE it is. The robot steers toward it.",
    "concepts": ["AI vision", "Color blobs", "x-coordinate tracking"],
    "challenge": "Make the robot back away when the ball gets too close, like a shy puppy.",
    "scripts": [[
        hat(),
        cam_mode("Color Recognition"),
        show("Ball Chaser!"),
        sound("start"),
        forever(
            if_(cmp(BLOBS, ">", 0),
                [elif_chain(
                    (cmp(BLOB_X, "<", 110), [led("blue"), wheels(10, 40)]),
                    (cmp(BLOB_X, ">", 210), [led("blue"), wheels(40, 10)]),
                    (cmp(BLOB_W, ">", 90), [
                        stop(), led("green"), show("Got you!"), sound("beeps"), wait(0.5)]),
                    otherwise=[led("white"), show("Chasing..."), moves(45)],
                )],
                [led("purple"), show("Where is the ball?"), wheels(-20, 20)]),
        ),
    ]],
}

S10 = {
    "session": 10, "id": "signs", "title": "AI Tag Explorer", "emoji": "👁️",
    "world": "camera", "camera": True, "level": 4,
    "summary": "AI Camera 2.0 reads AprilTag signs: tag 1 = turn left, tag 2 = turn right, tag 3 = goal!",
    "concepts": ["AI vision", "AprilTags", "Multi-branch logic"],
    "challenge": "Add tag 4: when the camera sees it, mBot2 does a victory dance.",
    "scripts": [[
        hat(),
        cam_mode("AprilTag"),
        tag_size(10),
        show("AI Explorer ready!"),
        led("white"),
        sound("start"),
        wait(1),
        forever(
            set_var("tag", TAG),
            elif_chain(
                (cmp(var("tag"), "=", 1), [
                    stop(), show("Tag 1 = LEFT"), led("blue"), sound("beeps"), turn(-90)]),
                (cmp(var("tag"), "=", 2), [
                    stop(), show("Tag 2 = RIGHT"), led("yellow"), sound("beeps"), turn(90)]),
                (cmp(var("tag"), "=", 3), [
                    stop(), show("Tag 3 = GOAL!"), sound("magic"), rainbow(),
                    repeat(3, turn(-40), turn(40)),
                    stop_all()]),
                otherwise=[moves(40)],
            ),
        ),
    ]],
}

S11 = {
    "session": 11, "id": "train", "title": "Robot Train Mission", "emoji": "🚂",
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
    "img_base": IMG,
}

CURRICULUM = [
    {"n": 1, "title": "Build Day", "desc": "Assemble mBot2, meet CyberPi, connect to mBlock 5", "demo": "build"},
    {"n": 2, "title": "Hello, mBot2!", "desc": "Sequences: move, light, sound", "demo": "hello"},
    {"n": 3, "title": "Shape Artist", "desc": "Repeat loops and angles", "demo": "shapes"},
    {"n": 4, "title": "Traffic Light Robot", "desc": "If / else with the color sensor", "demo": "traffic"},
    {"n": 5, "title": "Line Follower", "desc": "Forever loops and steering", "demo": "line"},
    {"n": 6, "title": "Parking Assistant", "desc": "Variables and sensor math", "demo": "parking"},
    {"n": 7, "title": "Obstacle Avoider", "desc": "Comparisons and random numbers", "demo": "obstacle"},
    {"n": 8, "title": "Music & Light Show", "desc": "My Blocks and parallel scripts", "demo": "music"},
    {"n": 9, "title": "Ball Chaser", "desc": "AI vision: color blob tracking", "demo": "ball"},
    {"n": 10, "title": "AI Tag Explorer", "desc": "AI vision: reading AprilTags", "demo": "signs"},
    {"n": 11, "title": "Robot Train Mission", "desc": "Combine everything into one mission", "demo": "train"},
    {"n": 12, "title": "Project Day", "desc": "Design, build and present your own robot program", "demo": None},
]
