import MakeTool from '../MakeTool.js';
import BoldTool from './BoldTool.js';
import ItalicTool from './ItalicTool.js';
import StrikethroughTool from './StrikethroughTool.js';

const escapeAttr = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

class CardTool extends MakeTool {
    constructor(editor) {
        super(editor, 'Card');
        this.button = this.createButton(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16"/><path d="M9 14h6"/></svg>
        `);
    }

    getColumnClass(count) {
        if (count <= 2) return 'col-sm-6 col-md-4 col-lg-3';
        if (count === 3) return 'col-sm-4 col-md-4 col-lg-3';
        if (count === 4) return 'col-sm-6 col-md-3 col-lg-3';
        return 'col-sm-6 col-md-4 col-lg-3';
    }

    // Insert a Bootstrap Cards component built from the collected items
    applySyntax(event) {
        const editor = this.editor;
        const wrapper = editor.editorContainer;

        wrapper.querySelector('.card-modal')?.remove();

        const bodyHTML = `
            <div class="fj:flex fj:justify-between fj:items-center fj:gap-3">
                <div class="fj:font-medium">${editor.label('Card')}</div>
                <button type="button" class="modal-close-btn fj:me-btn fj:me-btn-ghost fj:me-btn-xs fj:me-btn-circle" aria-label="${editor.label('Close')}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            </div>
            <div class="fj:mt-4 fj:flex fj:flex-col fj:gap-y-4">
                <input type="url" class="card-img-input fj:me-input fj:w-full" placeholder="${editor.label('Image URL')}">
                <input type="text" class="card-title-input fj:me-input fj:w-full" placeholder="${editor.label('Card title')}">
                <div>
                    <div class="card-text-toolbar fj:flex fj:items-center fj:gap-x-1 fj:p-1 fj:border fj:border-base-soft fj:rounded fj:mb-1"></div>
                    <textarea class="card-text-input fj:me-input fj:w-full" rows="3" placeholder="${editor.label('Card text')}"></textarea>
                </div>
                <input type="text" class="card-btn-input fj:me-input fj:w-full" placeholder="${editor.label('Button text')}">
                <div class="fj:flex fj:justify-end fj:gap-2">
                    <button type="button" class="continue-card fj:me-btn fj:me-btn-sm">${editor.label('Continue')}</button>
                    <button type="button" class="apply-card fj:me-btn fj:me-btn-sm fj:me-btn-primary">${editor.label('Apply')}</button>
                </div>
            </div>`;

        wrapper.insertAdjacentHTML('beforeend', `
            <dialog class="card-modal fj:me-modal fj:me-modal-top fj:lg:me-modal-middle fj:me-modal-center" aria-label="${editor.label('Card')}">
                <div class="fj:me-modal-content fj:max-w-lg">
                    ${bodyHTML}
                </div>
            </dialog>
        `);

        const dialog = wrapper.querySelector('.card-modal');
        dialog.addEventListener('close', () => dialog.remove());
        dialog.showModal();

        const imgInput = dialog.querySelector('.card-img-input');
        const titleInput = dialog.querySelector('.card-title-input');
        const textTextarea = dialog.querySelector('.card-text-input');
        const btnInput = dialog.querySelector('.card-btn-input');
        const toolbarContainer = dialog.querySelector('.card-text-toolbar');

        // The card text reuses the real toolbar tools through a lightweight
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

        const items = [];
        const collectCurrent = () => {
            const img = imgInput.value.trim();
            const title = titleInput.value.trim();
            const text = textTextarea.value.trim();
            const btn = btnInput.value.trim();
            if (img || title || text || btn) items.push({ img, title, text, btn });
        };
        const clearForm = () => {
            imgInput.value = '';
            titleInput.value = '';
            textTextarea.value = '';
            btnInput.value = '';
            imgInput.focus();
        };

        dialog.querySelector('.modal-close-btn').addEventListener('click', () => dialog.close());

        dialog.querySelector('.continue-card').addEventListener('click', () => {
            collectCurrent();
            clearForm();
        });

        dialog.querySelector('.apply-card').addEventListener('click', () => {
            collectCurrent();
            if (items.length) {
                editor.insertText(this.buildCardsHtml(items, editor));
            }
            dialog.close();
        });
    }

    buildCardsHtml(items, editor) {
        const colClass = this.getColumnClass(items.length);

        const cardHtml = items.map(item => {
            const img = item.img ? `\n    <img src="${escapeAttr(item.img)}" class="card-img-top" alt="${escapeAttr(item.title)}">` : '';
            const title = item.title ? `\n      <h5 class="card-title">${escapeHtml(item.title)}</h5>` : '';
            const text = item.text ? `\n      <p class="card-text">${editor._renderMarkdown(item.text)}</p>` : '';
            const btn = item.btn ? `\n      <a href="#" class="btn btn-primary">${escapeHtml(item.btn)}</a>` : '';
            return `
  <div class="${colClass}">
    <div class="card">${img}
      <div class="card-body">${title}${text}${btn}
      </div>
    </div>
  </div>`;
        }).join('\n');

        return `<div class="row">\n${cardHtml}\n</div>`;
    }
}

export default CardTool;
