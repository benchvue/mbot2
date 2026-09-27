"""Robotics with mBot2: AI Vision & Programming — session demos (2-11).

Block label syntax (rendered as mBlock-style shapes in the browser):
  (value)         white input slot
  [value]         dropdown
  [#hex|value]    dropdown with a color dot
  {cat|content}   round reporter block (can contain () [] {} again)
"""

COURSE_TITLE = "Robotics with mBot2: AI Vision & Programming"

# ---------------------------------------------------------------- reporters

def lit(x):
    return not isinstance(x, dict)


def label(e):
    """Label text for a reporter expression."""
    if lit(e):
        return str(e)
    k = e["k"]
    if k == "distance":
        return "{sensing|ultrasonic 2 [1] distance cm}"
    if k == "var":
        return "{variables|" + e["n"] + "}"
    if k == "cam_x":
        return "{ai|smart camera [1] color block [1] x}"
    if k == "cam_size":
        return "{ai|smart camera [1] color block [1] width}"
    if k == "join":
        return "{operators|join " + slot(e["a"]) + " " + slot(e["b"]) + "}"
    if k == "rand":
        return "{operators|pick random " + slot(e["a"]) + " to " + slot(e["b"]) + "}"
    ops = {"add": "+", "sub": "-", "mul": "*", "div": "/"}
    if k in ops:
        return "{operators|" + slot(e["a"]) + " " + ops[k] + " " + slot(e["b"]) + "}"
    if k == "round":
        return "{operators|round " + slot(e["a"]) + "}"
    raise ValueError(k)


def slot(e):
    return f"({e})" if lit(e) else label(e)


DIST = {"k": "distance"}
CAM_X = {"k": "cam_x"}
CAM_W = {"k": "cam_size"}


def var(n):
    return {"k": "var", "n": n}


def join(a, b):
    return {"k": "join", "a": a, "b": b}


def div(a, b):
    return {"k": "div", "a": a, "b": b}


def rand(a, b):
    return {"k": "rand", "a": a, "b": b}

# ---------------------------------------------------------------- blocks

def blk(op, cat, label_text, **args):
    return {"op": op, "cat": cat, "text": label_text, "args": args}


def cond(op, cat, label_text, **args):
    return {"op": op, "cat": cat, "text": label_text, "args": args}


def hat():
    return {"op": "when_start", "cat": "events", "text": "🚩 when mBot2 starts up", "args": {}}


def define(name):
    return {"op": "define", "cat": "myblocks", "text": f"define [{name}]", "args": {"name": name}}


def call(name):
    return blk("call", "myblocks", name, name=name)


def forever(*body):
    return {"op": "forever", "cat": "control", "text": "forever", "body": list(body)}


def repeat(n, *body):
    return {"op": "repeat", "cat": "control", "text": f"repeat ({n})", "args": {"n": n}, "body": list(body)}


def repeat_until(c, *body):
    return {"op": "repeat_until", "cat": "control", "text": "repeat until %c", "cond": c, "body": list(body)}


def if_(c, body, else_=None):
    d = {"op": "if", "cat": "control", "text": "if %c then", "cond": c, "body": body}
    if else_ is not None:
        d["else"] = else_
    return d


def elif_chain(*pairs, otherwise=None):
    """if / else if / ... built as nested if-else blocks (like mBlock)."""
    (c, body), rest = pairs[0], pairs[1:]
    if rest:
        return if_(c, body, [elif_chain(*rest, otherwise=otherwise)])
    return if_(c, body, otherwise)


COLORS = {
    "red": "#ef4444", "orange": "#f97316", "yellow": "#facc15", "green": "#22c55e",
    "cyan": "#06b6d4", "blue": "#3b82f6", "purple": "#a855f7", "pink": "#ec4899",
    "white": "#e5e7eb", "black": "#111827", "rainbow": "#a855f7", "random": "#94a3b8",
}


def led(color):
    name = {"random": "🎲 random color", "rainbow": "🌈 rainbow"}.get(color, color)
    return blk("led", "light", f"all LEDs light up [{COLORS[color]}|{name}]", color=color)


def sound(name):
    return blk("sound", "audio", f"play sound [🔊 {name}]", name=name)


def note(n, beats):
    return blk("note", "audio", f"play note [{n}] for ({beats}) beats", note=n, beats=beats)


def show(text):
    return blk("display", "display", f"show label {slot(text)} on screen", text=text)


def forward(rpm):
    return blk("move", "motion", f"move forward at ({rpm}) RPM", l=rpm, r=rpm)


def wheels(l, r):
    return blk("move", "motion", f"EM1 left at ({l}) RPM, EM2 right at ({r}) RPM", l=l, r=r)


def forward_for(rpm, sec):
    return blk("move_for", "motion", f"move forward at ({rpm}) RPM for ({sec}) secs", l=rpm, r=rpm, sec=sec)


def backward_for(rpm, sec):
    return blk("move_for", "motion", f"move backward at ({rpm}) RPM for ({sec}) secs", l=-rpm, r=-rpm, sec=sec)


def turn(deg, rpm=40):
    side = "right" if deg > 0 else "left"
    return blk("turn", "motion", f"turn {side} ({abs(deg)})°", deg=deg, rpm=rpm)


def stop():
    return blk("stop_move", "motion", "stop encoder motors")


def wait(sec):
    return blk("wait", "control", f"wait {slot(sec)} seconds", sec=sec)


def stop_all():
    return blk("stop_all", "control", "stop [all]")


def set_var(name, value):
    return blk("set_var", "variables", f"set [{name}] to {slot(value)}", name=name, value=value)


def change_var(name, value):
    return blk("change_var", "variables", f"change [{name}] by {slot(value)}", name=name, value=value)


def pen(down):
    return blk("pen", "pen", "🖍 marker " + ("down" if down else "up") + " (simulator)", down=down)


def cam_mode():
    return blk("cam_mode", "ai", "smart camera [1] switch to [color block] mode", mode="color")

# ---------------------------------------------------------------- conditions

def line_is(pattern, text):
    return cond("line", "sensing", f"quad RGB sensor [L1 R1] is [{text}] ?", pattern=pattern)


def floor_is(color):
    return cond("floor_color", "sensing", f"quad RGB sensor detects [{COLORS[color]}|{color}] ?", color=color)


def cam_sees(color, number):
    return cond("cam_color", "ai",
                f"smart camera [1] sees color block [{COLORS[color]}|{number} {color}] ?",
                color=color, sign=number)


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
        sound("hello"),
        wait(1),
        forward_for(50, 1),
        turn(90),
        led("green"),
        forward_for(50, 1),
        show("Let's dance!"),
        sound("yeah"),
        led("rainbow"),
        turn(-360, 60),
        backward_for(40, 0.5),
        turn(360, 60),
        show("Nice to meet you!"),
        sound("success"),
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
        repeat(4,
               forward_for(60, 1.5),
               turn(90)),
        pen(False),
        turn(90),
        forward_for(60, 1.6),
        turn(-90),
        led("blue"),
        pen(True),
        repeat(5,
               forward_for(60, 1.2),
               turn(144)),
        pen(False),
        show("Square + Star = Art!"),
        led("rainbow"),
        sound("success"),
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
        forward(40),
        forever(
            elif_chain(
                (floor_is("red"), [
                    stop(), led("red"), show("RED: stop!"), sound("beep"), wait(2),
                    led("green"), forward_for(50, 1.5), forward(40)]),
                (floor_is("yellow"), [led("yellow"), show("YELLOW: slow down"), forward(20)]),
                (floor_is("green"), [led("green"), show("GREEN: go!"), forward(60)]),
                (floor_is("blue"), [
                    stop(), led("rainbow"), show("Finish line!"), sound("success"), stop_all()]),
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
                (line_is("11", "■ ■ both on line"), [wheels(35, 35)]),
                (line_is("10", "■ □ only left"), [wheels(10, 35)]),
                (line_is("01", "□ ■ only right"), [wheels(35, 10)]),
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
                    stop(), led("green"), show("Parked! 🎉"), sound("success"), stop_all()]),
                (cmp(var("dist"), "<", 35), [
                    forward(15), led("yellow"), sound("beep"), wait(div(var("dist"), 50))]),
                otherwise=[forward(50), led("white")],
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
                    stop(), led("red"), sound("alert"),
                    backward_for(30, 0.6),
                    if_(cmp(rand(1, 2), "=", 1), [turn(-90)], [turn(90)]),
                    led("green"),
                ],
                [forward(50)]),
        ),
    ]],
}

JINGLE = [note("E5", 1), note("E5", 1), note("E5", 2), note("E5", 1), note("E5", 1), note("E5", 2)]
ALL_THE_WAY = [note("E5", 1), note("G5", 1), note("C5", 1.5), note("D5", 0.5), note("E5", 4)]

S8 = {
    "session": 8, "id": "music", "title": "Music & Light Show", "emoji": "🎵",
    "world": "stage", "camera": False, "level": 3,
    "summary": "Two scripts run at the same time: one sings Jingle Bells, the other dances. My Blocks keep it tidy.",
    "concepts": ["My Blocks (functions)", "Parallel scripts", "Notes & beats"],
    "challenge": "Write your own song with a My Block for the chorus, and design a matching dance.",
    "scripts": [
        [hat(),
         show("🎵 Jingle Bells"),
         call("jingle bells"),
         call("all the way"),
         repeat(4, note("F5", 1)),
         repeat(3, note("E5", 1)),
         note("E5", 0.5), note("E5", 0.5),
         note("E5", 1), note("D5", 1), note("D5", 1), note("E5", 1),
         note("D5", 2), note("G5", 2),
         call("jingle bells"),
         call("all the way"),
         show("Happy holidays!")],
        [hat(),
         wait(0.5),
         repeat(10,
                led("random"),
                turn(-45, 50),
                turn(45, 50),
                forward_for(40, 0.4),
                backward_for(40, 0.4)),
         led("rainbow"),
         turn(360, 50),
         stop()],
        [define("jingle bells")] + JINGLE,
        [define("all the way")] + ALL_THE_WAY,
    ],
}

S9 = {
    "session": 9, "id": "ball", "title": "Ball Chaser", "emoji": "⚽",
    "world": "ball", "camera": True, "level": 4,
    "summary": "The smart camera finds the red ball and reports WHERE it is. The robot steers toward it.",
    "concepts": ["AI vision", "x-coordinate", "Tracking"],
    "challenge": "Make the robot back away when the ball gets too close, like a shy puppy.",
    "scripts": [[
        hat(),
        cam_mode(),
        show("Ball Chaser!"),
        sound("start"),
        forever(
            if_(cam_sees("red", 1),
                [elif_chain(
                    (cmp(CAM_X, "<", 110), [led("blue"), wheels(10, 40)]),
                    (cmp(CAM_X, ">", 210), [led("blue"), wheels(40, 10)]),
                    (cmp(CAM_W, ">", 90), [
                        stop(), led("green"), show("Got you! ⚽"), sound("beep"), wait(0.5)]),
                    otherwise=[led("white"), show("Chasing..."), forward(45)],
                )],
                [led("purple"), show("Where is the ball?"), wheels(-20, 20)]),
        ),
    ]],
}

S10 = {
    "session": 10, "id": "signs", "title": "AI Sign Explorer", "emoji": "👁️",
    "world": "camera", "camera": True, "level": 4,
    "summary": "The smart camera learns three colored signs and follows their directions to the goal.",
    "concepts": ["Machine learning", "Multi-branch logic", "Navigation"],
    "challenge": "Teach the camera a fourth sign that makes mBot2 do a victory dance.",
    "scripts": [[
        hat(),
        cam_mode(),
        show("AI Explorer ready!"),
        led("white"),
        sound("start"),
        wait(1),
        forever(
            elif_chain(
                (cam_sees("blue", 1), [
                    stop(), show("Blue = LEFT"), led("blue"), sound("beep"), turn(-90)]),
                (cam_sees("yellow", 2), [
                    stop(), show("Yellow = RIGHT"), led("yellow"), sound("beep"), turn(90)]),
                (cam_sees("red", 3), [
                    stop(), show("GOAL! Mission complete"), led("rainbow"), sound("success"),
                    repeat(3, turn(-40), turn(40)),
                    stop_all()]),
                otherwise=[forward(40)],
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
         show("All aboard! 🚂"),
         led("green"),
         sound("start"),
         repeat_until(cmp(var("stations"), "=", 3),
                      elif_chain(
                          (cmp(DIST, "<", 15), [
                              stop(), led("red"), show("Cat on the track!"), sound("meow"), wait(0.5)]),
                          (floor_is("green"), [
                              stop(), change_var("stations", 1), led("blue"),
                              show(join("Station ", var("stations"))), sound("ding"), wait(2),
                              led("green"), forward_for(30, 1.2)]),
                          otherwise=[call("follow line")],
                      )),
         stop(),
         led("rainbow"),
         show("Last stop! Thank you!"),
         sound("success")],
        [define("follow line"),
         elif_chain(
             (line_is("11", "■ ■ both on line"), [wheels(30, 30)]),
             (line_is("10", "■ □ only left"), [wheels(8, 30)]),
             (line_is("01", "□ ■ only right"), [wheels(30, 8)]),
         )],
    ],
}

DEMOS = [S2, S3, S4, S5, S6, S7, S8, S9, S10, S11]

CURRICULUM = [
    {"n": 1, "title": "Build Day", "desc": "Assemble mBot2, meet CyberPi, connect to mBlock 5", "demo": None},
    {"n": 2, "title": "Hello, mBot2!", "desc": "Sequences: move, light, sound", "demo": "hello"},
    {"n": 3, "title": "Shape Artist", "desc": "Repeat loops and angles", "demo": "shapes"},
    {"n": 4, "title": "Traffic Light Robot", "desc": "If / else with the color sensor", "demo": "traffic"},
    {"n": 5, "title": "Line Follower", "desc": "Forever loops and steering", "demo": "line"},
    {"n": 6, "title": "Parking Assistant", "desc": "Variables and sensor math", "demo": "parking"},
    {"n": 7, "title": "Obstacle Avoider", "desc": "Comparisons and random numbers", "demo": "obstacle"},
    {"n": 8, "title": "Music & Light Show", "desc": "My Blocks and parallel scripts", "demo": "music"},
    {"n": 9, "title": "Ball Chaser", "desc": "AI vision: tracking with x-coordinates", "demo": "ball"},
    {"n": 10, "title": "AI Sign Explorer", "desc": "AI vision: learning and recognizing signs", "demo": "signs"},
    {"n": 11, "title": "Robot Train Mission", "desc": "Combine everything into one mission", "demo": "train"},
    {"n": 12, "title": "Project Day", "desc": "Design, build and present your own robot program", "demo": None},
]
