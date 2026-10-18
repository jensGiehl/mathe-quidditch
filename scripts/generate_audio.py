from array import array
from pathlib import Path
import math
import random
import wave

RATE = 22050
DESTINATION = Path(__file__).resolve().parents[1] / 'src/main/resources/static/assets/audio'
TAU = math.tau
MUSIC_BPM = 132


def save(name, samples):
    peak = max(max(abs(value) for value in samples), 0.01)
    pcm = array('h', (round(max(-1, min(1, value / peak * 0.72)) * 32767) for value in samples))
    with wave.open(str(DESTINATION / name), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(pcm.tobytes())


def frequency(note):
    return 440 * 2 ** ((note - 69) / 12)


def vowel_weights(pitch, formants):
    weights = []
    for harmonic in range(1, 22):
        overtone = harmonic * pitch
        resonance = sum(strength * math.exp(-0.5 * ((overtone - center) / width) ** 2)
                        for center, width, strength in formants)
        weights.append((0.07 + resonance) / harmonic ** 0.65)
    total = sum(weights)
    return tuple(value / total for value in weights)


def crowd_voice(samples, rng, start, duration, pitch, first_vowel, last_vowel, glide, gain, chant=False):
    first_weights = vowel_weights(pitch, first_vowel)
    last_weights = vowel_weights(pitch, last_vowel)
    phase = rng.random() * TAU
    vibrato_phase = rng.random() * TAU
    first_index = int(start * RATE)
    for offset in range(min(int(duration * RATE), len(samples) - first_index)):
        time = offset / RATE
        progress = time / duration
        envelope = min(1, time / 0.065) * min(1, (duration - time) / 0.22)
        envelope *= 0.82 + 0.18 * math.sin(math.pi * progress)
        if chant:
            envelope *= 0.38 + 0.62 * abs(math.sin(TAU * progress)) ** 0.45
        drift = 1 + glide * progress + 0.011 * math.sin(time * 37 + vibrato_phase)
        phase += TAU * pitch * drift / RATE
        vocal = sum(math.sin(phase * harmonic) * (first * (1 - progress) + last * progress)
                    for harmonic, (first, last) in enumerate(zip(first_weights, last_weights), 1))
        breath = rng.uniform(-1, 1) * 0.025
        samples[first_index + offset] += gain * envelope * (vocal + breath)


def crowd_ohh():
    rng = random.Random(74019)
    samples = [0.0] * int(RATE * 1.45)
    open_oh = ((510, 140, 1.0), (970, 180, 0.8), (2450, 310, 0.16))
    closed_oh = ((365, 125, 1.0), (740, 160, 0.75), (2200, 310, 0.12))
    for voice in range(30):
        start = rng.uniform(0.012, 0.115)
        duration = rng.uniform(1.12, min(1.33, 1.45 - start))
        crowd_voice(samples, rng, start, duration, rng.uniform(115, 270),
                    open_oh, closed_oh, rng.uniform(-0.31, -0.20), rng.uniform(0.12, 0.19))
    save('crowd-ohh.wav', samples)


def spell():
    rng = random.Random(96)
    samples = []
    for index in range(int(RATE * 1.65)):
        time = index / RATE
        envelope = min(1, time * 14) * math.exp(-time * 2.9)
        shimmer = sum(math.sin(TAU * tone * time + 0.35 * math.sin(time * 11)) / (number + 1)
                      for number, tone in enumerate([880, 1320, 1760, 2217, 2637]))
        sweep = math.sin(TAU * (240 * time + 880 * time * time)) * math.exp(-time * 9)
        samples.append(envelope * 0.25 * shimmer + sweep * 0.16 + rng.uniform(-1, 1) * envelope * 0.018)
    save('spell.wav', samples)


def add_note(samples, note, start, duration, gain, instrument):
    tone_frequency = frequency(note)
    first_index = round(start * RATE)
    for offset in range(round(duration * RATE)):
        time = offset / RATE
        progress = time / duration
        phase = TAU * tone_frequency * time
        if instrument == 'harp':
            envelope = min(1, time * 120) * math.exp(-time * 8) * (1 - progress)
            tone = math.sin(phase) + 0.32 * math.sin(phase * 2) + 0.13 * math.sin(phase * 3)
        elif instrument == 'celesta':
            envelope = min(1, time * 90) * math.exp(-time * 4.5) * (1 - progress)
            tone = math.sin(phase) + 0.30 * math.sin(phase * 2.76) + 0.13 * math.sin(phase * 5.4)
        elif instrument == 'bass':
            envelope = min(1, time * 80) * math.exp(-time * 5) * (1 - progress)
            tone = math.sin(phase) + 0.18 * math.sin(phase * 2)
        else:
            envelope = math.sin(math.pi * progress) ** 1.1
            vibrato = 0.012 * math.sin(time * 29)
            tone = math.sin(phase + vibrato) + 0.19 * math.sin(phase * 2 + vibrato)
        samples[(first_index + offset) % len(samples)] += gain * envelope * tone


def percussion(samples, rng, start, kind):
    first_index = round(start * RATE)
    duration = 0.16 if kind == 'kick' else 0.11
    previous = 0.0
    for offset in range(round(duration * RATE)):
        time = offset / RATE
        noise = rng.uniform(-1, 1)
        if kind == 'kick':
            phase = TAU * (53 * time + 38 * (1 - math.exp(-time * 35)) / 35)
            tone = 0.11 * math.sin(phase) * math.exp(-time * 24)
        elif kind == 'shaker':
            tone = 0.023 * (noise - previous * 0.85) * math.exp(-time * 65)
        else:
            tone = (0.042 * noise + 0.025 * math.sin(TAU * 195 * time)) * math.exp(-time * 34)
        previous = noise
        samples[(first_index + offset) % len(samples)] += tone * min(1, time * 1500)


def music():
    rng = random.Random(132064)
    beat_length = 60 / MUSIC_BPM
    bar_length = beat_length * 4
    samples = [0.0] * round(bar_length * 16 * RATE)
    chords = [(50, 57, 62, 65), (46, 53, 58, 62), (53, 60, 65, 69), (48, 55, 60, 64),
              (50, 57, 62, 65), (46, 53, 58, 62), (43, 50, 58, 62), (45, 52, 61, 64)]
    arpeggio = (1, 2, 3, 2, 1, 3, 2, 3)
    melody = [(77, 0, 1), (81, 1.5, 0.5), (77, 2.5, 1), (74, 3.5, 0.5)]
    for bar in range(16):
        chord = chords[bar % len(chords)]
        start = bar * bar_length
        for note in chord[1:]:
            add_note(samples, note, start, bar_length, 0.026, 'pad')
        for step, chord_index in enumerate(arpeggio):
            note = chord[chord_index] + 12 + (12 if bar >= 8 and step == 7 else 0)
            add_note(samples, note, start + step * beat_length / 2, beat_length * 1.4,
                     0.075 if step % 2 == 0 else 0.052, 'harp')
            percussion(samples, rng, start + step * beat_length / 2, 'shaker')
        for beat in range(4):
            note = chord[0] if beat < 2 else chord[0] + 7
            add_note(samples, note - 12, start + beat * beat_length, beat_length * 0.8, 0.085, 'bass')
            percussion(samples, rng, start + beat * beat_length, 'kick' if beat % 2 == 0 else 'tap')
        if bar % 4 in (0, 2):
            transposition = (chord[2] - 62) + (0 if bar < 8 else 12)
            for note, beat, length in melody:
                add_note(samples, note + transposition, start + beat * beat_length,
                         beat_length * (length + 0.8), 0.043, 'celesta')
    save('music.wav', samples)


if __name__ == '__main__':
    DESTINATION.mkdir(parents=True, exist_ok=True)
    crowd_ohh()
    spell()
    music()
