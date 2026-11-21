"""A quiet pad for the film, synthesized here: slow chords, soft attack, gentle tremolo. Writes public/score.wav."""
import wave
from pathlib import Path

import numpy as np

SR, DUR = 44_100, 70.0
t = np.arange(int(SR * DUR)) / SR
CHORDS = [  # (start s, frequencies Hz): A minor, F, C, G, then back to A minor
    (0, [110.0, 220.0, 261.63, 329.63]), (14, [87.31, 174.61, 220.0, 261.63]), (28, [130.81, 196.0, 261.63, 329.63]),
    (42, [98.0, 196.0, 246.94, 293.66]), (56, [110.0, 220.0, 261.63, 329.63]),
]
out = np.zeros_like(t)
for i, (start, freqs) in enumerate(CHORDS):
    end = CHORDS[i + 1][0] if i + 1 < len(CHORDS) else DUR
    env = np.clip((t - start) / 3.0, 0, 1) * np.clip((end + 3.0 - t) / 3.0, 0, 1)
    for k, f in enumerate(freqs):
        voice = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t + k) + 0.12 * np.sin(2 * np.pi * 3 * f * t)
        out += env * voice * (0.55 if k == 0 else 0.35) * (1 + 0.06 * np.sin(2 * np.pi * (0.13 + 0.05 * k) * t))
kernel = np.exp(-np.arange(0, 0.05, 1 / SR) / 0.01)
out = np.convolve(out, kernel / kernel.sum(), mode="same")  # soften the top end
out *= np.clip(t / 2.5, 0, 1) * np.clip((DUR - t) / 4.0, 0, 1)
out = out / np.abs(out).max() * 0.22
stereo = np.stack([out, np.roll(out, 300)], axis=1)
path = Path(__file__).resolve().parent.parent / "public" / "score.wav"
with wave.open(str(path), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((stereo * 32767).astype("<i2").tobytes())
print(path, f"{DUR}s")
