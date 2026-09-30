import MakeTool from '../MakeTool.js';
import HeadingTool from './HeadingTool.js';
import ULTool from './ULTool.js';
import OLTool from './OLTool.js';
import CheckListTool from './CheckListTool.js';
import BoldTool from './BoldTool.js';
import ItalicTool from './ItalicTool.js';
import StrikethroughTool from './StrikethroughTool.js';
import LinkTool from './LinkTool.js';
import ImageTool from './ImageTool.js';

const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

class ModalTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Modal');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16"/><path d="M9 13h6"/></svg>
        `);
    }

    // Insert a Bootstrap Modal component with a rich-text body
    applySyntax(event) {
        const editor = this.editor;
        const wrapper = editor.editorContainer;

        wrapper.querySelector('.bootstrap-modal')?.remove();

        const bodyHTML = `
            <div class="fj:flex fj:justify-between fj:items-center fj:gap-3">
                <div class="fj:font-medium">${editor.label('Modal')}</div>
                <button type="button" class="modal-close-btn fj:me-btn fj:me-btn-ghost fj:me-btn-xs fj:me-btn-circle" aria-label="${editor.label('Close')}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            </div>
            <div class="fj:mt-4 fj:flex fj:flex-col fj:gap-y-4">
                <input type="text" class="modal-title-input fj:me-input fj:w-full" placeholder="${editor.label('Modal title')}">
                <div>
                    <div class="modal-body-toolbar fj:flex fj:items-center fj:gap-x-1 fj:p-1 fj:border fj:border-base-soft fj:rounded fj:mb-1"></div>
                    <textarea class="modal-body-input fj:me-input fj:w-full" rows="5" placeholder="${editor.label('Modal body')}"></textarea>
                </div>
                <div class="fj:flex fj:justify-end fj:gap-2">
                    <button type="button" class="apply-modal fj:me-btn fj:me-btn-sm fj:me-btn-primary">${editor.label('Apply')}</button>
                </div>
            </div>`;

        wrapper.insertAdjacentHTML('beforeend', `
            <dialog class="bootstrap-modal fj:me-modal fj:me-modal-top fj:lg:me-modal-middle fj:me-modal-center" aria-label="${editor.label('Modal')}">
                <div class="fj:me-modal-content fj:max-w-lg">
                    ${bodyHTML}
                </div>
            </dialog>
        `);

        const dialog = wrapper.querySelector('.bootstrap-modal');
        dialog.addEventListener('close', () => dialog.remove());
        dialog.showModal();

        const titleInput = dialog.querySelector('.modal-title-input');
        const bodyTextarea = dialog.querySelector('.modal-body-input');
        const toolbarContainer = dialog.querySelector('.modal-body-toolbar');

        // The body field reuses the real toolbar tools through a lightweight
        // adapter, so every tool behaves exactly as it does in the main editor
        const bodyEditor = {
            usertextarea: bodyTextarea,
            label: (t) => editor.label(t),
            insertText(text, offset = 0, trailing = 0) {
                const { selectionStart, selectionEnd } = bodyTextarea;
                const value = bodyTextarea.value;
                bodyTextarea.value = value.substring(0, selectionStart) + text + value.substring(selectionEnd);
                bodyTextarea.focus();
                bodyTextarea.setSelectionRange(selectionStart + offset, selectionStart + text.length - trailing);
            },
            scrollToView() {},
            render() {},
            notifyChange() {}
        };

        [
            new HeadingTool(bodyEditor),
            new ULTool(bodyEditor),
            new OLTool(bodyEditor),
            new CheckListTool(bodyEditor),
            new BoldTool(bodyEditor),
            new ItalicTool(bodyEditor),
            new StrikethroughTool(bodyEditor),
            new LinkTool(bodyEditor),
            new ImageTool(bodyEditor)
        ].forEach(t => toolbarContainer.appendChild(t.button));

        dialog.querySelector('.modal-close-btn').addEventListener('click', () => dialog.close());

        dialog.querySelector('.apply-modal').addEventListener('click', () => {
            const title = titleInput.value.trim();
            const body = bodyTextarea.value.trim();
            if (title || body) {
                editor.insertText(this.buildModalHtml(title, body, editor));
            }
            dialog.close();
        });
    }

    buildModalHtml(title, body, editor) {
        const uid = Math.random().toString(36).slice(2, 7);
        const modalId = `modal-${uid}`;
        const bodyHtml = editor._renderMarkdown(body);

        return `
<div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}-label" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="${modalId}-label">${escapeHtml(title)}</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        ${bodyHtml}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
        <button type="button" class="btn btn-primary">Save changes</button>
      </div>
    </div>
  </div>
</div>`;
    }
}

export default ModalTool;
