(function() {
    'use strict';

    const STORAGE_KEYS = {
        OPENAI_KEY: 'openai_api_key',
        ENABLED: 'ai_corrector_enabled'
    };

    const CONFIG = {
        BUTTON_CLASS: 'ai-text-corrector-button',
        MODAL_ID: 'ai-text-corrector-modal',
        // Timing constants (milliseconds)
        INIT_DELAY: 1000,           // Initial delay for editor detection
        DEBOUNCE_DELAY: 500,        // Debounce delay for DOM mutations
        // Text validation
        MIN_TEXT_LENGTH: 10,        // Minimum characters for correction
        // HTML mapping
        WORD_DIFF_THRESHOLD: 0.5    // Max allowed word count difference (50%)
    };

    let isEnabled = true;
    let buttonCounter = 0;
    let domObserver = null;
    // WeakSet yerine Set kullan - clear() metodu var
    const processedFields = new Set();

    chrome.storage.sync.get([STORAGE_KEYS.ENABLED], function(result) {
        isEnabled = result[STORAGE_KEYS.ENABLED] !== false;
        if (isEnabled) {
            init();
        }
    });

    function init() {
        // İlk yüklemede biraz bekle (editörler yüklensin)
        setTimeout(() => {
            addButtonsToExistingFields();
            observeDOMChanges();
        }, CONFIG.INIT_DELAY);
    }

    function addButtonsToExistingFields() {
        // isEnabled kontrolü - devre dışıysa hiç buton ekleme
        if (!isEnabled) return;

        // SADECE Rich text editörleri tespit et
        // Normal textarea/input alanlarına buton ekleme - sadece rich editörlere
        detectRichTextEditors();
    }

    function detectRichTextEditors() {
        // CKEditor 4.x ve 5.x
        detectCKEditor();

        // Summernote
        detectSummernote();

        // TinyMCE
        detectTinyMCE();

        // Quill
        detectQuill();
    }

    function detectCKEditor() {
        // CKEditor 4.x
        if (window.CKEDITOR && window.CKEDITOR.instances) {
            Object.keys(window.CKEDITOR.instances).forEach(instanceName => {
                const editor = window.CKEDITOR.instances[instanceName];
                const editorElement = editor.container.$;

                if (editorElement && !processedFields.has(editorElement)) {
                    addButtonToRichEditor(editorElement, 'ckeditor4', editor);
                }
            });
        }

        // CKEditor 5.x (class-based detection)
        document.querySelectorAll('.ck-editor').forEach(editorElement => {
            if (!processedFields.has(editorElement)) {
                const editableElement = editorElement.querySelector('.ck-content[contenteditable="true"]');
                if (editableElement) {
                    addButtonToRichEditor(editorElement, 'ckeditor5', editableElement);
                }
            }
        });
    }

    function detectSummernote() {
        document.querySelectorAll('.note-editor').forEach(editorElement => {
            if (!processedFields.has(editorElement)) {
                const editableElement = editorElement.querySelector('.note-editable');
                if (editableElement) {
                    addButtonToRichEditor(editorElement, 'summernote', editableElement);
                }
            }
        });
    }

    function detectTinyMCE() {
        if (window.tinymce && window.tinymce.editors) {
            window.tinymce.editors.forEach(editor => {
                const editorElement = editor.getContainer();
                if (editorElement && !processedFields.has(editorElement)) {
                    addButtonToRichEditor(editorElement, 'tinymce', editor);
                }
            });
        }
    }

    function detectQuill() {
        document.querySelectorAll('.ql-container').forEach(container => {
            if (!processedFields.has(container)) {
                const editableElement = container.querySelector('.ql-editor');
                if (editableElement) {
                    const toolbar = container.previousElementSibling;
                    if (toolbar && toolbar.classList.contains('ql-toolbar')) {
                        addButtonToRichEditor(toolbar, 'quill', editableElement);
                        // Container'ı processed olarak işaretle (toolbar'a buton ekledik ama container'ı kontrol ediyoruz)
                        processedFields.add(container);
                    } else {
                        addButtonToRichEditor(container, 'quill', editableElement);
                    }
                }
            }
        });
    }

    // isFieldEligible ve addButtonToField fonksiyonları kaldırıldı
    // v3.1.0: Sadece rich text editörlere buton ekleniyor, normal input/textarea'lara eklenmiyor

    function addButtonToRichEditor(containerElement, editorType, editorInstance) {
        const fieldId = `ai-richeditor-${buttonCounter++}`;
        const button = createButton(fieldId, editorInstance, editorType);

        // Rich editörler için butonu daha iyi konumlandır
        insertButtonForRichEditor(containerElement, button, editorType);
        processedFields.add(containerElement);
    }

    function createButton(fieldId, fieldOrEditor, editorType = null) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = CONFIG.BUTTON_CLASS;
        button.dataset.aiFieldId = fieldId;
        button.dataset.aiCorrectorButton = 'true';
        if (editorType) {
            button.dataset.editorType = editorType;
        }
        button.innerHTML = '🤖 Düzelt';
        button.title = 'AI ile Türkçe düzeltme yap';

        button.addEventListener('click', (event) => handleButtonClick(event, fieldOrEditor, editorType));

        return button;
    }

    // insertButtonNearField fonksiyonu kaldırıldı
    // v3.1.0: Sadece rich text editörlere buton ekleniyor

    function insertButtonForRichEditor(editorElement, button, editorType) {
        // Rich editörler için toolbar'a veya container'a ekle
        let targetElement = editorElement;

        if (editorType === 'summernote') {
            // Summernote için toolbar'ı bul
            const toolbar = editorElement.querySelector('.note-toolbar');
            if (toolbar) {
                const btnGroup = document.createElement('div');
                btnGroup.className = 'note-btn-group btn-group';
                button.style.position = 'relative';
                button.style.margin = '5px';
                btnGroup.appendChild(button);
                toolbar.appendChild(btnGroup);
                return;
            }
        } else if (editorType === 'quill') {
            // Quill için toolbar sonuna ekle
            if (editorElement.classList.contains('ql-toolbar')) {
                button.style.position = 'relative';
                button.style.margin = '0 5px';
                editorElement.appendChild(button);
                return;
            }
        } else if (editorType === 'ckeditor5') {
            // CKEditor 5 için toolbar bul
            const toolbar = editorElement.querySelector('.ck-toolbar');
            if (toolbar) {
                button.style.position = 'relative';
                button.style.margin = '0 5px';
                toolbar.appendChild(button);
                return;
            }
        }

        // Varsayılan: container'a ekle
        const parentPosition = window.getComputedStyle(targetElement).position;
        if (parentPosition === 'static') {
            targetElement.style.position = 'relative';
        }
        targetElement.appendChild(button);
    }

    async function handleButtonClick(event, fieldOrEditor, editorType = null) {
        event.preventDefault();
        const button = event.currentTarget;

        const editorData = getEditorValue(fieldOrEditor, editorType);
        const originalText = editorData.text;

        if (!originalText || originalText.trim().length < CONFIG.MIN_TEXT_LENGTH) {
            alert(`Lütfen düzeltilecek metin girin (en az ${CONFIG.MIN_TEXT_LENGTH} karakter)`);
            return;
        }

        button.disabled = true;
        button.innerHTML = '⏳ Düzeltiliyor...';

        try {
            const correctedText = await requestCorrection(originalText);
            showDiffModal(originalText, correctedText, fieldOrEditor, button, editorType, editorData);
        } catch (error) {
            alert('Hata: ' + error.message);
            button.disabled = false;
            button.innerHTML = '🤖 Düzelt';
        }
    }

    function getEditorValue(fieldOrEditor, editorType) {
        if (!editorType) {
            // Normal field - düz metin
            if (fieldOrEditor.isContentEditable) {
                return {
                    text: fieldOrEditor.innerText || fieldOrEditor.textContent,
                    html: null,
                    isPlainText: true
                };
            }
            return {
                text: fieldOrEditor.value,
                html: null,
                isPlainText: true
            };
        }

        // Rich text editörler - HTML ile birlikte
        let html = '';
        let text = '';

        switch (editorType) {
            case 'ckeditor4':
                html = fieldOrEditor.getData();
                text = extractTextFromHTML(html);
                break;

            case 'ckeditor5':
                html = fieldOrEditor.innerHTML;
                text = fieldOrEditor.innerText || fieldOrEditor.textContent;
                break;

            case 'summernote':
                html = fieldOrEditor.innerHTML;
                text = fieldOrEditor.innerText || fieldOrEditor.textContent;
                break;

            case 'tinymce':
                html = fieldOrEditor.getContent();
                text = fieldOrEditor.getContent({ format: 'text' });
                break;

            case 'quill':
                html = fieldOrEditor.innerHTML;
                text = fieldOrEditor.innerText || fieldOrEditor.textContent;
                break;

            default:
                html = fieldOrEditor.innerHTML || '';
                text = fieldOrEditor.innerText || fieldOrEditor.textContent || '';
        }

        return {
            text: text,
            html: html,
            isPlainText: false,
            editorInstance: fieldOrEditor
        };
    }

    function extractTextFromHTML(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.innerText || temp.textContent || '';
    }

    function setEditorValue(fieldOrEditor, correctedText, editorType, originalData) {
        if (!editorType) {
            // Normal field - düz metin
            if (fieldOrEditor.isContentEditable) {
                fieldOrEditor.innerText = correctedText;
            } else {
                fieldOrEditor.value = correctedText;
            }
            fieldOrEditor.dispatchEvent(new Event('input', { bubbles: true }));
            fieldOrEditor.dispatchEvent(new Event('change', { bubbles: true }));
            return;
        }

        // Rich text editörler - HTML formatını koru
        const correctedHTML = mapTextToHTML(originalData.html, originalData.text, correctedText);

        switch (editorType) {
            case 'ckeditor4':
                fieldOrEditor.setData(correctedHTML);
                break;

            case 'ckeditor5':
                fieldOrEditor.innerHTML = correctedHTML;
                fieldOrEditor.dispatchEvent(new Event('input', { bubbles: true }));
                break;

            case 'summernote':
                fieldOrEditor.innerHTML = correctedHTML;
                fieldOrEditor.dispatchEvent(new Event('input', { bubbles: true }));
                break;

            case 'tinymce':
                fieldOrEditor.setContent(correctedHTML);
                break;

            case 'quill':
                fieldOrEditor.innerHTML = correctedHTML;
                fieldOrEditor.dispatchEvent(new Event('input', { bubbles: true }));
                break;
        }
    }

    function mapTextToHTML(originalHTML, originalText, correctedText) {
        // SECURITY FIX: Position-aware replacement with proper escaping
        // Fixes: XSS vulnerability and word mapping corruption

        const originalWords = originalText.split(/\s+/).filter(w => w.length > 0);
        const correctedWords = correctedText.split(/\s+/).filter(w => w.length > 0);

        // FIX: If word counts differ, fall back to safe mode
        // Insertions/deletions cannot be reliably mapped with position-only strategy
        // Examples that would fail:
        // - "Merhaba Ali" → "Merhaba Ali Bey" (insertion: "Bey" lost)
        // - "a b c d" → "a b d" (deletion: becomes "a b d d")
        if (originalWords.length !== correctedWords.length) {
            return escapeHtmlSafe(correctedText);
        }

        // Eğer kelime sayısı çok farklıysa, direkt düz metin dön (güvenli mod)
        // This threshold is now redundant but kept for extreme cases
        if (Math.abs(originalWords.length - correctedWords.length) > originalWords.length * CONFIG.WORD_DIFF_THRESHOLD) {
            return escapeHtmlSafe(correctedText);
        }

        // SECURITY: Use DOMParser to safely parse HTML without executing scripts
        const parser = new DOMParser();
        const doc = parser.parseFromString(originalHTML, 'text/html');
        const tempDiv = doc.body;

        // Build position-indexed replacement map
        // Key: global word position, Value: replacement text
        const positionMap = new Map();
        for (let i = 0; i < originalWords.length; i++) {
            if (originalWords[i] !== correctedWords[i]) {
                // SECURITY: Sanitize AI output but preserve actual characters
                // Use textContent to prevent HTML injection while keeping readability
                positionMap.set(i, sanitizeTextForDisplay(correctedWords[i]));
            }
        }

        // Walk DOM tree and replace text nodes using global position counter
        const context = { globalPosition: 0 };
        replaceTextNodesInDOM(tempDiv, positionMap, context);

        return tempDiv.innerHTML;
    }

    function replaceTextNodesInDOM(node, positionMap, context) {
        // Recursively walk DOM tree and replace text content
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            const words = text.split(/(\s+)/); // Keep whitespace

            let modified = false;
            const newWords = words.map(word => {
                if (word.trim().length === 0) {
                    return word; // Keep whitespace as-is
                }

                // Check if this position needs replacement
                if (positionMap.has(context.globalPosition)) {
                    modified = true;
                    const replacement = positionMap.get(context.globalPosition);
                    context.globalPosition++;
                    return replacement;
                }

                context.globalPosition++;
                return word;
            });

            if (modified) {
                node.textContent = newWords.join('');
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Skip script and style tags for security
            if (node.nodeName === 'SCRIPT' || node.nodeName === 'STYLE') {
                return;
            }

            // Recursively process child nodes
            const children = Array.from(node.childNodes);
            children.forEach(child => replaceTextNodesInDOM(child, positionMap, context));
        }
    }

    function sanitizeTextForDisplay(text) {
        // SECURITY: Use textContent for safe insertion (auto-escapes HTML)
        // This prevents XSS while keeping special chars readable (< stays as <, not &lt;)
        // textContent already prevents HTML injection, no need for double-escaping
        return text;
    }

    function escapeHtmlSafe(text) {
        // Safe fallback: escape all HTML and preserve line breaks
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/\n/g, '<br>');
    }


    function requestCorrection(text) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                { action: 'correctText', text: text },
                response => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else if (response.error) {
                        reject(new Error(response.error));
                    } else {
                        resolve(response.correctedText);
                    }
                }
            );
        });
    }

    function showDiffModal(original, corrected, fieldOrEditor, button, editorType, originalData) {
        // FIX: Clean up existing modal if present
        const existingModal = document.getElementById(CONFIG.MODAL_ID);
        if (existingModal) {
            // The cleanup handler is responsible for removing the modal and re-enabling the button
            if (existingModal._cleanupHandler) {
                existingModal._cleanupHandler();
            } else {
                // Fallback for modals created without a cleanup handler
                const previousButton = existingModal._associatedButton;
                if (previousButton) {
                    previousButton.disabled = false;
                    previousButton.innerHTML = '🤖 Düzelt';
                }
                existingModal.remove();
            }
        }

        const modal = createDiffModal(original, corrected);
        // Store button reference on modal for cleanup
        modal._associatedButton = button;
        document.body.appendChild(modal);

        const acceptBtn = modal.querySelector('[data-action="accept"]');
        const rejectBtn = modal.querySelector('[data-action="reject"]');

        // Use function declarations to avoid temporal dead zone
        function handleEscape(e) {
            if (e.key === 'Escape') {
                cleanup();
            }
        }

        function cleanup() {
            modal.remove();
            button.disabled = false;
            button.innerHTML = '🤖 Düzelt';
            // FIX: Always remove event listener to prevent memory leak
            document.removeEventListener('keydown', handleEscape);
        }

        // Store cleanup handler for proper cleanup of existing modals
        modal._cleanupHandler = cleanup;

        acceptBtn.addEventListener('click', () => {
            setEditorValue(fieldOrEditor, corrected, editorType, originalData);
            cleanup();
        });

        rejectBtn.addEventListener('click', cleanup);

        // Allow ESC key to close modal (accessibility)
        document.addEventListener('keydown', handleEscape);
    }

    function createDiffModal(original, corrected) {
        const modal = document.createElement('div');
        modal.id = CONFIG.MODAL_ID;
        modal.className = 'ai-corrector-modal';

        const diff = Diff.diffWords(original, corrected);
        const diffHtml = diff.map(part => {
            const color = part.added ? 'green' : part.removed ? 'red' : 'gray';
            const decoration = part.added ? 'underline' : part.removed ? 'line-through' : 'none';
            return `<span style="color: ${color}; text-decoration: ${decoration};">${escapeHtml(part.value)}</span>`;
        }).join('');

        modal.innerHTML = `
            <div class="ai-corrector-modal-content">
                <div class="ai-corrector-modal-header">
                    <h3>AI Metin Düzeltme Sonucu</h3>
                </div>
                <div class="ai-corrector-modal-body">
                    <div class="ai-corrector-diff">
                        ${diffHtml}
                    </div>
                    <div class="ai-corrector-legend">
                        <span style="color: green;">✓ Eklenen</span>
                        <span style="color: red;">✗ Çıkarılan</span>
                    </div>
                </div>
                <div class="ai-corrector-modal-footer">
                    <button data-action="reject" class="ai-corrector-btn-secondary">İptal</button>
                    <button data-action="accept" class="ai-corrector-btn-primary">Kabul Et</button>
                </div>
            </div>
        `;

        return modal;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function observeDOMChanges() {
        // isEnabled kontrolü - devre dışıysa observer başlatma
        if (!isEnabled) return;

        // Eski observer varsa disconnect et
        if (domObserver) {
            domObserver.disconnect();
        }

        domObserver = new MutationObserver(mutations => {
            // Her mutation'da isEnabled kontrolü
            if (!isEnabled) return;

            let needsUpdate = false;

            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        needsUpdate = true;
                    }
                });
            });

            if (needsUpdate) {
                // Debounce: DOM değişikliklerini topla
                clearTimeout(observeDOMChanges.timer);
                observeDOMChanges.timer = setTimeout(() => {
                    if (isEnabled) {
                        addButtonsToExistingFields();
                    }
                }, CONFIG.DEBOUNCE_DELAY);
            }
        });

        domObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && changes[STORAGE_KEYS.ENABLED]) {
            isEnabled = changes[STORAGE_KEYS.ENABLED].newValue !== false;
            if (isEnabled) {
                init();
            } else {
                removeAllButtons();
                disconnectObserver();
            }
        }
    });

    function removeAllButtons() {
        const buttons = document.querySelectorAll(`.${CONFIG.BUTTON_CLASS}`);
        buttons.forEach(btn => btn.remove());
        processedFields.clear();
    }

    function disconnectObserver() {
        if (domObserver) {
            domObserver.disconnect();
            domObserver = null;
        }
    }

})();
