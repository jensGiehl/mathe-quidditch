import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { FlightAudio } from '../src/main/resources/static/js/audio.js';

const originals = new Map();
const installGlobal = (name, value) => {
    if (!originals.has(name)) originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
};
const settle = () => new Promise(resolve => setImmediate(resolve));
const responseFor = name => ({ ok: true, arrayBuffer: async () => ({ name }) });
let fetches;
let contexts;

class AudioParamMock {
    constructor() { this.value = 0; }
    setValueAtTime(value) { this.value = value; }
    exponentialRampToValueAtTime(value) { this.value = value; }
}

class AudioNodeMock {
    constructor() {
        this.started = 0;
        this.stopped = 0;
        this.disconnected = 0;
        this.frequency = new AudioParamMock();
        this.gain = new AudioParamMock();
    }
    connect(node) { this.connectedTo = node; return node; }
    disconnect() { this.disconnected += 1; }
    start(at) { this.started += 1; this.startedAt = at; }
    stop(at) {
        this.stopped += 1;
        this.stoppedAt = at;
        if (at === undefined) queueMicrotask(() => this.onended?.());
    }
}

class AudioContextMock {
    constructor() {
        this.state = 'suspended';
        this.currentTime = 5;
        this.destination = {};
        this.resumes = 0;
        this.suspends = 0;
        this.sources = [];
        this.oscillators = [];
        contexts.push(this);
    }
    async resume() { this.resumes += 1; this.state = 'running'; }
    async suspend() { this.suspends += 1; this.state = 'suspended'; }
    async decodeAudioData(data) { return { name: data.name }; }
    createBufferSource() {
        const source = new AudioNodeMock();
        this.sources.push(source);
        return source;
    }
    createGain() { return new AudioNodeMock(); }
    createOscillator() {
        const oscillator = new AudioNodeMock();
        this.oscillators.push(oscillator);
        return oscillator;
    }
}

beforeEach(context => {
    contexts = [];
    fetches = [];
    context.mock.method(Math, 'random', () => 0);
    installGlobal('window', { AudioContext: AudioContextMock });
    installGlobal('document', { hidden: false });
    installGlobal('fetch', async path => {
        const name = path.split('/').at(-1).replace('.wav', '');
        fetches.push(name);
        return responseFor(name);
    });
});

after(() => {
    for (const [name, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
    }
});

async function createAudio(options) {
    const audio = new FlightAudio(options);
    await audio.unlock();
    await settle();
    return { audio, context: contexts.at(-1) };
}

test('music stays off by default after the first user gesture', async () => {
    const { audio, context } = await createAudio();
    assert.equal(audio.musicEnabled, false);
    assert.equal(audio.effectsEnabled, true);
    assert.equal(context.state, 'running');
    assert.equal(context.sources.length, 0);
    assert.ok(!fetches.includes('music'));
});

test('accepted answers shuffle all five cheers while only milestones add the spell', async () => {
    const { audio, context } = await createAudio();
    for (let correctCount = 1; correctCount <= 10; correctCount++) {
        audio.reward({ id: `answer-${correctCount}`, variant: 2, correctCount, milestone: correctCount === 10 });
    }
    await settle();
    const cheers = context.sources.map(source => source.buffer.name).filter(name => name.startsWith('cheer-'));
    const variants = ['cheer-1', 'cheer-2', 'cheer-3', 'cheer-4', 'cheer-5'];
    assert.equal(cheers.length, 10);
    assert.deepEqual([...cheers.slice(0, 5)].sort(), variants);
    assert.deepEqual([...cheers.slice(5)].sort(), variants);
    assert.ok(cheers.every((name, index) => index === 0 || name !== cheers[index - 1]));
    assert.deepEqual(fetches.filter(name => name.startsWith('cheer-')).sort(), variants);
    assert.equal(context.sources.filter(source => source.buffer.name === 'spell').length, 1);
    assert.equal(context.sources.at(-1).buffer.name, 'spell');
    assert.ok(context.sources.every(source => source.started === 1));
    assert.ok(context.sources.every(source => source.connectedTo.gain.value > 0 && source.connectedTo.gain.value < 0.7));
});

test('the shuffle draws a random order independently of the visual reward variant', async () => {
    const first = await createAudio();
    first.audio.reward({ variant: 0, correctCount: 1 });
    await settle();
    assert.equal(first.context.sources[0].buffer.name, 'cheer-1');
    Math.random.mock.mockImplementation(() => 0.999);
    const second = await createAudio();
    second.audio.reward({ variant: 0, correctCount: 1 });
    await settle();
    assert.equal(second.context.sources[0].buffer.name, 'cheer-5');
});

test('the next shuffled round cannot immediately repeat the last cheer', async () => {
    const draws = [0, 0, 0, 0, 0.2, 0, 0, 0, 0];
    Math.random.mock.mockImplementation(() => draws.shift() ?? 0);
    const { audio, context } = await createAudio();
    for (let correctCount = 1; correctCount <= 10; correctCount++) audio.reward({ correctCount });
    await settle();
    const cheers = context.sources.map(source => source.buffer.name);
    assert.deepEqual(cheers.slice(0, 5), ['cheer-1', 'cheer-5', 'cheer-4', 'cheer-3', 'cheer-2']);
    assert.notEqual(cheers[5], cheers[4]);
    assert.deepEqual([...cheers.slice(5)].sort(), ['cheer-1', 'cheer-2', 'cheer-3', 'cheer-4', 'cheer-5']);
    assert.ok(cheers.every((name, index) => index === 0 || name !== cheers[index - 1]));
});

test('wrong answers play the crowd reaction independently of background music', async () => {
    const { audio, context } = await createAudio({ music: true });
    audio.wrongAnswer();
    await settle();
    assert.deepEqual(context.sources.map(source => source.buffer.name), ['music', 'crowd-ohh']);
    const reaction = context.sources[1];
    assert.equal(reaction.started, 1);
    audio.setEffects(false);
    await settle();
    assert.equal(reaction.stopped, 1);
    assert.equal(context.sources[0].stopped, 0);
    audio.wrongAnswer();
    await settle();
    assert.equal(context.sources.length, 2);
});

test('a wrong answer received in a hidden tab plays once after returning', async () => {
    const { audio, context } = await createAudio();
    document.hidden = true;
    await audio.setPaused(true);
    audio.wrongAnswer();
    await settle();
    assert.equal(context.sources.length, 0);
    document.hidden = false;
    await audio.setPaused(false);
    await audio.setPaused(false);
    await settle();
    assert.deepEqual(context.sources.map(source => source.buffer.name), ['crowd-ohh']);
});

test('restart and muting cancel queued or still loading crowd reactions', async () => {
    let resolveReaction;
    const defaultFetch = fetch;
    installGlobal('fetch', path => path.endsWith('/crowd-ohh.wav')
        ? new Promise(resolve => { resolveReaction = resolve; })
        : defaultFetch(path));
    const { audio, context } = await createAudio();
    audio.wrongAnswer();
    audio.stopEffects();
    resolveReaction(responseFor('crowd-ohh'));
    await settle();
    assert.equal(context.sources.length, 0);
    for (const reset of [() => audio.stopEffects(), () => audio.setEffects(false)]) {
        await audio.setPaused(true);
        audio.wrongAnswer();
        reset();
        audio.setEffects(true);
        await audio.setPaused(false);
        await settle();
        assert.equal(context.sources.length, 0);
    }
});

test('the effects switch stops cheers and spells while preserving background music', async () => {
    const { audio, context } = await createAudio({ music: true });
    audio.reward({ id: 'ten', variant: 0, correctCount: 10, milestone: true });
    await settle();
    const music = context.sources.find(source => source.buffer.name === 'music');
    const effects = context.sources.filter(source => source !== music);
    assert.equal(effects.length, 2);
    audio.setEffects(false);
    await settle();
    assert.ok(effects.every(source => source.stopped === 1));
    assert.equal(music.stopped, 0);
    audio.reward({ id: 'twenty', variant: 1, correctCount: 20, milestone: true });
    audio.boost();
    await settle();
    assert.equal(context.sources.length, 3);
    assert.equal(context.oscillators.length, 0);
    assert.equal(audio.sources.size, 0);
});

test('a reward received during pause plays exactly once when the flight resumes', async () => {
    const { audio, context } = await createAudio();
    await audio.setPaused(true);
    audio.reward({ id: 'paused-ten', variant: 2, correctCount: 10, milestone: true });
    await settle();
    assert.equal(context.state, 'suspended');
    assert.equal(context.sources.length, 0);
    await audio.setPaused(false);
    await settle();
    assert.deepEqual(context.sources.map(source => source.buffer.name), ['cheer-1', 'spell']);
    await audio.setPaused(false);
    await audio.setPaused(true);
    await audio.setPaused(false);
    await settle();
    assert.equal(context.sources.length, 2);
});

test('a hidden tab suspends music and retains a reward until visible resume', async () => {
    const { audio, context } = await createAudio({ music: true });
    const music = context.sources[0];
    document.hidden = true;
    await audio.setPaused(true);
    audio.reward({ id: 'hidden-answer', variant: 1, correctCount: 3 });
    assert.equal(context.suspends, 1);
    assert.equal(context.state, 'suspended');
    assert.equal(music.stopped, 0);
    assert.equal(context.sources.length, 1);
    document.hidden = false;
    await audio.setPaused(false);
    await settle();
    assert.equal(context.resumes, 2);
    assert.equal(context.sources.length, 2);
    assert.equal(context.sources[1].buffer.name, 'cheer-1');
    assert.equal(context.sources.filter(source => source.buffer.name === 'music').length, 1);
});

test('muting while paused removes queued celebration sounds', async () => {
    const { audio, context } = await createAudio();
    await audio.setPaused(true);
    audio.reward({ id: 'queued-ten', correctCount: 10, milestone: true });
    audio.setEffects(false);
    audio.setEffects(true);
    await audio.setPaused(false);
    await settle();
    assert.equal(context.sources.length, 0);
});

test('restart cancels an effect still loading and clears paused rewards', async () => {
    let resolveCheer;
    const defaultFetch = fetch;
    installGlobal('fetch', path => path.endsWith('/cheer-1.wav')
        ? new Promise(resolve => { resolveCheer = resolve; })
        : defaultFetch(path));
    const { audio, context } = await createAudio({ music: true });
    audio.reward({ id: 'old-flight', variant: 0, correctCount: 1 });
    await audio.setPaused(true);
    audio.reward({ id: 'old-paused-flight', correctCount: 10, milestone: true });
    audio.stopEffects();
    resolveCheer(responseFor('cheer-1'));
    await audio.setPaused(false);
    await settle();
    assert.deepEqual(context.sources.map(source => source.buffer.name), ['music']);
    assert.equal(context.sources[0].stopped, 0);
    audio.reward({ id: 'new-flight', variant: 1, correctCount: 1 });
    await settle();
    assert.deepEqual(context.sources.map(source => source.buffer.name), ['music', 'cheer-5']);
});

test('music switch keeps one quiet loop and stops it immediately when disabled', async () => {
    const { audio, context } = await createAudio();
    audio.setMusic(true);
    audio.setMusic(true);
    await settle();
    const music = context.sources[0];
    assert.equal(context.sources.length, 1);
    assert.equal(music.loop, true);
    assert.ok(music.connectedTo.gain.value < 0.25);
    audio.setMusic(false);
    assert.equal(music.stopped, 1);
    assert.equal(audio.musicSource, null);
    audio.reward({ id: 'effects-still-on', variant: 0, correctCount: 1 });
    await settle();
    assert.equal(context.sources.at(-1).buffer.name, 'cheer-1');
});

test('boost is a short bounded effect and respects pause', async () => {
    const { audio, context } = await createAudio();
    audio.boost();
    assert.equal(context.oscillators.length, 1);
    const boost = context.oscillators[0];
    assert.equal(boost.started, 1);
    assert.ok(boost.stoppedAt - boost.startedAt <= 0.31);
    await audio.setPaused(true);
    audio.boost();
    assert.equal(context.oscillators.length, 1);
    audio.stopEffects();
    await settle();
    assert.equal(audio.sources.size, 0);
});

test('unavailable browser audio and missing assets never interrupt the game', async () => {
    installGlobal('window', {});
    const unavailable = new FlightAudio();
    await unavailable.unlock();
    unavailable.reward({ correctCount: 10, milestone: true });
    unavailable.boost();
    assert.equal(unavailable.context, null);
    installGlobal('window', { AudioContext: AudioContextMock });
    installGlobal('fetch', async () => ({ ok: false }));
    const { audio, context } = await createAudio({ music: true });
    audio.reward({ correctCount: 10, milestone: true });
    await settle();
    assert.equal(context.sources.length, 0);
});
