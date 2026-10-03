(function() {
    'use strict';

    // This MAIN-world bridge only uses editor APIs. Keys, prompts and requests to
    // OpenAI stay in the isolated extension world and the service worker.
    const REQUEST_EVENT = 'duzelt-ai:editor-request';
    const RESPONSE_EVENT = 'duzelt-ai:editor-response';
    const EDITOR_ATTRIBUTE = 'data-duzelt-editor';
    const TARGET_ATTRIBUTE = 'data-duzelt-toolbar';
    const MAX_HTML_LENGTH = 1000000;
    const identifiers = new WeakMap();
    const watchedEditors = new WeakSet();

    function watch(editor, eventNames) {
        if (!editor || watchedEditors.has(editor) || typeof editor.on !== 'function') return;
        watchedEditors.add(editor);
        eventNames.forEach(name => editor.on(name, () => {
            document.dispatchEvent(new CustomEvent('duzelt-ai:editors-ready'));
        }));
    }

    function identify(container, target, type, editor, read, write) {
        if (!container || !target || !container.isConnected || !editor) return null;
        let id = identifiers.get(editor);
        if (!id) {
            id = crypto.randomUUID();
            identifiers.set(editor, id);
        }
        container.setAttribute(EDITOR_ATTRIBUTE, id);
        target.setAttribute(TARGET_ATTRIBUTE, id);
        return { id, type, container, read, write };
    }

    function findEditors() {
        const entries = [];
        const ck4 = window.CKEDITOR;
        if (ck4 && ck4.instances) {
            Object.values(ck4.instances).forEach(editor => {
                watch(editor, ['instanceReady', 'mode', 'readOnly', 'destroy']);
                if (editor.status !== 'ready' || editor.mode !== 'wysiwyg' || editor.readOnly) return;
                const container = editor.container && editor.container.$;
                entries.push(identify(container, container && (container.querySelector('.cke_top') || container),
                    'ckeditor4', editor, () => editor.getData(), html => new Promise(resolve => {
                        editor.fire('saveSnapshot');
                        editor.setData(html, { callback: () => {
                            editor.updateElement();
                            editor.fire('change');
                            editor.fire('saveSnapshot');
                            resolve();
                        } });
                    })));
            });
        }

        document.querySelectorAll('.ck-editor__editable[contenteditable="true"]').forEach(editable => {
            const editor = editable.ckeditorInstance;
            watch(editor, ['change:state', 'change:isReadOnly']);
            if (!editor || editor.state !== 'ready' || editor.isReadOnly || typeof editor.getData !== 'function') return;
            // Multi-root/collaborative integrations need their own acceptance test.
            if (Array.from(editor.model.document.getRootNames()).length !== 1) return;
            const container = editable.closest('.ck-editor') || editable.parentElement;
            const target = editor.ui.view.toolbar && editor.ui.view.toolbar.element;
            entries.push(identify(container, target || container, 'ckeditor5', editor,
                () => editor.getData(), html => editor.data.set(html, { batchType: { isUndoable: true } })));
        });

        const jquery = window.jQuery;
        if (jquery && jquery.fn && jquery.fn.summernote) {
            document.querySelectorAll('.note-editor').forEach(container => {
                const source = container.previousElementSibling;
                if (!source) return;
                const context = jquery(source).data('summernote');
                if (!context || context.layoutInfo.editor[0] !== container || jquery(source).summernote('isDisabled')) return;
                if (jquery(source).summernote('codeview.isActivated')) return;
                entries.push(identify(container, container.querySelector('.note-toolbar') || container,
                    'summernote', context, () => jquery(source).summernote('code'), html => {
                        context.invoke('editor.afterCommand', true);
                        context.invoke('editor.beforeCommand');
                        jquery(source).summernote('code', html);
                        context.invoke('editor.afterCommand');
                        jquery(source).trigger('change');
                    }));
            });
        }

        const tiny = window.tinymce;
        if (tiny && typeof tiny.get === 'function') {
            tiny.get().forEach(editor => {
                watch(editor, ['init', 'remove', 'SwitchMode']);
                if (!editor.initialized || editor.mode.isReadOnly()) return;
                const container = editor.getContainer();
                entries.push(identify(container, container && (container.querySelector('.tox-toolbar__primary, .mce-toolbar-grp') || container),
                    'tinymce', editor, () => editor.getContent(), html => {
                        editor.undoManager.transact(() => editor.setContent(html));
                        editor.save();
                        editor.dispatch('change');
                        editor.dispatch('input');
                    }));
            });
        }

        document.querySelectorAll('.ql-container').forEach(container => {
            const editor = window.Quill && typeof window.Quill.find === 'function'
                ? window.Quill.find(container) : container.__quill;
            if (!editor || typeof editor.getContents !== 'function' || !editor.isEnabled()) return;
            const toolbar = editor.getModule('toolbar');
            entries.push(identify(container, toolbar && toolbar.container || container, 'quill', editor,
                () => typeof editor.getSemanticHTML === 'function' ? editor.getSemanticHTML() : editor.root.innerHTML,
                html => {
                    const delta = editor.clipboard.convert(editor.constructor.version.startsWith('2.') ? { html } : html);
                    editor.history.cutoff();
                    editor.setContents(delta, 'user');
                    editor.history.cutoff();
                }));
        });
        return entries.filter(Boolean);
    }

    document.addEventListener(REQUEST_EVENT, async event => {
        let request;
        try {
            if (typeof event.detail !== 'string' || event.detail.length > MAX_HTML_LENGTH * 3) return;
            request = JSON.parse(event.detail);
            if (typeof request.requestId !== 'string' || request.requestId.length > 100) return;
            if (!['discover', 'read', 'write'].includes(request.action)) return;
            const entries = findEditors();
            let result;
            if (request.action === 'discover') {
                result = entries.map(({ id, type }) => ({ id, type }));
            } else {
                const entry = entries.find(item => item.id === request.editorId);
                if (!entry) throw new Error('unavailable');
                if (request.action === 'read') {
                    result = { html: entry.read() };
                } else {
                    if (typeof request.html !== 'string' || request.html.length > MAX_HTML_LENGTH ||
                        typeof request.expectedHTML !== 'string' || request.expectedHTML.length > MAX_HTML_LENGTH) {
                        throw new Error('invalid');
                    }
                    // Check in the same world and turn as the write: edits made
                    // while the API request or preview was open cannot be lost.
                    if (entry.read() !== request.expectedHTML) throw new Error('changed');
                    await entry.write(request.html);
                    result = { applied: true };
                }
            }
            document.dispatchEvent(new CustomEvent(RESPONSE_EVENT, {
                detail: JSON.stringify({ requestId: request.requestId, result })
            }));
        } catch (error) {
            // Never include editor contents or arbitrary library error messages.
            const code = error.message === 'changed' ? 'changed' : 'unavailable';
            document.dispatchEvent(new CustomEvent(RESPONSE_EVENT, {
                detail: JSON.stringify({ requestId: request && request.requestId, error: code })
            }));
        }
    });
})();
