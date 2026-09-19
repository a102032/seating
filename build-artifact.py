#!/usr/bin/env python3
"""Bundle the built app into one self-contained HTML file for the Claude artifact preview.

An artifact has no server, so every asset under public/ is inlined as a data URI and
handed to the app through window.__DEMO_ASSET_OVERRIDES__, which lib/assets.ts consults
before falling back to a real URL. Keying that map by the same path the app asks for
means nothing here depends on how the minifier happens to quote its strings.
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


def svg_data_uri(path: pathlib.Path) -> str:
    return "data:image/svg+xml;base64," + base64.b64encode(path.read_bytes()).decode()


def main() -> None:
    js_path = next(DIST.glob("assets/*.js"))
    css_path = next(DIST.glob("assets/*.css"))
    js = js_path.read_text()
    css = css_path.read_text()

    # SVG inlines as text rather than a re-encoded bitmap, so the stickers stay vector
    # in the demo build too.
    stickers = sorted((PUBLIC / "avatars" / "stickers").glob("*/*.svg"))
    overrides = {
        f"/avatars/stickers/{p.parent.name}/{p.name}": svg_data_uri(p) for p in stickers
    }
    overrides.update(
        {
            "/branding/school-crest.png": png_data_uri(PUBLIC / "branding" / "school-crest.png", 240),
            "/sounds/pop.mp3": raw_data_uri(PUBLIC / "sounds" / "pop.mp3", "audio/mpeg"),
        }
    )
    print(f"inlined {len(overrides)} assets ({len(stickers)} stickers)")

    # Guard against the closing tag inside a string literal ending the inline script early.
    safe_js = js.replace("</script", "<\\/script")
    overrides_json = json.dumps(overrides).replace("</script", "<\\/script")

    html = f"""<title>Interactive Seating Chart</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Andika:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
<style>
{css}
html, body {{ margin: 0; height: 100%; }}
#root {{ height: 100dvh; }}
</style>
<div id="root"></div>
<script>window.__DEMO_ASSET_OVERRIDES__ = {overrides_json};</script>
<script type="module">
{safe_js}
</script>
"""
    OUT.write_text(html)
    print(f"wrote {OUT} ({OUT.stat().st_size / 1_000_000:.1f} MB)")


if __name__ == "__main__":
    main()
