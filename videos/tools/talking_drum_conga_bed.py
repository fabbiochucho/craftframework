"""Procedural talking-drum + conga bed, arranged to a product-launch audio_meta.json.
usage: python drums.py <project_dir>  -> assets/music/drums.wav, re-points audio_meta.json bgm at it."""
import json, subprocess, sys, wave
from pathlib import Path
import numpy as np

proj = Path(sys.argv[1])
meta = json.loads((proj / "audio_meta.json").read_text(encoding="utf-8"))
durs = [v["duration_s"] for v in sorted(meta["voices"], key=lambda v: v["frame"])]
starts = np.cumsum([0] + durs)
TOTAL = float(starts[-1]) + 1.0
FULL_AT = float(starts[int(sys.argv[2]) - 1]) if len(sys.argv) > 2 else float(starts[3])
OUTRO_AT = float(starts[int(sys.argv[3]) - 1]) if len(sys.argv) > 3 else float(starts[10])
SR, BPM = 48000, 104
STEP = 60 / BPM / 4                  # 16th note
rng = np.random.default_rng(7)       # deterministic humanize
L = np.zeros(int(SR * (TOTAL + 2))); R = np.zeros_like(L)

def env(n, decay):
    t = np.arange(n) / SR
    return np.exp(-t / decay) * np.minimum(1, t / 0.002)

def place(sig, t, gain, pan):
    i = int(t * SR); j = min(len(L), i + len(sig)); s = sig[: j - i] * gain
    L[i:j] += s * (1 - pan) ** 0.5; R[i:j] += s * (1 + pan) ** 0.5 / 1.0

def conga(kind):
    # open tone / slap / bass ("tumba" low drum = 'low')
    f, dec, noise, ndec = {"open": (330, .22, .15, .01), "low": (215, .3, .1, .01),
                           "slap": (420, .07, .9, .025), "muff": (300, .05, .2, .008)}[kind]
    n = int(SR * dec * 5); t = np.arange(n) / SR
    f_t = f * (1 + .25 * np.exp(-t / .012))              # skin pitch drop
    ph = 2 * np.pi * np.cumsum(f_t) / SR
    body = (np.sin(ph) + .35 * np.sin(1.59 * ph) + .15 * np.sin(2.14 * ph)) * env(n, dec)
    nz = rng.standard_normal(n); nz = np.convolve(nz, [1, -.6], "same") * env(n, ndec)
    return body + noise * nz

def talking(f0, f1, glide=.12, dec=.32):
    # dùndún: pitch bends as the player squeezes the cords
    n = int(SR * dec * 4); t = np.arange(n) / SR
    k = np.clip(t / glide, 0, 1); f_t = f0 + (f1 - f0) * (3 * k**2 - 2 * k**3)
    ph = 2 * np.pi * np.cumsum(f_t) / SR
    nz = rng.standard_normal(n) * env(n, .006) * .25
    return (np.sin(ph) + .4 * np.sin(2.02 * ph) + .12 * np.sin(3.1 * ph)) * env(n, dec) + nz

def shaker():
    n = int(SR * .06); nz = rng.standard_normal(n)
    nz = nz - np.convolve(nz, np.ones(6) / 6, "same")    # crude high-pass
    return nz * env(n, .018)

# 16-step patterns (one bar). tumbao-style conga + talking-drum calls.
CONGA_FULL = {0: "muff", 2: "slap", 4: "muff", 6: "open", 7: "open", 8: "muff", 10: "slap", 12: "muff", 14: "low", 15: "low"}
CONGA_SPARSE = {0: "low", 6: "open", 8: "muff", 14: "open"}
CALLS = [  # (step, f0, f1) — bar-long phrases, cycled every other bar
    [(0, 140, 210), (3, 210, 160), (6, 180, 240), (10, 240, 150)],
    [(0, 160, 160), (2, 160, 230), (4, 230, 200), (8, 150, 220), (11, 220, 130)],
    [(0, 200, 130), (3, 130, 200), (6, 200, 250), (7, 250, 180), (12, 170, 120)],
]
bar_len = STEP * 16; bar = 0; t0 = 0.5
while t0 < TOTAL:
    full = FULL_AT <= t0 < OUTRO_AT
    outro = t0 >= OUTRO_AT
    for s in range(16):
        t = t0 + s * STEP + (STEP * .12 if s % 2 else 0)        # light swing
        if t >= TOTAL - 1.2: break
        hum = 1 + rng.uniform(-.12, .08)
        pat = CONGA_FULL if full else CONGA_SPARSE
        if s in pat and not (outro and s > 8): place(conga(pat[s]), t, .55 * hum, -.35)
        if full and s % 2 == 0: place(shaker(), t, (.16 if s % 4 else .1) * hum, .4)
    call = CALLS[(bar // 2) % len(CALLS)]
    if bar % 2 == 0 or full and bar % 4 == 1 or outro:
        for s, f0, f1 in call:
            t = t0 + s * STEP + (STEP * .12 if s % 2 else 0)
            if t < TOTAL - 1.2: place(talking(f0, f1), t, .5 * (1 + rng.uniform(-.1, .1)), .25)
    t0 += bar_len; bar += 1
# final hit
place(talking(220, 110, .25, .8), TOTAL - 1.1, .8, .1); place(conga("low"), TOTAL - 1.1, .8, -.3)

# small room reverb + fades
ir = rng.standard_normal(int(SR * .9)) * np.exp(-np.arange(int(SR * .9)) / (SR * .18)) * .025
def fftconv(x, h):
    m = len(x) + len(h) - 1; nfft = 1 << (m - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(h, nfft), nfft)[: len(x)]
mix = np.stack([L + fftconv(L, ir), R + fftconv(R, ir)], 1)[: int(SR * TOTAL)]
n = len(mix); fade_in, fade_out = int(SR * 1.0), int(SR * 1.5)
mix[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]; mix[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]
mix = mix / np.abs(mix).max() * .89
out = proj / "assets" / "music" / "drums.wav"
with wave.open(str(out), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype("<i2").tobytes())
meta["bgm"] = {"path": "assets/music/drums.wav", "source": "host", "volume": 0.22, "duration_s": round(TOTAL, 2)}
(proj / "audio_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
print(f"drums.wav {TOTAL:.1f}s · full groove from {FULL_AT:.1f}s · outro {OUTRO_AT:.1f}s")
