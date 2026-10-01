import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadTsxModule } from './helpers/loadTsxComponent.js';

const hookPath = fileURLToPath(new URL('../src/features/pis/usePisCollaborationState.js', import.meta.url));

test('PIS collaboration retains room identity, connection request, and update effect order', async () => {
    const calls = [];
    const effects = [];
    const currentUser = { id: 'brother' };
    const documentState = { brotherA: 'Ada' };
    const remoteUpdates = [{ field: 'answer', value: 'Yes' }];
    const setters = {
        setBrotherA: () => {}, setBrotherB: () => {}, setAnswers: () => {},
    };
    let collaboration = {
        isConnected: false,
        documentState,
        remoteUpdates,
        requestDocumentState: () => calls.push(['request']),
    };
    const { usePisCollaborationState } = await loadTsxModule(hookPath, {
        react: { useEffect: (effect, dependencies) => effects.push({ effect, dependencies }) },
        './useCollaboration': {
            useCollaboration: (roomId, user) => {
                calls.push(['connect', roomId, user]);
                return collaboration;
            },
        },
        './collaborationState': {
            applyDocumentState: (state, inputs) => calls.push(['document', state, inputs]),
            applyRemoteUpdates: (updates, inputs) => calls.push(['remote', updates, inputs]),
        },
    });

    const result = usePisCollaborationState({ gtid: '123', currentUser, ...setters });
    assert.equal(result, collaboration);
    assert.deepEqual(calls[0], ['connect', 'pis-123', currentUser]);
    assert.deepEqual(Array.from(effects[0].dependencies), [false]);
    assert.deepEqual(Array.from(effects[1].dependencies), [documentState]);
    assert.deepEqual(Array.from(effects[2].dependencies), [remoteUpdates]);

    effects[0].effect();
    effects[1].effect();
    effects[2].effect();
    assert.equal(calls.length, 3);
    assert.equal(calls[1][0], 'document');
    assert.equal(calls[1][1], documentState);
    assert.equal(calls[2][0], 'remote');
    assert.equal(calls[2][1], remoteUpdates);
    for (const [, , inputs] of calls.slice(1)) {
        for (const [name, setter] of Object.entries(setters)) {
            assert.equal(inputs[name], setter);
        }
    }

    collaboration = { ...collaboration, isConnected: true };
    assert.equal(usePisCollaborationState({ gtid: '123', currentUser, ...setters }), collaboration);
    assert.deepEqual(Array.from(effects[3].dependencies), [true]);
    effects[3].effect();
    assert.deepEqual(calls.at(-1), ['request']);
});
