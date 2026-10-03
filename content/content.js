(function() {
    'use strict';

    const ENABLED_KEY = 'ai_corrector_enabled';
    const BUTTON_CLASS = 'ai-text-corrector-button';
    const MODAL_ID = 'ai-text-corrector-modal';
    const EDITOR_SELECTOR = '.cke, .ck-editor, .ck-editor__editable, .note-editor, .tox-tinymce, .mce-tinymce, .ql-container, .ql-toolbar';
    const MAX_TEXT_LENGTH = 100000;
    const entries = new Map();
    const pendingBridge = new Map();
    let isEnabled = false;
    let domObserver;
    let discoveryTimer;
    let discovering = false;
    let activeOperation;
    let closeModal;
    let storageGeneration = 0;

    document.addEventListener('duzelt-ai:editor-response', event => {
        if (typeof event.detail !== 'string') return;
        let response;
        try { response = JSON.parse(event.detail); } catch { return; }
        const pending = pendingBridge.get(response.requestId);
        if (!pending) return;
        pendingBridge.delete(response.requestId);
        clearTimeout(pending.timer);
        if (response.error) {
            pending.reject(new Error(response.error === 'changed'
                ? 'Metin düzeltme sırasında değişti. Yeni metin korunuyor; yeniden Düzelt seçeneğini kullanın.'
                : 'Editöre erişilemiyor. Editörün açık ve düzenlenebilir olduğundan emin olun.'));
        } else {
            pending.resolve(response.result);
        }
    });

    function editorRequest(action, data = {}) {
        return new Promise((resolve, reject) => {
            const requestId = crypto.randomUUID();
            const timer = setTimeout(() => {
                pendingBridge.delete(requestId);
                reject(new Error('Editör yanıt vermedi. Sayfayı yenileyip yeniden deneyin.'));
            }, 5000);
            pendingBridge.set(requestId, { resolve, reject, timer });
            document.dispatchEvent(new CustomEvent('duzelt-ai:editor-request', {
                detail: JSON.stringify({ requestId, action, ...data })
            }));
        });
    }

    async function discoverEditors() {
        if (!isEnabled || discovering) return;
        discovering = true;
        try {
            const discovered = await editorRequest('discover');
            if (!isEnabled || !Array.isArray(discovered)) return;
            const liveIds = new Set();
            discovered.forEach(item => {
                if (!item || !/^[a-z0-9-]{36}$/i.test(item.id)) return;
                const container = document.querySelector(`[data-duzelt-editor="${item.id}"]`);
                const target = document.querySelector(`[data-duzelt-toolbar="${item.id}"]`);
                if (!container || !target) return;
                liveIds.add(item.id);
                let entry = entries.get(item.id);
                if (!entry) {
                    entry = { id: item.id, type: item.type, container, button: createButton(item.id) };
                    entries.set(item.id, entry);
                    entry.button.addEventListener('click', event => {
                        if (event.isTrusted) correctEditor(entry);
                    });
                }
                entry.container = container;
                if (!entry.button.isConnected || entry.button.parentElement !== target) {
                    target.appendChild(entry.button);
                }
            });
            entries.forEach((entry, id) => {
                if (!liveIds.has(id)) {
                    entry.button.remove();
                    entries.delete(id);
                    if (activeOperation && activeOperation.entry === entry) cancelOperation();
                }
            });
        } catch {
            // Unsupported integrations stay unchanged, without repeated alerts.
        } finally {
            discovering = false;
        }
    }

    function createButton(id) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = BUTTON_CLASS;
        button.dataset.aiCorrectorButton = 'true';
        button.dataset.aiFieldId = id;
        button.textContent = 'Düzelt';
        button.title = 'Metni AI ile düzelt ve değişiklikleri incele';
        return button;
    }

    function resetButton(button) {
        button.disabled = false;
        button.textContent = 'Düzelt';
        button.removeAttribute('aria-busy');
    }

    function cancelOperation() {
        if (activeOperation) {
            activeOperation.cancelled = true;
            resetButton(activeOperation.entry.button);
            activeOperation = null;
        }
        if (closeModal) closeModal();
    }

    async function correctEditor(entry) {
        cancelOperation();
        const operation = { entry, cancelled: false };
        activeOperation = operation;
        try {
            const data = await editorRequest('read', { editorId: entry.id });
            if (!isCurrent(operation)) return;
            if (!data || typeof data.html !== 'string' || data.html.length > 1000000) {
                throw new Error('Editör içeriği okunamadı veya çok uzun. Daha kısa bir metinle yeniden deneyin.');
            }
            const documentData = parseSafeHTML(data.html);
            const projection = projectText(documentData.body);
            const original = projection.text;
            if (original.trim().length < 10) throw new Error('Lütfen en az 10 karakter içeren bir metin girin.');
            if (original.length > MAX_TEXT_LENGTH) throw new Error('Metin çok uzun. Lütfen 100.000 karakterden kısa bir metinle deneyin.');
            entry.button.disabled = true;
            entry.button.textContent = 'Düzeltiliyor…';
            entry.button.setAttribute('aria-busy', 'true');
            const corrected = await requestCorrection(original);
            if (!isCurrent(operation)) return;
            const current = await editorRequest('read', { editorId: entry.id });
            if (!isCurrent(operation)) return;
            if (current.html !== data.html) throw new Error('Metin düzeltme sırasında değişti. Yeni metin korunuyor; yeniden Düzelt seçeneğini kullanın.');
            const mapped = mapTextToHTML(documentData, projection, corrected);
            showDiff(operation, original, corrected, data.html, mapped);
        } catch (error) {
            if (isCurrent(operation)) {
                cancelOperation();
                alert(error.message);
            }
        }
    }

    function isCurrent(operation) {
        return isEnabled && !operation.cancelled && activeOperation === operation && operation.entry.container.isConnected;
    }

    function requestCorrection(text) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Düzeltme isteği zaman aşımına uğradı. Lütfen yeniden deneyin.')), 90000);
            chrome.runtime.sendMessage({ action: 'correctText', text }, response => {
                clearTimeout(timer);
                if (chrome.runtime.lastError) {
                    reject(new Error('Eklenti bağlantısı kesildi. Sayfayı yenileyip yeniden deneyin.'));
                } else if (!response || typeof response !== 'object') {
                    reject(new Error('Düzeltme hizmetinden geçerli bir yanıt alınamadı. Lütfen yeniden deneyin.'));
                } else if (response.error) {
                    reject(new Error(typeof response.error === 'string' ? response.error : 'Düzeltme tamamlanamadı.'));
                } else if (typeof response.correctedText !== 'string' || !response.correctedText.trim() || response.correctedText.length > MAX_TEXT_LENGTH) {
                    reject(new Error('Düzeltme hizmeti boş veya geçersiz bir metin döndürdü. Asıl metin korunuyor.'));
                } else {
                    resolve(response.correctedText);
                }
            });
        });
    }

    // Keep the text formatting vocabulary; remove executable elements, event
    // handlers, unsafe URLs and CSS before applying even the original HTML.
    function parseSafeHTML(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const allowedTags = new Set('P DIV SPAN STRONG B EM I U S STRIKE DEL INS A UL OL LI BR BLOCKQUOTE H1 H2 H3 H4 H5 H6 PRE CODE SUB SUP TABLE TBODY THEAD TFOOT TR TD TH HR IMG'.split(' '));
        const forbiddenTags = new Set('SCRIPT STYLE IFRAME OBJECT EMBED SVG MATH FORM INPUT BUTTON TEXTAREA SELECT VIDEO AUDIO CANVAS TEMPLATE'.split(' '));
        const styleProperties = new Set('color background-color font-weight font-style font-size font-family text-decoration text-align line-height margin-left padding-left vertical-align white-space'.split(' '));
        Array.from(doc.body.querySelectorAll('*')).forEach(element => {
            if (forbiddenTags.has(element.tagName)) {
                element.remove();
                return;
            }
            if (!allowedTags.has(element.tagName)) {
                element.replaceWith(...element.childNodes);
                return;
            }
            Array.from(element.attributes).forEach(attribute => {
                const name = attribute.name.toLowerCase();
                const value = attribute.value;
                let allowed = false;
                if (name === 'href' && element.tagName === 'A') allowed = safeURL(value, false);
                if (name === 'src' && element.tagName === 'IMG') allowed = safeURL(value, true);
                if (['title', 'alt', 'lang'].includes(name)) allowed = true;
                if (name === 'dir') allowed = ['ltr', 'rtl', 'auto'].includes(value);
                if (['width', 'height', 'colspan', 'rowspan', 'start'].includes(name)) allowed = /^\d{1,4}$/.test(value);
                if (name === 'data-list') allowed = ['bullet', 'ordered', 'checked', 'unchecked'].includes(value);
                if (name === 'class') allowed = /^(?:ql-(?:align-(?:center|right|justify)|indent-[0-8]|direction-rtl|size-(?:small|large|huge)|font-(?:serif|monospace))(?:\s+|$))+$/.test(value);
                if (name === 'style') {
                    const styles = [];
                    for (const property of element.style) {
                        const styleValue = element.style.getPropertyValue(property);
                        if (styleProperties.has(property) && !/url\s*\(|expression\s*\(|[<>]/i.test(styleValue)) {
                            styles.push(`${property}: ${styleValue}`);
                        }
                    }
                    element.removeAttribute('style');
                    if (styles.length) element.setAttribute('style', styles.join('; '));
                    return;
                }
                if (!allowed) element.removeAttribute(attribute.name);
            });
            if (element.tagName === 'IMG' && !element.hasAttribute('src')) element.remove();
        });
        return doc;
    }

    function safeURL(value, image) {
        const cleaned = value.replace(/[\u0000-\u0020\u007f]/g, '');
        if (image && /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(cleaned)) return true;
        const scheme = cleaned.match(/^([^/:?#]+):/);
        return !scheme || (image ? /^(https?)$/i : /^(https?|mailto|tel)$/i).test(scheme[1]);
    }

    function projectText(root) {
        let text = '';
        const positions = [];
        const textNodes = [];
        const blockTags = new Set('P DIV LI BLOCKQUOTE H1 H2 H3 H4 H5 H6 PRE TR TD TH'.split(' '));
        function append(value, node) {
            text += value;
            for (let index = 0; index < value.length; index++) positions.push(node);
        }
        function visit(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                if (/^[\t\r\n ]*$/.test(node.textContent) && ['BODY', 'UL', 'OL', 'TABLE', 'TBODY', 'THEAD', 'TFOOT', 'TR'].includes(node.parentElement.tagName)) return;
                textNodes.push(node);
                append(node.textContent, node);
                return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            if (node.tagName === 'BR') {
                append('\n', null);
                return;
            }
            if (blockTags.has(node.tagName) && text && !text.endsWith('\n')) append('\n', null);
            const start = text.length;
            Array.from(node.childNodes).forEach(visit);
            if (blockTags.has(node.tagName) && text.length > start && !text.endsWith('\n')) append('\n', null);
        }
        visit(root);
        while (text.endsWith('\n')) {
            text = text.slice(0, -1);
            positions.pop();
        }
        return { text, positions, textNodes };
    }

    function mapTextToHTML(doc, projection, corrected) {
        const outputs = new Map(projection.textNodes.map(node => [node, '']));
        const wordParts = Diff.diffWordsWithSpace(projection.text, corrected);
        const parts = [];
        for (let index = 0; index < wordParts.length; index++) {
            const part = wordParts[index];
            const next = wordParts[index + 1];
            if (part.removed && next && next.added) {
                // Refine replacements to characters so normalizing spaces next
                // to a link does not move the corrected word outside the link.
                const refined = Diff.diffChars(part.value, next.value, { maxEditLength: 2000 });
                if (!refined) return null;
                parts.push(...refined);
                index++;
            } else {
                parts.push(part);
            }
        }
        let offset = 0;
        let structuralChange = false;
        let removedTarget = null;
        for (const part of parts) {
            if (part.added) {
                if (/[\r\n]/.test(part.value)) structuralChange = true;
                let target = removedTarget || projection.positions[offset];
                removedTarget = null;
                if (!target) target = projection.positions[offset - 1];
                if (!target) structuralChange = true;
                if (target) outputs.set(target, outputs.get(target) + part.value);
            } else if (part.removed) {
                removedTarget = projection.positions[offset];
                for (let index = 0; index < part.value.length; index++) {
                    if (projection.positions[offset + index] === null) structuralChange = true;
                }
                offset += part.value.length;
            } else {
                removedTarget = null;
                for (let index = 0; index < part.value.length; index++) {
                    const node = projection.positions[offset++];
                    if (node) outputs.set(node, outputs.get(node) + part.value[index]);
                }
            }
        }
        if (structuralChange) return null;
        outputs.forEach((value, node) => { node.textContent = value; });
        // Reject a mapping that fails to reproduce the exact accepted text.
        return projectText(doc.body).text === corrected ? doc.body.innerHTML : null;
    }

    function plainHTML(text) {
        const root = document.createElement('div');
        text.split('\n').forEach(line => {
            const paragraph = document.createElement('p');
            if (line) paragraph.textContent = line;
            else paragraph.appendChild(document.createElement('br'));
            root.appendChild(paragraph);
        });
        return root.innerHTML;
    }

    function showDiff(operation, original, corrected, expectedHTML, mapped) {
        const modal = document.createElement('div');
        modal.id = MODAL_ID;
        modal.className = 'ai-corrector-modal';
        modal.innerHTML = '<section class="ai-corrector-modal-content" role="dialog" aria-modal="true" aria-labelledby="ai-corrector-title" tabindex="-1"><header class="ai-corrector-modal-header"><h3 id="ai-corrector-title">Düzeltmeleri inceleyin</h3></header><div class="ai-corrector-modal-body"><p class="ai-corrector-warning" hidden>Bu değişiklikte biçimler güvenle eşleştirilemedi. Sonuç düz metin olarak uygulanacak; biçimler ve bağlantılar kaldırılacak. Kabul etmeden önce kontrol edin.</p><div class="ai-corrector-diff"></div><p class="ai-corrector-legend"><span class="ai-corrector-added">Eklenen</span><span class="ai-corrector-removed">Çıkarılan</span></p><p class="ai-corrector-error" role="alert" hidden></p></div><footer class="ai-corrector-modal-footer"><button type="button" data-action="reject" class="ai-corrector-btn-secondary">İptal</button><button type="button" data-action="accept" class="ai-corrector-btn-primary">Kabul et</button></footer></section>';
        modal.querySelector('.ai-corrector-warning').hidden = mapped !== null;
        const diff = modal.querySelector('.ai-corrector-diff');
        Diff.diffWordsWithSpace(original, corrected).forEach(part => {
            const span = document.createElement('span');
            span.textContent = part.value;
            if (part.added) span.className = 'ai-corrector-added';
            if (part.removed) span.className = 'ai-corrector-removed';
            diff.appendChild(span);
        });
        document.body.appendChild(modal);
        const accept = modal.querySelector('[data-action="accept"]');
        const reject = modal.querySelector('[data-action="reject"]');
        const dialog = modal.querySelector('[role="dialog"]');
        const previousFocus = document.activeElement;
        function cleanup() {
            modal.remove();
            document.removeEventListener('keydown', onKeydown, true);
            closeModal = null;
            if (previousFocus && previousFocus.isConnected) previousFocus.focus();
        }
        closeModal = cleanup;
        function onKeydown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                cancelOperation();
            } else if (event.key === 'Tab') {
                const focusable = Array.from(dialog.querySelectorAll('button:not(:disabled)'));
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        }
        document.addEventListener('keydown', onKeydown, true);
        reject.addEventListener('click', cancelOperation);
        accept.addEventListener('click', async event => {
            if (!event.isTrusted) return;
            if (!isCurrent(operation)) { cancelOperation(); return; }
            accept.disabled = true;
            try {
                await editorRequest('write', { editorId: operation.entry.id, html: mapped === null ? plainHTML(corrected) : mapped, expectedHTML });
                if (isCurrent(operation)) cancelOperation();
            } catch (error) {
                if (!isCurrent(operation)) return;
                const message = modal.querySelector('.ai-corrector-error');
                message.textContent = error.message;
                message.hidden = false;
                // A changed document needs a new correction, not another accept.
                reject.focus();
            }
        });
        reject.focus();
    }

    function scheduleDiscovery() {
        if (!isEnabled || discoveryTimer) return;
        discoveryTimer = setTimeout(() => {
            discoveryTimer = null;
            discoverEditors();
        }, 150);
    }

    document.addEventListener('duzelt-ai:editors-ready', scheduleDiscovery);

    function enable() {
        if (domObserver) return;
        scheduleDiscovery();
        domObserver = new MutationObserver(mutations => {
            const relevant = mutations.some(mutation => {
                if (mutation.target.nodeType !== Node.ELEMENT_NODE) return false;
                if (mutation.type === 'attributes') {
                    return mutation.target.matches('.ck-editor__editable, .note-editable, .ql-editor, .note-editor');
                }
                if (mutation.target.closest(`#${MODAL_ID}, .ck-content, .note-editable, .ql-editor`)) return false;
                return [...mutation.addedNodes, ...mutation.removedNodes].some(node => {
                    if (node.nodeType !== Node.ELEMENT_NODE || node.matches(`.${BUTTON_CLASS}, #${MODAL_ID}`)) return false;
                    return node.matches(EDITOR_SELECTOR) || node.querySelector(EDITOR_SELECTOR) || mutation.target.closest(EDITOR_SELECTOR);
                });
            });
            if (relevant) scheduleDiscovery();
        });
        domObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['contenteditable', 'class'] });
    }

    function disable() {
        cancelOperation();
        clearTimeout(discoveryTimer);
        discoveryTimer = null;
        if (domObserver) domObserver.disconnect();
        domObserver = null;
        entries.forEach(entry => entry.button.remove());
        entries.clear();
    }

    chrome.storage.sync.get([ENABLED_KEY], result => {
        const storageError = chrome.runtime.lastError;
        if (storageError || !result || storageGeneration !== 0) return;
        isEnabled = result[ENABLED_KEY] !== false;
        if (isEnabled) enable();
    });
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace !== 'sync' || !changes[ENABLED_KEY]) return;
        storageGeneration++;
        isEnabled = changes[ENABLED_KEY].newValue !== false;
        if (isEnabled) enable();
        else disable();
    });
})();
