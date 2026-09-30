import MakeTool from '../MakeTool.js';
import BoldTool from './BoldTool.js';
import ItalicTool from './ItalicTool.js';
import StrikethroughTool from './StrikethroughTool.js';

const escapeAttr = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

class TooltipTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Tooltip');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 4h16v12h-5l-3 3l-3 -3h-5z"/></svg>
        `);
    }

    // Insert a Bootstrap Tooltip trigger with a rich-text label
    applySyntax(event) {
        const editor = this.editor;
        const wrapper = editor.editorContainer;

        wrapper.querySelector('.tooltip-modal')?.remove();

        const bodyHTML = `
            <div class="fj:flex fj:justify-between fj:items-center fj:gap-3">
                <div class="fj:font-medium">${editor.label('Tooltip')}</div>
                <button type="button" class="modal-close-btn fj:me-btn fj:me-btn-ghost fj:me-btn-xs fj:me-btn-circle" aria-label="${editor.label('Close')}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            </div>
            <div class="fj:mt-4 fj:flex fj:flex-col fj:gap-y-4">
                <input type="text" class="tooltip-trigger-input fj:me-input fj:w-full" placeholder="${editor.label('Trigger text')}">
                <div>
                    <div class="tooltip-text-toolbar fj:flex fj:items-center fj:gap-x-1 fj:p-1 fj:border fj:border-base-soft fj:rounded fj:mb-1"></div>
                    <textarea class="tooltip-text-input fj:me-input fj:w-full" rows="3" placeholder="${editor.label('Tooltip text')}"></textarea>
                </div>
                <select class="tooltip-placement fj:me-input fj:w-full">
                    <option value="top">${editor.label('Top')}</option>
                    <option value="right">${editor.label('Right')}</option>
                    <option value="bottom">${editor.label('Bottom')}</option>
                    <option value="left">${editor.label('Left')}</option>
                </select>
                <div class="fj:flex fj:justify-end fj:gap-2">
                    <button type="button" class="apply-tooltip fj:me-btn fj:me-btn-sm fj:me-btn-primary">${editor.label('Apply')}</button>
                </div>
            </div>`;

        wrapper.insertAdjacentHTML('beforeend', `
            <dialog class="tooltip-modal fj:me-modal fj:me-modal-top fj:lg:me-modal-middle fj:me-modal-center" aria-label="${editor.label('Tooltip')}">
                <div class="fj:me-modal-content fj:max-w-lg">
                    ${bodyHTML}
                </div>
            </dialog>
        `);

        const dialog = wrapper.querySelector('.tooltip-modal');
        dialog.addEventListener('close', () => dialog.remove());
        dialog.showModal();

        const triggerInput = dialog.querySelector('.tooltip-trigger-input');
        const textTextarea = dialog.querySelector('.tooltip-text-input');
        const placementSelect = dialog.querySelector('.tooltip-placement');
        const toolbarContainer = dialog.querySelector('.tooltip-text-toolbar');

        // The tooltip text reuses the real toolbar tools through a lightweight
        // adapter, so every tool behaves exactly as it does in the main editor
        const textEditor = {
            usertextarea: textTextarea,
            label: (t) => editor.label(t),
            insertText(text, offset = 0, trailing = 0) {
                const { selectionStart, selectionEnd } = textTextarea;
                const value = textTextarea.value;
                textTextarea.value = value.substring(0, selectionStart) + text + value.substring(selectionEnd);
                textTextarea.focus();
                textTextarea.setSelectionRange(selectionStart + offset, selectionStart + text.length - trailing);
            },
            scrollToView() {},
            render() {},
            notifyChange() {}
        };

        [
            new BoldTool(textEditor),
            new ItalicTool(textEditor),
            new StrikethroughTool(textEditor)
        ].forEach(t => toolbarContainer.appendChild(t.button));

        dialog.querySelector('.modal-close-btn').addEventListener('click', () => dialog.close());

        dialog.querySelector('.apply-tooltip').addEventListener('click', () => {
            const trigger = triggerInput.value.trim();
            const text = textTextarea.value.trim();
            if (trigger || text) {
                editor.insertText(this.buildTooltipHtml(trigger, text, placementSelect.value, editor));
            }
            dialog.close();
        });
    }

    buildTooltipHtml(trigger, text, placement, editor) {
        const title = escapeAttr(editor._renderMarkdown(text));
        return `<button type="button" class="btn btn-secondary" data-bs-toggle="tooltip" data-bs-html="true" data-bs-placement="${placement}" title="${title}">${trigger}</button>`;
    }
}

export default TooltipTool;
