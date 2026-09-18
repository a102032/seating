#!/usr/bin/env python3
"""Bundle the built app into one self-contained HTML file for the Claude artifact preview.

The real app serves avatars from /avatars/library/. An artifact has no server, so every
asset is inlined as a data URI: the 71 library avatars go into a lookup that
lib/avatarLibrary.ts reads via window.__DEMO_AVATAR_OVERRIDES__, and the handful of
directly-referenced assets are string-swapped inside the bundle.
"""
import base64
import io
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).parent
DIST = ROOT / "dist"
PUBLIC = ROOT / "public"
OUT = ROOT / "seating-artifact.html"

# Wide enough to stay crisp on a retina smartboard at card size, small enough that
# 71 of them fit comfortably under the artifact size cap.
AVATAR_WIDTH = 256
AVATAR_QUALITY = 72


def jpeg_data_uri(path: pathlib.Path, width: int, quality: int) -> str:
    from PIL import Image

    im = Image.open(path).convert("RGB")
    h = round(im.height * width / im.width)
    im = im.resize((width, h), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=quality, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def png_data_uri(path: pathlib.Path, width: int) -> str:
    from PIL import Image

    im = Image.open(path).convert("RGBA")
    h = round(im.height * width / im.width)
    im = im.resize((width, h), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def raw_data_uri(path: pathlib.Path, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def main() -> None:
    js_path = next(DIST.glob("assets/*.js"))
    css_path = next(DIST.glob("assets/*.css"))
    js = js_path.read_text()
    css = css_path.read_text()

    library = sorted((PUBLIC / "avatars" / "library").glob("*.jpeg"))
    overrides = {p.name: jpeg_data_uri(p, AVATAR_WIDTH, AVATAR_QUALITY) for p in library}
    print(f"inlined {len(overrides)} library avatars")

    # Assets the bundle references by literal path rather than through the override map.
    direct = {
        "/avatars/boy.png": png_data_uri(PUBLIC / "avatars" / "boy.png", AVATAR_WIDTH),
        "/avatars/girl.png": png_data_uri(PUBLIC / "avatars" / "girl.png", AVATAR_WIDTH),
        "/branding/school-crest.png": png_data_uri(PUBLIC / "branding" / "school-crest.png", 240),
        "/sounds/pop.mp3": raw_data_uri(PUBLIC / "sounds" / "pop.mp3", "audio/mpeg"),
    }
    # The minifier picks its own quote style (this build uses backticks), so swap every form
    # and verify the swap actually landed - checking only that the path exists would pass
    # even when the replacement was a no-op.
    for path, uri in direct.items():
        replacement = json.dumps(uri)
        before = js
        for quote in ('"', "'", "`"):
            js = js.replace(f"{quote}{path}{quote}", replacement)
        if js == before:
            raise SystemExit(f"no quoted occurrence of {path} was replaced in the bundle")
        if path in js:
            raise SystemExit(f"{path} still present in the bundle after replacement")

    # Guard against the closing tag inside a string literal ending the inline script early.
    safe_js = js.replace("</script", "<\\/script")
    overrides_json = json.dumps(overrides).replace("</script", "<\\/script")

    html = f"""<title>Interactive Seating Chart</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700;14..32,800&display=swap" rel="stylesheet">
<style>
{css}
html, body {{ margin: 0; height: 100%; }}
#root {{ height: 100dvh; }}
</style>
<div id="root"></div>
<script>window.__DEMO_AVATAR_OVERRIDES__ = {overrides_json};</script>
<script type="module">
{safe_js}
</script>
"""
    OUT.write_text(html)
    print(f"wrote {OUT} ({OUT.stat().st_size / 1_000_000:.1f} MB)")


if __name__ == "__main__":
    main()
