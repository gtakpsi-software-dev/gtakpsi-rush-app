import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../src/features/voting/brother/SplitText.tsx", import.meta.url));

async function setup({ splitError = false, emptyTargets = false } = {}) {
    const calls = [];
    const element = { style: {} };
    const refs = [{ current: element }, { current: null }];
    const targets = {
        lines: [{ style: {} }],
        words: [{ style: {} }],
        chars: [{ style: {} }, { style: {} }],
    };
    let effect;
    let timelineOptions;
    let splitterOptions;

    class Splitter {
        constructor(_element, options) {
            if (splitError) throw new Error("split failed");
            splitterOptions = options;
            this.lines = emptyTargets ? [] : targets.lines;
            this.words = emptyTargets ? [] : targets.words;
            this.chars = emptyTargets ? [] : targets.chars;
        }

        revert() { calls.push("revert"); }
    }

    const timeline = {
        set: (items, options) => calls.push(["timeline.set", items, options]),
        to: (items, options) => calls.push(["timeline.to", items, options]),
        kill: () => calls.push("timeline.kill"),
    };
    const gsap = {
        registerPlugin() {},
        timeline: (options) => {
            timelineOptions = options;
            return timeline;
        },
        set: (items, options) => calls.push(["gsap.set", items, options]),
        killTweensOf: (items) => calls.push(["killTweens", items]),
    };
    const Component = await loadTsxComponent(componentPath, {
        react: {
            useRef: () => refs.shift(),
            useEffect: (callback) => { effect = callback; },
        },
        gsap: { gsap },
        "gsap/ScrollTrigger": { ScrollTrigger: class ScrollTrigger {} },
        "gsap/SplitText": { SplitText: Splitter },
    }, {
        window: {},
        console: {
            error: (...args) => calls.push(["error", ...args]),
            warn: (...args) => calls.push(["warn", ...args]),
        },
    });

    return {
        calls, element, targets,
        render: (props) => {
            const view = Component(props);
            return { view, cleanup: effect?.() };
        },
        get timelineOptions() { return timelineOptions; },
        get splitterOptions() { return splitterOptions; },
    };
}

test("character animation retains scroll start, tween settings, callback, and cleanup", async () => {
    const state = await setup();
    let completed = 0;
    const { view, cleanup } = state.render({
        text: "Hello", className: "headline",
        onLetterAnimationComplete: () => { completed += 1; },
    });

    assert.equal(view.type, "p");
    assert.equal(view.props.children, "Hello");
    assert.equal(view.props.className, "split-parent overflow-hidden inline-block whitespace-normal headline");
    assert.equal(view.props.style.textAlign, "center");
    assert.equal(state.splitterOptions.type, "chars");
    assert.equal(state.splitterOptions.absolute, false);
    assert.equal(state.timelineOptions.scrollTrigger.start, "top 90%-=100px");
    assert.equal(state.timelineOptions.scrollTrigger.toggleActions, "play none none none");
    assert.equal(state.timelineOptions.scrollTrigger.once, true);
    assert.equal(state.calls[0][0], "timeline.set");
    assert.equal(state.calls[1][0], "timeline.to");
    assert.equal(state.calls[1][2].duration, 0.6);
    assert.equal(state.calls[1][2].stagger, 0.1);
    assert.equal(state.calls[0][1], state.targets.chars);
    assert.deepEqual(state.targets.chars.map((target) => target.style.willChange), [
        "transform, opacity", "transform, opacity",
    ]);

    const trigger = { kill: () => state.calls.push("trigger.kill") };
    state.timelineOptions.scrollTrigger.onToggle(trigger);
    state.timelineOptions.onComplete();
    assert.equal(completed, 1);
    assert.equal(state.calls.at(-1)[0], "gsap.set");
    cleanup();
    assert.deepEqual(state.calls.slice(-5).map((call) => Array.isArray(call) ? call[0] : call), [
        "gsap.set", "timeline.kill", "trigger.kill", "killTweens", "revert",
    ]);
});

test("line splitting keeps absolute positioning and numeric margin units", async () => {
    const state = await setup();
    state.render({ text: "Two lines", splitType: "lines", threshold: 0.25, rootMargin: "1.5em" });

    assert.equal(state.element.style.position, "relative");
    assert.equal(state.splitterOptions.absolute, true);
    assert.equal(state.calls[0][1], state.targets.lines);
    assert.equal(state.timelineOptions.scrollTrigger.start, "top 75%+=1.5em");

    const words = await setup();
    words.render({ text: "Two words", splitType: "words" });
    assert.equal(words.calls[0][1], words.targets.words);

    const wordsAndChars = await setup();
    wordsAndChars.render({ text: "Two words", splitType: "words, chars" });
    assert.equal(wordsAndChars.calls[0][1], wordsAndChars.targets.chars);
});

test("failed or empty splitting never creates a timeline", async () => {
    const failed = await setup({ splitError: true });
    const failure = failed.render({ text: "Hello" });
    assert.equal(failure.cleanup, undefined);
    assert.equal(failed.timelineOptions, undefined);
    assert.equal(failed.calls[0][0], "error");

    const empty = await setup({ emptyTargets: true });
    const noTargets = empty.render({ text: "Hello" });
    assert.equal(noTargets.cleanup, undefined);
    assert.equal(empty.timelineOptions, undefined);
    assert.deepEqual(empty.calls.map((call) => Array.isArray(call) ? call[0] : call), [
        "warn", "revert",
    ]);
});
