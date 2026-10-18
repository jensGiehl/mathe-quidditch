from argparse import ArgumentParser
from array import array
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
import hashlib
import math
import shutil
import subprocess
import sys
import urllib.request
import wave
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE_PAGE = 'https://opengameart.org/content/free-crowd-cheering-sounds'
SOURCE_URL = 'https://opengameart.org/sites/default/files/gregor_quendel_-_free_crowd_cheering_sounds_-_mp3.zip'
SOURCE_LICENSE = 'https://creativecommons.org/licenses/by/4.0/'
ARCHIVE_SHA256 = '4438762aceadab7bf8c89acaa5009611eefbfcdb2adda78e9c1ee0b2eaffc874'
RATE = 44100
CHANNELS = 2
DURATION = 1.15
TARGET_RMS = 0.25
MAXIMUM_PEAK = 0.86


@dataclass(frozen=True)
class CheerClip:
    number: int
    track: str
    title: str
    offset: float
    sha256: str

    @property
    def filename(self):
        return f'cheer-{self.number}.wav'

    @property
    def pattern(self):
        return f'* - {self.track} - *.mp3'


CLIPS = (
    CheerClip(1, '01', 'Strong cheering and strong rhythmic cheering', 5.00,
              'fff90896c3a70f31e378d3fd9c225262a292dde8a5823c7abc02cc92de584ddd'),
    CheerClip(2, '02', 'Strong cheering and soft rhythmic cheering', 4.80,
              '884368e1e1d0bd33ded8559097017cae80a6c4b127e7b12735bf3c414c8bffa1'),
    CheerClip(3, '03', 'Strong cheering - I', 7.20,
              '3aff86987fd73a322ddea3230455c460a2825a40b80915967d70a80f35f0409a'),
    CheerClip(4, '04', 'Strong cheering - II - Short', 6.30,
              '10878a490dd3f1af7877a23c33baca143a3f86f91112c5dfb59dcf83cc94e975'),
    CheerClip(5, '08', 'Rhythmic cheering', 7.70,
              '0f29aae919e07c46a20f04ffa511e7ddb87a0541a4f15acb0c4647204bf26c59'),
)


def source_file(folder, clip):
    matches = list(folder.rglob(clip.pattern))
    if len(matches) != 1:
        raise ValueError(f'Expected one source for track {clip.track}, found {len(matches)} in {folder}')
    source = matches[0]
    if hashlib.sha256(source.read_bytes()).hexdigest() != clip.sha256:
        raise ValueError(f'Source checksum differs: {source}')
    return source


def download_sources(folder):
    request = urllib.request.Request(SOURCE_URL, headers={'User-Agent': 'Mathe-Quidditch audio asset preparation'})
    with urllib.request.urlopen(request, timeout=60) as response:
        archive_bytes = response.read()
    if hashlib.sha256(archive_bytes).hexdigest() != ARCHIVE_SHA256:
        raise ValueError('Downloaded archive checksum differs from the verified source')
    folder.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(BytesIO(archive_bytes)) as archive:
        for clip in CLIPS:
            existing = list(folder.rglob(clip.pattern))
            if existing:
                source_file(folder, clip)
                continue
            members = [member for member in archive.namelist() if Path(member).match(clip.pattern)]
            if len(members) != 1:
                raise ValueError(f'Expected one archive member for track {clip.track}')
            recording = archive.read(members[0])
            if hashlib.sha256(recording).hexdigest() != clip.sha256:
                raise ValueError(f'Archive recording checksum differs for track {clip.track}')
            (folder / Path(members[0]).name).write_bytes(recording)


def prepare(clip, source, output_folder, ffmpeg):
    filters = (
        'highpass=f=75,'
        'acompressor=threshold=0.16:ratio=1.8:attack=8:release=100:knee=2.5:makeup=1,'
        'afade=t=in:st=0:d=0.012,'
        f'afade=t=out:st={DURATION - 0.095:.3f}:d=0.095'
    )
    result = subprocess.run([
        ffmpeg, '-nostdin', '-hide_banner', '-loglevel', 'error',
        '-ss', f'{clip.offset:.3f}', '-i', str(source), '-t', f'{DURATION:.3f}',
        '-map', '0:a:0', '-vn', '-af', filters, '-ar', str(RATE), '-ac', str(CHANNELS),
        '-f', 'f32le', 'pipe:1',
    ], check=True, capture_output=True)
    samples = array('f')
    samples.frombytes(result.stdout)
    if sys.byteorder != 'little':
        samples.byteswap()
    expected_samples = round(DURATION * RATE) * CHANNELS
    if len(samples) != expected_samples:
        raise ValueError(f'{clip.filename}: expected {expected_samples} samples, got {len(samples)}')
    peak = max(abs(value) for value in samples)
    rms = math.sqrt(sum(value * value for value in samples) / len(samples))
    if peak == 0 or rms == 0:
        raise ValueError(f'{clip.filename}: source is silent')
    gain = min(MAXIMUM_PEAK / peak, TARGET_RMS / rms)
    pcm = array('h', (round(value * gain * 32767) for value in samples))
    if sys.byteorder != 'little':
        pcm.byteswap()
    destination = output_folder / clip.filename
    with wave.open(str(destination), 'wb') as output:
        output.setnchannels(CHANNELS)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(pcm.tobytes())
    print(f'{clip.filename}: track {clip.track}, {clip.offset:.2f}-{clip.offset + DURATION:.2f}s, '
          f'RMS {20 * math.log10(rms * gain):.2f} dBFS, peak {20 * math.log10(peak * gain):.2f} dBFS, '
          f'gain {20 * math.log10(gain):+.2f} dB, SHA256 {hashlib.sha256(destination.read_bytes()).hexdigest()}')


def main():
    parser = ArgumentParser(
        description='Prepare five recorded crowd cheers by Gregor Quendel (CC BY 4.0) using FFmpeg.',
        epilog=f'Source: {SOURCE_PAGE} | License: {SOURCE_LICENSE}',
    )
    parser.add_argument('--source-dir', type=Path, default=ROOT / 'artifacts/audio-sources/gregor-quendel',
                        help='Directory containing the original MP3 recordings')
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'src/main/resources/static/assets/audio',
                        help='Destination for cheer-1.wav through cheer-5.wav')
    parser.add_argument('--download', action='store_true',
                        help='Explicitly download the verified source archive without requiring an account')
    parser.add_argument('--ffmpeg', default='ffmpeg', help='FFmpeg executable, default: ffmpeg in PATH')
    arguments = parser.parse_args()
    ffmpeg = shutil.which(arguments.ffmpeg)
    if ffmpeg is None:
        parser.error('FFmpeg is required; install FFmpeg or pass --ffmpeg with its executable path')
    try:
        if arguments.download:
            download_sources(arguments.source_dir)
        sources = [(clip, source_file(arguments.source_dir, clip)) for clip in CLIPS]
    except (OSError, ValueError, zipfile.BadZipFile) as exception:
        parser.error(f'{exception}. Use --download to retrieve the verified original recordings.')
    arguments.output_dir.mkdir(parents=True, exist_ok=True)
    for clip, source in sources:
        prepare(clip, source, arguments.output_dir, ffmpeg)


if __name__ == '__main__':
    main()
