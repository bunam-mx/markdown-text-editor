import MakeTool from '../MakeTool.js';
import { modal } from '../../modal.js';

const VARIANTS = ['btn-primary', 'btn-secondary', 'btn-success', 'btn-danger',
                  'btn-warning', 'btn-info', 'btn-light', 'btn-dark', 'btn-link'];

const escapeAttr = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

class ButtonLinkTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Button Link');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="m9 9 5 12 1.8-5.2L21 14Z"/><path d="M7.2 2.2 8 5.1"/><path d="M5.1 8 2.2 7.2"/><path d="M14 4.1 12 6"/><path d="m6 12-1.9 2"/></svg>
        `);
    }

    // Insert an HTML anchor styled as a Bootstrap button: <a href="..." class="btn btn-primary">text</a>
    applySyntax(event) {
        let editor = this.editor;
        let textarea = editor.usertextarea;
        let { selectionStart, selectionEnd } = textarea;
        const fullText = textarea.value;

        let selectedText = fullText.substring(selectionStart, selectionEnd);

        // Prefill from an existing button link when the selection is exactly one
        const anchorRegex = /^<a\s+([^>]*)>(.*)<\/a>$/;
        const match = selectedText && selectedText.match(anchorRegex);

        let prefillText = match ? match[2] : selectedText;
        let prefillUrl = '';
        let prefillVariant = 'btn-primary';
        if (match) {
            const hrefMatch = match[1].match(/href="([^"]*)"/);
            if (hrefMatch) prefillUrl = hrefMatch[1];
            const classMatch = match[1].match(/class="([^"]*)"/);
            if (classMatch) {
                const variant = classMatch[1].split(/\s+/).find(c => c.startsWith('btn-'));
                if (variant && VARIANTS.includes(variant)) prefillVariant = variant;
            }
        }

        const bodyHTML = `
            <div class="fj:flex fj:justify-between fj:items-center fj:gap-3">
                <div class="fj:font-medium">${this.editor.label('Button Link')}</div>
                <button type="button" class="modal-close-btn fj:me-btn fj:me-btn-ghost fj:me-btn-xs fj:me-btn-circle" aria-label="${this.editor.label('Close')}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            </div>
            <form method="post">
                <div class="fj:flex fj:flex-col fj:justify-center fj:gap-y-4.5 fj:mt-4">
                    <input type="url" placeholder="${this.editor.label('URL')}" class="button-link-input fj:me-input fj:w-full" value="${escapeAttr(prefillUrl)}" required>
                    <input type="text" placeholder="${this.editor.label('Button text')}" class="button-link-text-input fj:me-input fj:w-full" value="${escapeAttr(prefillText)}" required>
                    <select class="button-link-variant fj:me-input fj:w-full">
                        ${VARIANTS.map(v => `<option value="${v}">${this.editor.label(v.slice(4).replace(/^./, c => c.toUpperCase()))}</option>`).join('\n                        ')}
                    </select>
                    <button type="submit" class="submit-button-link fj:me-btn fj:me-btn-sm fj:self-end">${this.editor.label('Apply')}</button>
                </div>
            </form>`;

        const modalElement = modal(event, 'fj:max-w-sm', bodyHTML, 'Button Link');

        // Set via JS rather than a `selected` attribute: happy-dom ignores the
        // attribute and always reports the second option's value
        modalElement.querySelector(".button-link-variant").value = prefillVariant;

        modalElement.querySelector(".modal-close-btn").addEventListener("click", () => modalElement.close());

        modalElement.querySelector(".submit-button-link").addEventListener("click", function(e) {
            e.preventDefault();
            const linkInput = modalElement.querySelector(".button-link-input");
            const linkTextInput = modalElement.querySelector(".button-link-text-input");
            const variantSelect = modalElement.querySelector(".button-link-variant");

            if (!linkInput.validity.valid) {
                linkInput.reportValidity();
            } else if (!linkTextInput.validity.valid) {
                linkTextInput.reportValidity();
            } else {
                const url = linkInput.value;
                const text = linkTextInput.value || 'Button Text';
                editor.insertText(`<a href="${url}" class="btn ${variantSelect.value}" target="_blank">${text}</a>`);
                modalElement.close();
            }
        });
    }

}

export default ButtonLinkTool;
