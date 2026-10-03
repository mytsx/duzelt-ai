#!/usr/bin/env python3
"""Sabit ürün sahnelerini birleştirir; final ses ve hizalama olmadan yayın çıktısı üretmez."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
FPS, WIDTH, HEIGHT, FADE = 30, 1920, 1080, 0.4


def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True)


def probe(path):
    return json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)]).stdout)


def srt_time(seconds):
    millis = round(seconds * 1000)
    hours, millis = divmod(millis, 3600000)
    minutes, millis = divmod(millis, 60000)
    seconds, millis = divmod(millis, 1000)
    return f'{hours:02}:{minutes:02}:{seconds:02},{millis:03}'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, default=ROOT / 'store/video/voice-release.json')
    parser.add_argument('--visual-preview', action='store_true', help='Ses içermeyen, yayın için olmayan görsel taslak')
    args = parser.parse_args()
    config = json.loads(args.config.read_text())
    duration, starts = config['durationSeconds'], config['sceneStarts']
    if not 25 <= duration <= 40 or starts != sorted(set(starts)) or starts[0] != 0:
        raise ValueError('25–40 saniye ve sıfırdan başlayan artan sahne süreleri gerekir.')
    scene_dir = ROOT / config['sceneDir']
    scenes = [scene_dir / f'scene-{i}.png' for i in range(1, len(starts) + 1)]
    for path in scenes:
        if not path.is_file():
            raise FileNotFoundError(path)
    if args.visual_preview:
        out = ROOT / 'output/video/visual-preview'
        video = out / 'duzelt-ai-gorsel-taslak-SESLENDIRME-BEKLENIYOR.mp4'
    else:
        if config.get('status') != 'licensed-aligned' or config.get('alignment', {}).get('status') != 'verified':
            raise ValueError('Final lisanslı ses ve gerçek sözcük/durak hizalama kaydı gerekir.')
        if not config.get('audio') or not config.get('captions'):
            raise ValueError('Final ses ve altyazı olmadan yayın videosu üretilemez.')
        source = ROOT / config['audio']
        source_duration = float(probe(source)['format']['duration'])
        if source_duration + config['audioLeadSeconds'] > duration - 0.3:
            raise ValueError('Ses videoya sığmıyor; final süre/hizalama düzeltilmeli.')
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        if digest != config['alignment']['sourceAudioSha256']:
            raise ValueError('Hizalama kaydı bu ses dosyasına ait değil.')
        previous = 0
        for cue in config['captions']:
            if not previous <= cue['start'] < cue['end'] <= duration:
                raise ValueError('Altyazı sırası veya zaman aralığı geçersiz.')
            previous = cue['end']
        mixed = ROOT / config['mixedAudio']
        if abs(float(probe(mixed)['format']['duration']) - duration) > 0.02:
            raise ValueError('Miks süresi videoyla eşleşmiyor.')
        out = ROOT / config['outputDir']
        video = out / config['outputVideo']
    out.mkdir(parents=True, exist_ok=True)
    command = ['ffmpeg', '-v', 'error', '-y', '-filter_complex_threads', '1']
    filters = []
    for i, scene in enumerate(scenes):
        start = 0 if i == 0 else starts[i] - FADE / 2
        end = duration if i == len(scenes) - 1 else starts[i+1] + FADE / 2
        frames = math.ceil((end-start) * FPS)
        command += ['-loop', '1', '-framerate', str(FPS), '-t', str(frames/FPS), '-i', str(scene)]
        filters.append(f'[{i}:v]format=yuv420p,settb=AVTB,setsar=1[v{i}]')
    current = 'v0'
    for i in range(1, len(scenes)):
        label = f'fade{i}'
        filters.append(f'[{current}][v{i}]xfade=transition=fade:duration={FADE}:offset={starts[i]-FADE/2}[{label}]')
        current = label
    if not args.visual_preview:
        command += ['-i', str(mixed)]
    command += ['-filter_complex', ';'.join(filters), '-map', f'[{current}]']
    if args.visual_preview:
        command += ['-an']
    else:
        command += ['-map', f'{len(scenes)}:a', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000']
    command += ['-t', str(duration), '-r', str(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-metadata', 'comment=' + ('Visual draft only; narration pending' if args.visual_preview else config['videoComment']), str(video)]
    run(command)
    run(['ffmpeg', '-v', 'error', '-i', str(video), '-f', 'null', '-'])
    if not args.visual_preview:
        subtitles = '\n\n'.join(f"{i}\n{srt_time(c['start'])} --> {srt_time(c['end'])}\n{c['text']}" for i, c in enumerate(config['captions'], 1))
        video.with_suffix('.tr.srt').write_text(subtitles + '\n', encoding='utf-8')
    info = probe(video)
    stream = next(s for s in info['streams'] if s['codec_type'] == 'video')
    if (stream['width'], stream['height'], stream['codec_name'], stream['r_frame_rate']) != (WIDTH, HEIGHT, 'h264', '30/1'):
        raise ValueError('Video boyutu, codec veya fps beklenenden farklı.')
    if abs(float(info['format']['duration']) - duration) > 0.05:
        raise ValueError('Video süresi beklenenden farklı.')
    # Compare two decoded frames within each stationary scene (outside fades).
    comparisons = []
    for i, start in enumerate(starts):
        end = duration if i == len(starts)-1 else starts[i+1]
        times = [start+0.8, end-0.8]
        digests, pixels = [], []
        for moment in times:
            raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(moment), '-i', str(video), '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], check=True, capture_output=True).stdout
            digests.append(hashlib.sha256(raw).hexdigest())
            pixels.append(np.frombuffer(raw, dtype=np.uint8).astype(np.int16))
        difference = np.abs(pixels[0] - pixels[1])
        mean_error = float(difference.mean())
        changed_fraction = float((difference > 8).mean())
        if mean_error > 0.5 or changed_fraction > 0.005:
            raise ValueError('Stationary scene changed beyond codec noise: ' + str(i+1))
        comparisons.append({'scene': i+1, 'times': times, 'decodedFrameHashes': digests, 'identical': digests[0] == digests[1], 'meanAbsolutePixelDifference': mean_error, 'fractionAbove8Levels': changed_fraction, 'withinCodecNoiseThreshold': True})
    report = {'status': 'visual-draft-narration-pending' if args.visual_preview else 'rendered-awaiting-human-full-watch-and-listen', 'video': str(video.relative_to(ROOT)), 'sha256': hashlib.sha256(video.read_bytes()).hexdigest(), 'duration': float(info['format']['duration']), 'videoStream': stream, 'fullDecode': 'passed', 'stationaryComparisons': comparisons, 'sourceSha256': {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in scenes}, 'captions': 'SRT sidecar; never cover product UI' if not args.visual_preview else 'pending final voice alignment'}
    (out / 'render-check.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(video)
    print('Full decode passed; stationary-scene comparison saved to render-check.json')


if __name__ == '__main__':
    main()
