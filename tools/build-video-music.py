"""Compose original sparse instrumental music and duck it under licensed narration."""

import argparse
import json
import math
from pathlib import Path
import subprocess
import wave

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--config", type=Path, default=ROOT / "store/video/voice-release.json")
parser.add_argument("--music-only", action="store_true", help="Prepare original instrumental before licensed voice arrives")
ARGS = parser.parse_args()
CONFIG = json.loads(ARGS.config.read_text())
OUT = ROOT / CONFIG.get("outputDir", "output/video")
RATE = 48000


def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True)


def frequency(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def write_wave(path, audio):
    with wave.open(str(path), "wb") as file:
        file.setnchannels(2)
        file.setsampwidth(2)
        file.setframerate(RATE)
        file.writeframes((np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes())


def read_wave(path):
    with wave.open(str(path), "rb") as file:
        if (file.getnchannels(), file.getsampwidth(), file.getframerate()) != (2, 2, RATE):
            raise ValueError("Expected stereo 16-bit 48 kHz WAV")
        return np.frombuffer(file.readframes(file.getnframes()), "<i2").reshape(-1, 2) / 32768


def db(value):
    return float(20 * np.log10(max(float(value), 1e-9)))


def compose_music():
    duration = CONFIG["durationSeconds"]
    count = round(duration * RATE)
    music = np.zeros((count, 2), dtype=np.float64)
    # Dmaj9 -> Bm9 -> Gmaj9 -> Asus -> Gmaj9 -> Dmaj9; original sparse motif.
    harmonies = [[50, 57, 61, 64, 66], [47, 54, 57, 61, 66],
                 [43, 50, 54, 57, 62], [45, 52, 57, 59, 64],
                 [43, 50, 54, 57, 62], [50, 57, 61, 64, 66]]
    starts = CONFIG["sceneStarts"]
    if len(starts) != len(harmonies):
        raise ValueError("Music harmonies require the six approved storyboard scenes")
    for index, chord in enumerate(harmonies):
        start = max(0, starts[index] - 0.3)
        end = min(duration, (starts[index + 1] if index < len(harmonies) - 1 else duration) + 0.3)
        first, last = round(start * RATE), round(end * RATE)
        time = np.arange(last - first) / RATE
        length = end - start
        envelope = np.minimum(time / 0.6, 1) * np.minimum((length - time) / 0.65, 1)
        envelope = np.sin(np.maximum(envelope, 0) * np.pi / 2) ** 2
        pad = np.zeros((len(time), 2))
        for note_index, note in enumerate(chord):
            hz = frequency(note)
            for channel, detune in enumerate([-0.001, 0.001]):
                phase = 2 * np.pi * hz * (1 + detune) * time + note_index * 0.3
                tone = np.sin(phase) + 0.13 * np.sin(phase * 2) + 0.035 * np.sin(phase * 3)
                pad[:, channel] += 0.07 * tone / len(chord)
        music[first:last] += pad * envelope[:, None]
        bass = np.sin(2 * np.pi * frequency(chord[0] - 12) * time)
        music[first:last] += bass[:, None] * envelope[:, None] * 0.018
        # Gentle felt-key motif; section onsets follow the picture changes.
        motif = [chord[3] + 12, chord[1] + 12, chord[4] + 12]
        step = 120 / CONFIG["music"]["bpm"]
        for beat, onset in enumerate(np.arange(starts[index] + 0.08, end - 0.4, step)):
            note = motif[beat % len(motif)]
            first_note = round(onset * RATE)
            last_note = min(count, first_note + round(2.1 * RATE))
            local = np.arange(last_note - first_note) / RATE
            phase = 2 * np.pi * frequency(note) * local
            tone = np.sin(phase) + 0.18 * np.sin(2.002 * phase) + 0.035 * np.sin(3.004 * phase)
            shape = (1 - np.exp(-local / 0.025)) * np.exp(-local / 0.48)
            pan = 0.35 if beat % 2 else -0.35
            gain = np.array([math.sqrt((1 - pan) / 2), math.sqrt((1 + pan) / 2)])
            music[first_note:last_note] += (tone * shape * 0.035)[:, None] * gain
    timeline = np.arange(count) / RATE
    fade = np.minimum(timeline / 0.6, 1) * np.minimum((duration - timeline) / 1.1, 1)
    music *= np.maximum(fade, 0)[:, None]
    music *= 10 ** (CONFIG["music"]["dryRmsDbfs"] / 20) / math.sqrt(np.mean(music ** 2))
    path = OUT / "duzelt-ai-fon-muzigi.wav"
    write_wave(path, music)
    return path


def measure_loudness(path):
    measurement = run([
        "ffmpeg", "-hide_banner", "-i", str(path), "-af",
        "loudnorm=I=-16:TP=-1.5:LRA=7:print_format=json", "-f", "null", "-"
    ]).stderr
    return json.loads(measurement[measurement.rfind("{"):measurement.rfind("}") + 1])


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    if ARGS.music_only:
        print(compose_music())
        return
    if CONFIG.get("status") != "licensed-aligned" or not CONFIG.get("audio"):
        raise ValueError("Licensed final narration and alignment are required for mixing")
    source = ROOT / CONFIG["audio"]
    audio_probe = json.loads(run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=channels", "-of", "json", str(source)]).stdout)
    if audio_probe["streams"][0]["channels"] != 1:
        raise ValueError("This mastering profile requires the verified mono ElevenLabs source")
    stats = measure_loudness(source)
    # Fixed gain preserves every speech sample and adds no normalizer latency.
    # The mono narration is duplicated to stereo, adding 3.01 LU to loudness.
    mastering = CONFIG["mastering"]
    voice_gain = min(
        mastering["targetIntegratedLufs"] - (float(stats["input_i"]) + 10 * math.log10(2)),
        mastering["maxVoiceTruePeakDbtp"] - float(stats["input_tp"]),
    )
    duration = CONFIG["durationSeconds"]
    lead = round(CONFIG["audioLeadSeconds"] * 1000)
    voice = OUT / "duzelt-ai-voice-master.wav"
    run([
        "ffmpeg", "-v", "error", "-y", "-i", str(source), "-af",
        f"aresample={RATE},pan=stereo|c0=c0|c1=c0,volume={voice_gain}dB,asetpts=N/SR/TB,"
        f"adelay={lead}:all=1,apad,atrim=duration={duration}",
        "-ar", str(RATE), "-ac", "2", "-c:a", "pcm_s16le", str(voice)
    ])
    music = compose_music()
    ducked = OUT / "duzelt-ai-music-ducked.wav"
    mix = ROOT / CONFIG["mixedAudio"]
    run([
        "ffmpeg", "-v", "error", "-y", "-i", str(voice), "-i", str(music),
        "-filter_complex",
        "[0:a]asplit=2[narration][sidechain];"
        "[1:a][sidechain]sidechaincompress=threshold=0.018:ratio=8:attack=8:"
        "release=550:knee=4:makeup=1:detection=rms[ducked];"
        f"[ducked]apad,atrim=duration={duration},asplit=2[bed][stem];"
        "[narration][bed]amix=inputs=2:normalize=0:duration=first[mix]",
        "-map", "[stem]", "-ar", str(RATE), "-c:a", "pcm_s16le", str(ducked),
        "-map", "[mix]", "-ar", str(RATE), "-c:a", "pcm_s16le", str(mix)
    ])
    narration, background, mastered = map(read_wave, [voice, ducked, mix])
    assert narration.shape == background.shape == mastered.shape
    assert len(mastered) == round(duration * RATE), "Audio duration changed"
    margins = []
    block = round(0.1 * RATE)
    for first in range(0, len(narration) - block, block):
        v = math.sqrt(np.mean(narration[first:first + block] ** 2))
        b = math.sqrt(np.mean(background[first:first + block] ** 2))
        if db(v) > -35:
            margins.append(db(v) - db(b))
    report = {
        "durationSeconds": len(mastered) / RATE,
        "music": "Original procedural instrumental; no external music samples",
        "voiceRmsDbfs": db(math.sqrt(np.mean(narration ** 2))),
        "musicRmsDbfs": db(math.sqrt(np.mean(background ** 2))),
        "voiceToMusicMedianDb": float(np.median(margins)),
        "voiceToMusic10thPercentileDb": float(np.percentile(margins, 10)),
        "mixPeakDbfs": db(np.max(np.abs(mastered))),
        "speechBlocksMeasured": len(margins),
        "sourceIntegratedLufsMono": float(stats["input_i"]),
        "voiceGainDb": voice_gain,
        "voiceIntegratedLufsStereo": float(measure_loudness(voice)["input_i"]),
        "mixLoudness": measure_loudness(mix),
        "sidechain": {"attackMs": 8, "releaseMs": 550, "ratio": 8},
    }
    if (report["mixPeakDbfs"] > -1
            or float(report["mixLoudness"]["input_tp"]) > -1
            or report["voiceToMusic10thPercentileDb"] < 18):
        raise ValueError(f"Audio mix needs adjustment: {report}")
    (OUT / "music-mix-check.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
