import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../content/content.js', import.meta.url), 'utf8');
function fixture(lastError) {
    let initialRead;
    let onChanged;
    let observerCount = 0;
    let pendingTimers = 0;
    const context = {
        document: { addEventListener() {}, removeEventListener() {}, documentElement:{} },
        chrome: { runtime: { lastError }, storage: {
            sync: { get(keys, callback) { initialRead = callback; } },
            onChanged: { addListener(callback) { onChanged = callback; } }
        } },
        MutationObserver: class { constructor() { observerCount++; } observe() {} disconnect() {} },
        setTimeout() { pendingTimers++; return pendingTimers; }, clearTimeout() {}
    };
    vm.runInNewContext(source, context);
    return { read:result=>initialRead(result), change:value=>onChanged({ai_corrector_enabled:{newValue:value}},'sync'), observers:()=>observerCount, timers:()=>pendingTimers };
}
const unavailable = fixture({ message: 'Extension context invalidated.' });
unavailable.read(undefined);
assert.equal(unavailable.observers(), 0);
const undefinedResult = fixture();
undefinedResult.read(undefined);
assert.equal(undefinedResult.observers(), 0);
const delayedRead = fixture();
delayedRead.change(false);
delayedRead.read({ ai_corrector_enabled: true });
assert.equal(delayedRead.observers(), 0);
const enabled = fixture();
enabled.read({ ai_corrector_enabled: true });
assert.equal(enabled.observers(), 1);
enabled.change(true);
assert.equal(enabled.observers(), 1);
const toggled = fixture();
toggled.read({ ai_corrector_enabled: false });
toggled.change(true);
assert.equal(toggled.observers(), 1);
toggled.change(false);
toggled.change(true);
assert.equal(toggled.observers(), 2);
console.log('Editor bootstrap: 7 assertions passed (missing storage, storage error, delayed snapshot, observer deduplication and toggles).');
