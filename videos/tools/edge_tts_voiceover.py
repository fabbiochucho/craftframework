"""edge-tts narration for a product-launch HyperFrames project -> audio_meta.json (frame-keyed).
usage: python vo.py <project_dir> <voice>"""
import asyncio, json, re, subprocess, sys
from pathlib import Path
import edge_tts

proj, voice = Path(sys.argv[1]), sys.argv[2]
RATE = sys.argv[3] if len(sys.argv) > 3 else "+0%"
PITCH = sys.argv[4] if len(sys.argv) > 4 else "+0Hz"
LEAD, TAIL, LAST_TAIL = 0.25, 0.55, 2.0

def parse_script(md):
    out, cur = [], None
    for line in md.splitlines():
        h = re.match(r"^#{2,3}\s+.*?\(frame\s+(\d+)\)", line, re.I)
        if h:
            cur = {"frame": int(h[1]), "text": ""}; out.append(cur); continue
        m = re.match(r"^(?: {4,}|\t)(.+)$", line)
        if cur and m: cur["text"] = (cur["text"] + " " + m[1].strip()).strip()
    return [l for l in out if l["text"]]

async def synth(text, raw):
    for attempt in range(6):
        try:
            words = []
            c = edge_tts.Communicate(text, voice, boundary="WordBoundary", rate=RATE, pitch=PITCH)
            with open(raw, "wb") as f:
                async for ch in c.stream():
                    if ch["type"] == "audio": f.write(ch["data"])
                    elif ch["type"] == "WordBoundary":
                        s = ch["offset"] / 1e7
                        words.append({"text": ch["text"], "start": round(s + LEAD, 3), "end": round(s + ch["duration"] / 1e7 + LEAD, 3)})
            return words
        except Exception as e:  # endpoint throws intermittent 403s
            print(f"  retry {attempt + 1}: {e}", file=sys.stderr); await asyncio.sleep(2 + attempt * 2)
    raise SystemExit(f"TTS failed: {text[:40]}")

def dur(p):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)]).decode())

async def main():
    lines = parse_script((proj / "SCRIPT.md").read_text(encoding="utf-8"))
    vdir = proj / "assets" / "voice"; vdir.mkdir(parents=True, exist_ok=True)
    voices = []
    for i, l in enumerate(lines):
        n = f"{l['frame']:02d}"
        raw, out = vdir / f"raw-{n}.mp3", vdir / f"vo-{n}.wav"
        words = await synth(l["text"], raw)
        tail = LAST_TAIL if i == len(lines) - 1 else TAIL
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(raw), "-af",
                        f"adelay={int(LEAD*1000)}:all=1,apad=pad_dur={tail}", "-ar", "48000", str(out)], check=True)
        raw.unlink()
        d = round(dur(out), 2)
        voices.append({"frame": l["frame"], "path": f"assets/voice/{out.name}", "duration_s": d,
                       "words": [{"id": f"w{n}_{j}", **w} for j, w in enumerate(words)]})
        print(f"frame {n}: {d}s, {len(words)} words")
    meta = {"bgm": None,
            "bgm_pending": False, "voices": voices, "sfx": []}
    (proj / "audio_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print("total", round(sum(v["duration_s"] for v in voices), 1), "s")

asyncio.run(main())
