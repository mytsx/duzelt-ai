#!/usr/bin/env python3
"""Lisanslı kaydın sözcük zamanlarını mevcut yerel Whisper modeliyle çıkarır."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

import numpy as np
from faster_whisper import WhisperModel


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audio', type=Path, required=True)
    parser.add_argument('--model', default='base')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    # Existing cache only. No model download, provider request, or account use.
    model = WhisperModel(args.model, device='cpu', compute_type='int8', local_files_only=True)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(args.audio), '-ar', '16000', '-ac', '1', '-f', 'f32le', '-'], check=True, capture_output=True).stdout
    audio = np.frombuffer(raw, dtype=np.float32)
    segments, _ = model.transcribe(audio, language='tr', word_timestamps=True, beam_size=5, vad_filter=False)
    rows = [{'start': s.start, 'end': s.end, 'text': s.text, 'words': [{'word': w.word, 'start': w.start, 'end': w.end, 'probability': w.probability} for w in s.words]} for s in segments]
    output = args.output or args.audio.with_suffix('.word-timing.json')
    output.write_text(json.dumps({'model': 'faster-whisper-' + args.model, 'device': 'cpu-int8', 'localFilesOnly': True, 'language': 'tr', 'decoder': 'ffmpeg 16kHz mono float32', 'sourceSha256': hashlib.sha256(args.audio.read_bytes()).hexdigest(), 'segments': rows}, ensure_ascii=False, indent=2) + '\n')
    print(output)


if __name__ == '__main__':
    main()
