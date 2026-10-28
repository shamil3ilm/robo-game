# Rebuilds src/js/textures.js: downloads CC0 textures from Poly Haven, shrinks them to 512 px and embeds them as data URIs.
# Run: python tools/build_textures.py   (needs: pip install pillow, and internet access). Edit SLUGS to change which textures are used.
import base64, io, json, sys, urllib.request
from PIL import Image

SLUGS = ["asphalt_02", "sand_01", "square_pavers", "red_laterite_soil_stones", "large_red_bricks", "palm_tree_bark", "weathered_planks", "blue_painted_planks"]
SIZE, QUALITY = 512, 80
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "js", "textures.js")


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "robo-run-asset-build"})
    return urllib.request.urlopen(req, timeout=60).read()


def pack(url):
    im = Image.open(io.BytesIO(get(url))).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=QUALITY, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii"), len(buf.getvalue())


tex, total = {}, 0
for slug in SLUGS:
    files = json.loads(get("https://api.polyhaven.com/files/" + slug))
    entry = {}
    for key, short in (("Diffuse", "d"), ("nor_gl", "n")):
        node = files.get(key, {}).get("1k", {}).get("jpg")
        if not node:
            print("missing", slug, key); continue
        uri, n = pack(node["url"]); entry[short] = uri; total += n
    tex[slug] = entry
    print(slug, {k: len(v) for k, v in entry.items()})

head = ("/* Robo Run: photo textures, CC0 from Poly Haven (polyhaven.com), shrunk to 512 px and embedded so the game also runs from file://.\n"
        "   window.ROBO_TEX[name] = { d: diffuse, n: normal map (OpenGL) } as data URIs. Rebuild with the script noted in DESIGN - Malabar World.md. */\n")
open(OUT, "w", encoding="utf8", newline="\n").write(head + "window.ROBO_TEX = " + json.dumps(tex, separators=(",", ":")) + ";\n")
print("jpeg bytes", total)
