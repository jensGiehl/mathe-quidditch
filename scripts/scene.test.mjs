import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { QuidditchScene } from '../src/main/resources/static/js/scene.js';

const previousGlobals = new Map();
const installGlobal = (name, value) => {
    previousGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
};

let frameSequence = 0;
installGlobal('window', { devicePixelRatio: 3, matchMedia: () => ({ matches: false }) });
installGlobal('document', { hidden: false });
installGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
});
installGlobal('Image', class {
    set src(value) { this.source = value; }
});
installGlobal('requestAnimationFrame', () => ++frameSequence);
installGlobal('cancelAnimationFrame', () => {});

after(() => {
    for (const [name, descriptor] of previousGlobals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
    }
});

function createScene({ width = 850, height = 580, render = false } = {}) {
    const calls = [];
    const gradient = { addColorStop() {} };
    const context = new Proxy({}, {
        get(target, property) {
            if (property in target) return target[property];
            if (property === 'createRadialGradient' || property === 'createLinearGradient') return () => gradient;
            return (...args) => {
                for (const argument of args) {
                    if (typeof argument === 'number') assert.ok(Number.isFinite(argument), `${String(property)} received a finite coordinate`);
                }
                if (property === 'fillText') calls.push(args);
            };
        },
        set(target, property, value) {
            target[property] = value;
            return true;
        }
    });
    const canvas = {
        getContext: () => context,
        getBoundingClientRect: () => ({ width, height })
    };
    const scene = new QuidditchScene(canvas);
    if (!render) scene.draw = () => {};
    scene.setState({ phase: 'playing', answers: [12, 18, 24], lane: 1 });
    let timestamp = 1000;
    scene.frame(timestamp);
    return {
        scene,
        canvas,
        calls,
        advance(seconds) {
            const frames = Math.ceil(seconds / 0.04);
            for (let frame = 0; frame < frames; frame++) {
                timestamp += seconds / frames * 1000;
                scene.frame(timestamp);
            }
        }
    };
}

test('one accepted answer produces one reward even when its response is repeated after the effect ended', () => {
    const { scene, advance } = createScene();
    try {
        scene.reward({ id: 'flight-4:answer-10', correctCount: 10, milestone: true });
        assert.equal(scene.rewards.length, 1);
        assert.equal(scene.rewards[0].milestone, true);
        const originalStart = scene.rewards[0].start;
        advance(0.45);
        scene.reward({ id: 'flight-4:answer-10', correctCount: 10, milestone: true });
        assert.equal(scene.rewards.length, 1);
        assert.equal(scene.rewards[0].start, originalStart);
        assert.equal(scene.cheerStarted, originalStart);
        advance(2);
        assert.equal(scene.rewards.length, 0);
        scene.reward({ id: 'flight-4:answer-10', correctCount: 10, milestone: true });
        assert.equal(scene.rewards.length, 0);
        scene.reward({ id: 'flight-4:answer-11', correctCount: 11 });
        assert.equal(scene.rewards.length, 1);
        assert.equal(scene.rewards[0].milestone, false);
    } finally {
        scene.destroy();
    }
});

test('pause and hidden tabs freeze reward, crowd and landing time without catching up on resume', () => {
    const { scene, advance } = createScene();
    try {
        scene.reward({ id: 'answer-20', correctCount: 20, milestone: true });
        scene.land();
        advance(0.35);
        const elapsed = scene.time;
        const rewardAge = elapsed - scene.rewards[0].start;
        const landingAge = elapsed - scene.landingStarted;
        scene.setPaused(true);
        advance(12);
        assert.equal(scene.time, elapsed);
        assert.equal(scene.time - scene.rewards[0].start, rewardAge);
        assert.equal(scene.time - scene.landingStarted, landingAge);
        assert.equal(scene.time - scene.cheerStarted, rewardAge);
        scene.setPaused(false);
        document.hidden = true;
        advance(8);
        assert.equal(scene.time, elapsed);
        document.hidden = false;
        advance(0.04);
        assert.ok(scene.time - elapsed < 0.05);
        assert.equal(scene.rewards.length, 1);
        advance(0.3);
        assert.ok(scene.time > elapsed + 0.25);
        assert.equal(scene.rewards.length, 1);
    } finally {
        document.hidden = false;
        scene.destroy();
    }
});

test('a new flight discards its predecessor effects and permits the same answer identifier', () => {
    const { scene } = createScene();
    try {
        scene.reward({ id: 'answer-10', correctCount: 10, milestone: true });
        scene.land();
        scene.setState({ phase: 'lobby' });
        assert.equal(scene.rewards.length, 0);
        assert.equal(scene.rewardIds.size, 0);
        assert.ok(scene.cheerStarted < scene.time - 2);
        assert.ok(scene.landingStarted < scene.time - 2);
        scene.setState({ phase: 'playing' });
        scene.reward({ id: 'answer-10', correctCount: 10, milestone: true });
        assert.equal(scene.rewards.length, 1);
        scene.setState({ phase: 'finished' });
        scene.setState({ phase: 'playing' });
        assert.equal(scene.rewards.length, 0);
        scene.reward({ id: 'answer-10', correctCount: 10, milestone: true });
        assert.equal(scene.rewards.length, 1);
    } finally {
        scene.destroy();
    }
});

test('all four selectable house colors use distinct matching character palettes', () => {
    const { scene } = createScene();
    try {
        const colors = new Set();
        for (const [selection, name] of [['red', 'gryffindor'], ['green', 'slytherin'], ['blue', 'ravenclaw'], ['yellow', 'hufflepuff']]) {
            scene.setState({ house: selection });
            const selectedPalette = scene.palette;
            scene.setState({ house: name });
            assert.deepEqual(selectedPalette, scene.palette);
            colors.add(selectedPalette.primary);
        }
        assert.equal(colors.size, 4);
    } finally {
        scene.destroy();
    }
});

test('every staggered crowd group returns to idle before the next question starts', () => {
    const { scene } = createScene();
    try {
        let drawing = [];
        for (const method of ['line', 'ellipse', 'path']) scene[method] = (...args) => drawing.push([method, ...args]);
        const render = (time, cheerStarted, seed) => {
            scene.time = time;
            scene.cheerStarted = cheerStarted;
            drawing = [];
            scene.drawSpectator(50, 100, 4, seed);
            return drawing;
        };
        for (let group = 0; group < 7; group++) {
            assert.notDeepEqual(render(0.4, 0, group), render(0.4, -10, group));
            assert.deepEqual(render(1.2, 0, group), render(1.2, -10, group));
        }
    } finally {
        scene.destroy();
    }
});

test('normal and reduced movement render finite coordinates in all phases at phone and desktop sizes', () => {
    for (const dimensions of [{ width: 360, height: 470 }, { width: 850, height: 580 }]) {
        const { scene, calls, canvas, advance } = createScene({ ...dimensions, render: true });
        try {
            assert.equal(canvas.width, Math.round(dimensions.width * 1.75));
            for (const reducedMotion of [false, true]) {
                scene.setReducedMotion(reducedMotion);
                for (const phase of ['lobby', 'playing', 'reward', 'paused', 'finished']) {
                    scene.setState({ phase, lane: 0, progress: 0.9, boost: true, house: 'ravenclaw', answers: [1000, 999, 1] });
                    scene.draw();
                }
                for (let milestone = 1; milestone <= 3; milestone++) {
                    scene.setState({ phase: 'reward', lane: milestone - 1 });
                    scene.reward({ id: `${reducedMotion}:${milestone}`, correctCount: milestone * 10 });
                    advance(0.28);
                    scene.draw();
                }
                scene.land();
                advance(0.16);
                scene.setState({ phase: 'finished' });
                scene.draw();
            }
            assert.ok(calls.some(([text]) => text === '1000'));
            assert.ok(calls.some(([text]) => text === '999'));
            assert.ok(calls.some(([text]) => text === '1'));
        } finally {
            scene.destroy();
        }
    }
});
