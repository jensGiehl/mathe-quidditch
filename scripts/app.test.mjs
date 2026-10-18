import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const app = await readFile(new URL('../src/main/resources/static/js/app.js', import.meta.url), 'utf8');
const snapshotHandler = app.slice(app.indexOf('function applySnapshot('), app.indexOf('async function startGame('));

function flight() {
    const state = { snapshot: null, resultAt: 0, resultShown: false, desiredPause: false };
    const sounds = [];
    const node = () => ({ replaceChildren() {}, append() {}, classList: { toggle() {} } });
    const context = vm.createContext({
        state,
        elements: { score: node(), distance: node(), multiplier: node() },
        numberFormat: new Intl.NumberFormat('de-DE'),
        document: { createTextNode: text => ({ text }), createElement: node },
        performance: { now: () => 1000 },
        reducedMotion: { matches: false },
        scene: { land() {} },
        audio: { stopEffects: () => sounds.push('stop'), wrongAnswer: () => sounds.push('ohhh') },
        setPhase: phase => { state.phase = phase; }
    });
    vm.runInContext(snapshotHandler, context);
    return {
        state,
        sounds,
        apply: snapshot => context.applySnapshot(snapshot),
        restart() {
            state.snapshot = null;
            state.resultAt = 0;
            state.resultShown = false;
        }
    };
}

test('a failed answer plays one audience reaction after clearing previous effects', () => {
    const game = flight();
    const snapshot = { id: 'first-flight', status: 'FINISHED', correct: false };
    game.apply(snapshot);
    assert.equal(game.state.phase, 'landing');
    assert.deepEqual(game.sounds, ['stop', 'ohhh']);
    game.apply(snapshot);
    game.state.resultShown = true;
    game.apply(snapshot);
    assert.deepEqual(game.sounds, ['stop', 'ohhh']);
});

test('the next flight can play its own failed-answer reaction', () => {
    const game = flight();
    game.apply({ id: 'first-flight', status: 'FINISHED', correct: false });
    game.restart();
    game.apply({ id: 'next-flight', status: 'FINISHED', correct: false });
    assert.deepEqual(game.sounds, ['stop', 'ohhh', 'stop', 'ohhh']);
});

test('finishing without a failed answer stays quiet', () => {
    for (const correct of [null, undefined, true]) {
        const game = flight();
        game.apply({ id: 'completed-flight', status: 'FINISHED', correct });
        assert.equal(game.state.phase, 'landing');
        assert.deepEqual(game.sounds, ['stop']);
    }
});

test('a stale result from another flight never plays an audience reaction', () => {
    const game = flight();
    game.state.snapshot = { id: 'active-flight' };
    game.apply({ id: 'previous-flight', status: 'FINISHED', correct: false });
    assert.deepEqual(game.sounds, []);
    assert.equal(game.state.resultAt, 0);
});
