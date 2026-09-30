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

class AccordionTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Accordion');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16"/><path d="m9 13 3 3 3-3"/></svg>
        `);
    }

    // Insert a Bootstrap Accordion component built from the collected items
    applySyntax(event) {
        const editor = this.editor;
        const wrapper = editor.editorContainer;

        wrapper.querySelector('.accordion-modal')?.remove();

        const bodyHTML = `
            <div class="fj:flex fj:justify-between fj:items-center fj:gap-3">
                <div class="fj:font-medium">${editor.label('Accordion')}</div>
                <button type="button" class="modal-close-btn fj:me-btn fj:me-btn-ghost fj:me-btn-xs fj:me-btn-circle" aria-label="${editor.label('Close')}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            </div>
            <div class="fj:mt-4 fj:flex fj:flex-col fj:gap-y-4">
                <input type="text" class="accordion-header-input fj:me-input fj:w-full" placeholder="${editor.label('Accordion header')}">
                <div>
                    <div class="accordion-body-toolbar fj:flex fj:items-center fj:gap-x-1 fj:p-1 fj:border fj:border-base-soft fj:rounded fj:mb-1"></div>
                    <textarea class="accordion-body-input fj:me-input fj:w-full" rows="4" placeholder="${editor.label('Accordion body')}"></textarea>
                </div>
                <div class="fj:flex fj:justify-end fj:gap-2">
                    <button type="button" class="continue-accordion fj:me-btn fj:me-btn-sm">${editor.label('Continue')}</button>
                    <button type="button" class="apply-accordion fj:me-btn fj:me-btn-sm fj:me-btn-primary">${editor.label('Apply')}</button>
                </div>
            </div>`;

        wrapper.insertAdjacentHTML('beforeend', `
            <dialog class="accordion-modal fj:me-modal fj:me-modal-top fj:lg:me-modal-middle fj:me-modal-center" aria-label="${editor.label('Accordion')}">
                <div class="fj:me-modal-content fj:max-w-lg">
                    ${bodyHTML}
                </div>
            </dialog>
        `);

        const dialog = wrapper.querySelector('.accordion-modal');
        dialog.addEventListener('close', () => dialog.remove());
        dialog.showModal();

        const headerInput = dialog.querySelector('.accordion-header-input');
        const bodyTextarea = dialog.querySelector('.accordion-body-input');
        const toolbarContainer = dialog.querySelector('.accordion-body-toolbar');

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

        const items = [];
        const collectCurrent = () => {
            const header = headerInput.value.trim();
            const body = bodyTextarea.value.trim();
            if (header || body) items.push({ header, body });
        };
        const clearForm = () => {
            headerInput.value = '';
            bodyTextarea.value = '';
            headerInput.focus();
        };

        dialog.querySelector('.modal-close-btn').addEventListener('click', () => dialog.close());

        dialog.querySelector('.continue-accordion').addEventListener('click', () => {
            collectCurrent();
            clearForm();
        });

        dialog.querySelector('.apply-accordion').addEventListener('click', () => {
            collectCurrent();
            if (items.length) {
                editor.insertText(this.buildAccordionHtml(items, editor));
            }
            dialog.close();
        });
    }

    buildAccordionHtml(items, editor) {
        const uid = Math.random().toString(36).slice(2, 7);
        const accordionId = `accordion-${uid}`;

        const itemHtml = items.map((item, i) => {
            const collapseId = `collapse-${uid}-${i}`;
            const show = i === 0 ? ' show' : '';
            const expanded = i === 0 ? 'true' : 'false';
            const bodyHtml = editor._renderMarkdown(item.body);
            return `
  <div class="accordion-item">
    <h2 class="accordion-header">
      <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="${expanded}" aria-controls="${collapseId}">
        ${escapeHtml(item.header)}
      </button>
    </h2>
    <div id="${collapseId}" class="accordion-collapse collapse${show}" data-bs-parent="#${accordionId}">
      <div class="accordion-body">
        ${bodyHtml}
      </div>
    </div>
  </div>`;
        }).join('\n');

        return `<div class="accordion" id="${accordionId}">\n${itemHtml}\n</div>`;
    }
}

export default AccordionTool;
