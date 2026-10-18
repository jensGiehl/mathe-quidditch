import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const app = await readFile(new URL('../src/main/resources/static/js/app.js', import.meta.url), 'utf8');
const selectLane = app.slice(app.indexOf('function selectLane('), app.indexOf('async function boost('));
const keyboard = app.slice(app.indexOf("document.addEventListener('keydown'"), app.indexOf("document.addEventListener('visibilitychange'"));

function controls(initial = {}) {
    class Input {}
    class Textarea {}
    class Select {}
    const state = { phase: 'playing', lane: 1, desiredPause: false, submission: null, ...initial };
    const pauses = [];
    let boosts = 0;
    let handler;
    const context = vm.createContext({
        state,
        HTMLInputElement: Input,
        HTMLTextAreaElement: Textarea,
        HTMLSelectElement: Select,
        document: { addEventListener: (type, listener) => { assert.equal(type, 'keydown'); handler = listener; } },
        active: () => ['playing', 'paused', 'reward'].includes(state.phase),
        setPaused: paused => pauses.push(paused),
        updateControls() {},
        boost: () => { boosts += 1; }
    });
    vm.runInContext(selectLane + keyboard, context);
    return {
        state,
        pauses,
        get boosts() { return boosts; },
        fields: [new Input(), new Textarea(), new Select(), { isContentEditable: true }],
        press(key, overrides = {}) {
            let prevented = false;
            handler({ key, target: {}, preventDefault: () => { prevented = true; }, ...overrides });
            return prevented;
        }
    };
}

test('WASD and arrow keys steer the same three lanes and support uppercase letters', () => {
    const game = controls();
    for (const [key, expected] of [['a', 0], ['d', 1], ['D', 2], ['A', 1], ['ArrowLeft', 0], ['ArrowRight', 1], ['ArrowRight', 2], ['s', 1], ['a', 0], ['S', 1], ['d', 2], ['ArrowDown', 1]]) {
        assert.equal(game.press(key), true);
        assert.equal(game.state.lane, expected, key);
    }
    for (const key of ['w', 'W', 'ArrowUp']) assert.equal(game.press(key), true);
    assert.equal(game.boosts, 3);
});

test('relative lane selection stays inside the outer lanes', () => {
    const game = controls();
    for (let index = 0; index < 4; index++) game.press('a');
    assert.equal(game.state.lane, 0);
    for (let index = 0; index < 5; index++) game.press('d');
    assert.equal(game.state.lane, 2);
});

test('typing or editing a selection never activates a flight shortcut', () => {
    const game = controls();
    for (const target of game.fields) {
        for (const key of ['a', 'd', 's', 'w', 'P', 'Escape', 'ArrowLeft', 'ArrowUp']) {
            assert.equal(game.press(key, { target }), false);
            assert.equal(game.state.lane, 1);
        }
    }
    assert.equal(game.boosts, 0);
    assert.deepEqual(game.pauses, []);
});

test('browser modifiers and held keys leave game actions alone', () => {
    const game = controls();
    for (const flag of ['ctrlKey', 'metaKey', 'altKey', 'repeat']) {
        for (const key of ['a', 'd', 's', 'w', 'P', 'Escape', 'ArrowRight']) {
            assert.equal(game.press(key, { [flag]: true }), false);
        }
    }
    assert.equal(game.state.lane, 1);
    assert.equal(game.boosts, 0);
    assert.deepEqual(game.pauses, []);
});

test('flight shortcuts are inactive before, after and between questions', () => {
    for (const phase of ['lobby', 'reward', 'paused', 'landing', 'finished']) {
        const game = controls({ phase });
        for (const key of ['a', 'd', 's', 'w', 'ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp']) {
            assert.equal(game.press(key), false);
        }
        assert.equal(game.state.lane, 1);
        assert.equal(game.boosts, 0);
    }
});

test('a pending answer or pause locks lane selection', () => {
    for (const lock of [{ desiredPause: true }, { submission: { lane: 1 } }]) {
        const game = controls(lock);
        for (const key of ['a', 'd', 's', 'ArrowLeft', 'ArrowRight', 'ArrowDown']) game.press(key);
        assert.equal(game.state.lane, 1);
    }
});

test('P and Escape keep their pause and resume behavior', () => {
    for (const key of ['p', 'P', 'Escape']) {
        const game = controls();
        assert.equal(game.press(key), true);
        assert.deepEqual(game.pauses, [true]);
        game.state.phase = 'paused';
        assert.equal(game.press(key), true);
        assert.deepEqual(game.pauses, [true, false]);
    }
    const lobby = controls({ phase: 'lobby' });
    assert.equal(lobby.press('p'), false);
    assert.equal(lobby.press('Escape'), false);
    assert.deepEqual(lobby.pauses, []);
});

test('unrelated keys retain their browser behavior', () => {
    const game = controls();
    for (const key of ['Tab', 'Enter', ' ', 'x', '1']) assert.equal(game.press(key), false);
    assert.equal(game.state.lane, 1);
    assert.equal(game.boosts, 0);
    assert.deepEqual(game.pauses, []);
});
