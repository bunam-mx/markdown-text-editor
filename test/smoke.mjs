/**
 * Headless smoke tests.
 *
 * These catch the class of bug a build cannot: runtime errors and wrong DOM
 * structure when an editor is constructed. They run against the built bundle,
 * so run `npm run build` first.
 *
 * Layout is not simulated, so offsetHeight and friends are always 0. Anything
 * depending on real measurement still has to be checked in a browser.
 */
import { Window } from 'happy-dom';

const window = new Window({ url: 'http://localhost' });

// happy-dom 20 has no Popover API, and the dropdown tools call hidePopover()
// after a selection. Stub it: these tests care that the menu is built and the
// click handled, not that it is visually shown.
const proto = window.HTMLElement.prototype;
proto.showPopover ??= function () { this.setAttribute('data-open', ''); };
proto.hidePopover ??= function () { this.removeAttribute('data-open'); };

for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node',
                   'getComputedStyle', 'matchMedia', 'CustomEvent', 'Event',
                   'MutationObserver', 'requestAnimationFrame']) {
    if (window[key] === undefined) continue;
    // Node defines some of these as getter-only, so assignment alone is not enough
    Object.defineProperty(globalThis, key, {
        value: window[key], writable: true, configurable: true
    });
}

const { default: MarkdownEditor } = await import('../dist/markdown-text-editor.es.js');

let passed = 0;
const failures = [];
const check = (name, fn) => {
    try {
        const result = fn();
        if (result === true) { passed++; return; }
        failures.push(name + '\n      expected true, got ' + JSON.stringify(result));
    } catch (err) {
        failures.push(name + '\n      threw ' + err.name + ': ' + err.message);
    }
};

const ITEM = '.fj\\:me-menu-item';
const TITLE = '.fj\\:me-menu-title';

let seq = 0;
const makeEditor = (options = {}, value = '') => {
    const ta = document.createElement('textarea');
    ta.id = 'ed' + (++seq);
    ta.value = value;
    document.body.appendChild(ta);
    return new MarkdownEditor(ta, options);
};
// HeadingTool's dropdown uses the same menu classes, so scope to the popover
// that belongs to the variables button before querying items.
const varMenu = editor => editor.editorContainer.querySelector('.variable-btn')
    ?.closest('.fj\\:me-popover') ?? null;
const varItems = editor => [...(varMenu(editor)?.querySelectorAll(ITEM) ?? [])];
const labels = editor => varItems(editor).map(b => b.textContent);

const BASE_BAR = ['heading', 'bold', 'italic', 'ul', 'ol', 'checklist', 'blockquote',
                  'code', 'codeblock', 'hr', 'table', 'link', 'buttonlink', 'accordion', 'modal', 'tooltip', 'popover', 'card', 'image',
                  'undo', 'redo', 'indent', 'outdent'];
const FULL_BAR = [...BASE_BAR, 'preview'];
// variables are configured inline in the toolbar
const barWith = variables => [...BASE_BAR, { variables }, 'preview'];

const VARS = [
    { label: 'Today', value: '{{today}}', sample: '10 September 2026' },
    { label: 'Customer', items: [
        { label: 'Name',  value: '{{user}}',       sample: 'Hannes' },
        { label: 'Email', value: '{{user.email}}', sample: 'h@example.com' }
    ]},
    { label: 'Invoice No', value: '{{invoice.number}}' }
];

// --- construction -----------------------------------------------------------

check('every tool constructs without throwing', () => {
    const e = makeEditor({ toolbar: barWith(VARS) });
    return e.editorContainer.querySelectorAll('.markdown-btn').length > 0;
});

check('no variables configured renders no variable button', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    return e.editorContainer.querySelector('.variable-btn') === null;
});

check('malformed variables do not throw and keep the good entry', () => {
    const e = makeEditor({
        toolbar: barWith([null, 'garbage', { label: 'No value' }, { label: 'Empty', items: [] },
                          { label: 'Works', value: '{{ok}}' }])
    });
    return labels(e).length === 1 && labels(e)[0] === 'Works';
});

check('default toolbar shows no variable button', () => {
    const e = makeEditor({});
    return e.editorContainer.querySelector('.variable-btn') === null;
});

check('an empty inline list renders no button', () => {
    const e = makeEditor({ toolbar: barWith([]) });
    return e.editorContainer.querySelector('.variable-btn') === null;
});

check('hybrid mode constructs', () => !!makeEditor({ mode: 'hybrid', toolbar: FULL_BAR }).displayLayer);

// --- data-editor ------------------------------------------------------------

check('wrapper mirrors the textarea id', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    return e.editorContainer.dataset.editor === e.usertextarea.id;
});

check('id still resolves to the textarea, not the wrapper', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    return document.getElementById(e.usertextarea.id).tagName === 'TEXTAREA';
});

// --- variables dropdown -----------------------------------------------------

check('groups render a menu title and a nested group', () => {
    const e = makeEditor({ toolbar: barWith(VARS) });
    const menu = varMenu(e);
    const titles = [...menu.querySelectorAll(TITLE)].map(t => t.textContent);
    return titles.includes('Customer')
        && menu.querySelectorAll('ul[role="group"]').length === 1;
});

check('flat and grouped entries both appear', () => {
    const e = makeEditor({ toolbar: barWith(VARS) });
    const seen = labels(e);
    return ['Today', 'Name', 'Email', 'Invoice No'].every(l => seen.includes(l));
});

check('clicking an entry inserts its value', () => {
    const e = makeEditor({ toolbar: barWith(VARS) }, 'Hi ');
    e.usertextarea.setSelectionRange(3, 3);
    varItems(e).find(b => b.textContent === 'Invoice No').click();
    return e.usertextarea.value.includes('{{invoice.number}}');
});

check('labels are not treated as markup', () => {
    const e = makeEditor({ toolbar: barWith([{ label: '<img src=x onerror=alert(1)>', value: '{{x}}' }]) });
    const item = varItems(e)[0];
    return item.querySelector('img') === null && item.textContent.includes('<img');
});

// --- preview ----------------------------------------------------------------

check('sample replaces the variable in the preview', () => {
    const e = makeEditor({ toolbar: barWith(VARS) }, 'Hi {{user}}');
    return e.previewContent.innerHTML.includes('Hannes');
});

check('a variable without a sample stays raw', () => {
    const e = makeEditor({ toolbar: barWith(VARS) }, 'Inv {{invoice.number}}');
    return e.previewContent.innerHTML.includes('{{invoice.number}}');
});

check('a longer variable is not clobbered by a shorter prefix', () => {
    const e = makeEditor({ toolbar: barWith(VARS) }, '{{user.email}}');
    return e.previewContent.innerHTML.includes('h@example.com');
});

check('the textarea keeps the real placeholders', () => {
    const e = makeEditor({ toolbar: barWith(VARS) }, 'Hi {{user}}');
    return e.usertextarea.value === 'Hi {{user}}';
});

// --- labels -----------------------------------------------------------------

// ShortcutManager appends the shortcut, so titles read "Negrita (Ctrl+B)"
const tooltip = (editor, cls) => editor.editorContainer.querySelector(cls).title;

check('tool tooltips are translatable', () => {
    const e = makeEditor({ toolbar: FULL_BAR, labels: { Bold: 'Negrita', Table: 'Tabla' } });
    return tooltip(e, '.bold-btn').startsWith('Negrita')
        && tooltip(e, '.table-btn') === 'Tabla';
});

check('untranslated labels fall back to English', () => {
    const e = makeEditor({ toolbar: FULL_BAR, labels: { Bold: 'Negrita' } });
    return tooltip(e, '.italic-btn').startsWith('Italic');
});

check('class names stay in English so styling is unaffected', () => {
    const e = makeEditor({ toolbar: FULL_BAR, labels: { Bold: 'Negrita' } });
    return e.editorContainer.querySelector('.bold-btn') !== null;
});

check('heading menu items are translated', () => {
    const e = makeEditor({ toolbar: FULL_BAR, labels: { Heading: 'Titulo' } });
    const wrapper = e.editorContainer.querySelector('.heading-btn').closest('.fj\\:me-popover');
    return [...wrapper.querySelectorAll(ITEM)].some(b => b.textContent === 'Titulo 1');
});

// --- button link ------------------------------------------------------------

const openButtonLinkModal = editor => {
    editor.editorContainer.querySelector('.button-link-btn').click();
    return editor.editorContainer.querySelector('.markdown-modal');
};

check('button link tool renders a button', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    return e.editorContainer.querySelector('.button-link-btn') !== null;
});

check('submitting the modal inserts a bootstrap button anchor', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'Click here');
    e.usertextarea.setSelectionRange(0, 10);
    const m = openButtonLinkModal(e);
    m.querySelector('.button-link-input').value = 'https://example.com';
    m.querySelector('.button-link-text-input').value = 'Click here';
    m.querySelector('.submit-button-link').click();
    return e.usertextarea.value === '<a href="https://example.com" class="btn btn-primary" target="_blank">Click here</a>';
});

check('the variant selector changes the inserted classes', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '');
    const m = openButtonLinkModal(e);
    m.querySelector('.button-link-input').value = 'https://example.com';
    m.querySelector('.button-link-text-input').value = 'Go';
    const select = m.querySelector('.button-link-variant');
    select.value = 'btn-danger';
    m.querySelector('.submit-button-link').click();
    return e.usertextarea.value === '<a href="https://example.com" class="btn btn-danger" target="_blank">Go</a>';
});

check('selecting an existing button link prefills the modal', () => {
    const html = '<a href="https://example.com" class="btn btn-success">Go</a>';
    const e = makeEditor({ toolbar: FULL_BAR }, html);
    e.usertextarea.setSelectionRange(0, html.length);
    const m = openButtonLinkModal(e);
    return m.querySelector('.button-link-input').value === 'https://example.com'
        && m.querySelector('.button-link-text-input').value === 'Go'
        && m.querySelector('.button-link-variant').value === 'btn-success';
});

check('the inserted anchor survives the preview sanitizer', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '');
    const m = openButtonLinkModal(e);
    m.querySelector('.button-link-input').value = 'https://example.com';
    m.querySelector('.button-link-text-input').value = 'Go';
    m.querySelector('.submit-button-link').click();
    const html = e.previewContent.innerHTML;
    return html.includes('<a') && html.includes('btn btn-primary') && html.includes('https://example.com');
});

// --- accordion -------------------------------------------------------------

const openAccordionModal = editor => {
    editor.editorContainer.querySelector('.accordion-btn').click();
    return editor.editorContainer.querySelector('.accordion-modal');
};

check('accordion tool renders a button', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    return e.editorContainer.querySelector('.accordion-btn') !== null;
});

check('accordion modal opens with the body toolbar', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    const m = openAccordionModal(e);
    return m !== null
        && m.querySelector('.accordion-header-input') !== null
        && m.querySelector('.accordion-body-input') !== null
        && m.querySelector('.accordion-body-toolbar').querySelectorAll('.markdown-btn').length === 9
        && m.querySelector('.continue-accordion') !== null
        && m.querySelector('.apply-accordion') !== null;
});

check('continue clears the form for the next item', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '');
    const m = openAccordionModal(e);
    m.querySelector('.accordion-header-input').value = 'First';
    m.querySelector('.accordion-body-input').value = '**first**';
    m.querySelector('.continue-accordion').click();
    return m.querySelector('.accordion-header-input').value === ''
        && m.querySelector('.accordion-body-input').value === '';
});

check('apply inserts the bootstrap accordion html', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '');
    const m = openAccordionModal(e);
    m.querySelector('.accordion-header-input').value = 'Section 1';
    m.querySelector('.accordion-body-input').value = '**bold** text';
    m.querySelector('.apply-accordion').click();
    const v = e.usertextarea.value;
    return v.includes('<div class="accordion"')
        && v.includes('accordion-item')
        && v.includes('Section 1')
        && v.includes('<strong>bold</strong>');
});

check('multiple items are collected until apply', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '');
    const m = openAccordionModal(e);
    m.querySelector('.accordion-header-input').value = 'One';
    m.querySelector('.accordion-body-input').value = '**first**';
    m.querySelector('.continue-accordion').click();
    m.querySelector('.accordion-header-input').value = 'Two';
    m.querySelector('.accordion-body-input').value = '**second**';
    m.querySelector('.apply-accordion').click();
    const v = e.usertextarea.value;
    return v.includes('One') && v.includes('Two')
        && v.includes('<strong>first</strong>') && v.includes('<strong>second</strong>')
        && (v.match(/accordion-item/g) || []).length === 2;
});

check('the inserted accordion survives the preview sanitizer', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '');
    const m = openAccordionModal(e);
    m.querySelector('.accordion-header-input').value = 'FAQ';
    m.querySelector('.accordion-body-input').value = '**Answer**';
    m.querySelector('.apply-accordion').click();
    const html = e.previewContent.innerHTML;
    return html.includes('accordion') && html.includes('<strong>Answer</strong>');
});

// --- modal -----------------------------------------------------------------

const openModalDialog = editor => {
    editor.editorContainer.querySelector('.modal-btn').click();
    return editor.editorContainer.querySelector('.bootstrap-modal');
};

check('modal tool renders a button', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    return e.editorContainer.querySelector('.modal-btn') !== null;
});

check('modal dialog opens with the body toolbar', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    const m = openModalDialog(e);
    return m !== null
        && m.querySelector('.modal-title-input') !== null
        && m.querySelector('.modal-body-input') !== null
        && m.querySelector('.modal-body-toolbar').querySelectorAll('.markdown-btn').length === 9
        && m.querySelector('.apply-modal') !== null;
});

check('apply inserts the bootstrap modal html', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '');
    const m = openModalDialog(e);
    m.querySelector('.modal-title-input').value = 'My Modal';
    m.querySelector('.modal-body-input').value = '**bold** content';
    m.querySelector('.apply-modal').click();
    const v = e.usertextarea.value;
    return v.includes('<div class="modal fade"')
        && v.includes('modal-dialog')
        && v.includes('My Modal')
        && v.includes('<strong>bold</strong>');
});

check('the inserted modal survives the preview sanitizer', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '');
    const m = openModalDialog(e);
    m.querySelector('.modal-title-input').value = 'FAQ';
    m.querySelector('.modal-body-input').value = '**Answer**';
    m.querySelector('.apply-modal').click();
    const html = e.previewContent.innerHTML;
    return html.includes('modal') && html.includes('<strong>Answer</strong>');
});

// --- tooltip ---------------------------------------------------------------

const openTooltipDialog = editor => {
    editor.editorContainer.querySelector('.tooltip-btn').click();
    return editor.editorContainer.querySelector('.tooltip-modal');
};

check('tooltip tool renders a button', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    return e.editorContainer.querySelector('.tooltip-btn') !== null;
});

check('tooltip dialog opens with the text toolbar', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    const m = openTooltipDialog(e);
    return m !== null
        && m.querySelector('.tooltip-trigger-input') !== null
        && m.querySelector('.tooltip-text-input') !== null
        && m.querySelector('.tooltip-text-toolbar').querySelectorAll('.markdown-btn').length === 3
        && m.querySelector('.tooltip-placement') !== null
        && m.querySelector('.apply-tooltip') !== null;
});

check('apply inserts the bootstrap tooltip html', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '');
    const m = openTooltipDialog(e);
    m.querySelector('.tooltip-trigger-input').value = 'Hover me';
    m.querySelector('.tooltip-text-input').value = '**bold** tip';
    m.querySelector('.apply-tooltip').click();
    const v = e.usertextarea.value;
    return v.includes('data-toggle="tooltip"')
        && v.includes('data-html="true"')
        && v.includes('data-placement="top"')
        && v.includes('Hover me')
        && v.includes('&lt;strong&gt;bold&lt;/strong&gt;');
});

check('the placement selector changes the inserted attribute', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '');
    const m = openTooltipDialog(e);
    m.querySelector('.tooltip-trigger-input').value = 'Hover me';
    m.querySelector('.tooltip-text-input').value = 'tip';
    m.querySelector('.tooltip-placement').value = 'bottom';
    m.querySelector('.apply-tooltip').click();
    return e.usertextarea.value.includes('data-placement="bottom"');
});

check('the inserted tooltip survives the preview sanitizer', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '');
    const m = openTooltipDialog(e);
    m.querySelector('.tooltip-trigger-input').value = 'Hover me';
    m.querySelector('.tooltip-text-input').value = '**bold** tip';
    m.querySelector('.apply-tooltip').click();
    const html = e.previewContent.innerHTML;
    return html.includes('data-toggle="tooltip"') && html.includes('<strong>bold</strong>');
});

// --- popover ---------------------------------------------------------------

const openPopoverDialog = editor => {
    editor.editorContainer.querySelector('.popover-btn').click();
    return editor.editorContainer.querySelector('.popover-modal');
};

check('popover tool renders a button', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    return e.editorContainer.querySelector('.popover-btn') !== null;
});

check('popover dialog opens with the content toolbar', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    const m = openPopoverDialog(e);
    return m !== null
        && m.querySelector('.popover-trigger-input') !== null
        && m.querySelector('.popover-title-input') !== null
        && m.querySelector('.popover-content-input') !== null
        && m.querySelector('.popover-content-toolbar').querySelectorAll('.markdown-btn').length === 3
        && m.querySelector('.popover-placement') !== null
        && m.querySelector('.apply-popover') !== null;
});

check('apply inserts the bootstrap popover html', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '');
    const m = openPopoverDialog(e);
    m.querySelector('.popover-trigger-input').value = 'Click me';
    m.querySelector('.popover-title-input').value = 'My Title';
    m.querySelector('.popover-content-input').value = '**bold** content';
    m.querySelector('.apply-popover').click();
    const v = e.usertextarea.value;
    return v.includes('data-toggle="popover"')
        && v.includes('data-html="true"')
        && v.includes('data-placement="top"')
        && v.includes('data-title="My Title"')
        && v.includes('data-content=')
        && v.includes('Click me')
        && v.includes('&lt;strong&gt;bold&lt;/strong&gt;');
});

check('the placement selector changes the inserted attribute', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '');
    const m = openPopoverDialog(e);
    m.querySelector('.popover-trigger-input').value = 'Click me';
    m.querySelector('.popover-content-input').value = 'content';
    m.querySelector('.popover-placement').value = 'bottom';
    m.querySelector('.apply-popover').click();
    return e.usertextarea.value.includes('data-placement="bottom"');
});

check('the inserted popover survives the preview sanitizer', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '');
    const m = openPopoverDialog(e);
    m.querySelector('.popover-trigger-input').value = 'Click me';
    m.querySelector('.popover-content-input').value = '**bold** content';
    m.querySelector('.apply-popover').click();
    const html = e.previewContent.innerHTML;
    return html.includes('data-toggle="popover"') && html.includes('<strong>bold</strong>');
});

// --- card -------------------------------------------------------------------

const openCardDialog = editor => {
    editor.editorContainer.querySelector('.card-btn').click();
    return editor.editorContainer.querySelector('.card-modal');
};

const fillCard = (m, { img = '', title = '', text = '', btn = '' } = {}) => {
    m.querySelector('.card-img-input').value = img;
    m.querySelector('.card-title-input').value = title;
    m.querySelector('.card-text-input').value = text;
    m.querySelector('.card-btn-input').value = btn;
};

check('card tool renders a button', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    return e.editorContainer.querySelector('.card-btn') !== null;
});

check('card dialog opens with the text toolbar', () => {
    const e = makeEditor({ toolbar: FULL_BAR });
    const m = openCardDialog(e);
    return m !== null
        && m.querySelector('.card-img-input') !== null
        && m.querySelector('.card-title-input') !== null
        && m.querySelector('.card-text-input') !== null
        && m.querySelector('.card-btn-input') !== null
        && m.querySelector('.card-text-toolbar').querySelectorAll('.markdown-btn').length === 3
        && m.querySelector('.continue-card') !== null
        && m.querySelector('.apply-card') !== null;
});

check('continue clears the form for the next card', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '');
    const m = openCardDialog(e);
    fillCard(m, { title: 'First', text: '**hello**' });
    m.querySelector('.continue-card').click();
    return m.querySelector('.card-img-input').value === ''
        && m.querySelector('.card-title-input').value === ''
        && m.querySelector('.card-text-input').value === ''
        && m.querySelector('.card-btn-input').value === '';
});

check('apply inserts a single card wrapped in a row', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '');
    const m = openCardDialog(e);
    fillCard(m, { img: 'https://example.com/a.png', title: 'Solo', text: '**only**', btn: 'Go' });
    m.querySelector('.apply-card').click();
    const v = e.usertextarea.value;
    return v.includes('<div class="row"')
        && v.includes('col-sm-6 col-md-4 col-lg-3')
        && v.includes('card-img-top')
        && v.includes('Solo')
        && v.includes('<strong>only</strong>')
        && v.includes('>Go</a>');
});

check('three cards use the three-card column class', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '');
    const m = openCardDialog(e);
    fillCard(m, { title: 'A' });
    m.querySelector('.continue-card').click();
    fillCard(m, { title: 'B' });
    m.querySelector('.continue-card').click();
    fillCard(m, { title: 'C' });
    m.querySelector('.apply-card').click();
    const v = e.usertextarea.value;
    return (v.match(/accordion-item|card-item/g) || []).length === 0
        && (v.match(/class="card"/g) || []).length === 3
        && v.includes('col-sm-4 col-md-4 col-lg-3');
});

check('four cards use the four-card column class', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '');
    const m = openCardDialog(e);
    for (let i = 0; i < 3; i++) {
        fillCard(m, { title: 'C' + i });
        m.querySelector('.continue-card').click();
    }
    fillCard(m, { title: 'D' });
    m.querySelector('.apply-card').click();
    return e.usertextarea.value.includes('col-sm-6 col-md-3 col-lg-3');
});

check('five or more cards use the default column class', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '');
    const m = openCardDialog(e);
    for (let i = 0; i < 4; i++) {
        fillCard(m, { title: 'C' + i });
        m.querySelector('.continue-card').click();
    }
    fillCard(m, { title: 'E' });
    m.querySelector('.apply-card').click();
    return e.usertextarea.value.includes('col-sm-6 col-md-4 col-lg-3');
});

check('the inserted cards survive the preview sanitizer', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '');
    const m = openCardDialog(e);
    fillCard(m, { title: 'FAQ', text: '**Answer**' });
    m.querySelector('.apply-card').click();
    const html = e.previewContent.innerHTML;
    return html.includes('card') && html.includes('<strong>Answer</strong>');
});

// --- paste ------------------------------------------------------------------

const paste = (editor, { text = '', files = [] } = {}) => {
    const event = new window.Event('paste', { bubbles: true, cancelable: true });
    event.clipboardData = { getData: () => text, files, types: files.length ? ['Files'] : ['text/plain'] };
    editor.usertextarea.dispatchEvent(event);
    return event;
};

check('a bare URL pasted over a selection becomes a link', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'see the docs here');
    e.usertextarea.setSelectionRange(4, 12);      // "the docs"
    paste(e, { text: 'https://example.com' });
    return e.usertextarea.value === 'see [the docs](https://example.com) here';
});

check('a URL pasted with no selection is left to the browser', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'abc');
    e.usertextarea.setSelectionRange(3, 3);
    const event = paste(e, { text: 'https://example.com' });
    return !event.defaultPrevented && e.usertextarea.value === 'abc';
});

check('non-URL text pasted over a selection is left to the browser', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'hello world');
    e.usertextarea.setSelectionRange(0, 5);
    const event = paste(e, { text: 'not a url' });
    return !event.defaultPrevented;
});

check('a URL with spaces is not treated as a link', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, 'hello world');
    e.usertextarea.setSelectionRange(0, 5);
    const event = paste(e, { text: 'see https://example.com for more' });
    return !event.defaultPrevented;
});

check('pasting an image without an upload endpoint warns and does nothing', () => {
    let warned = '';
    const quiet = console.warn;
    console.warn = (...a) => { warned = a.join(' '); };
    const e = makeEditor({ toolbar: FULL_BAR }, '');
    const file = new window.File(['x'], 'a.png', { type: 'image/png' });
    const event = paste(e, { files: [file] });
    console.warn = quiet;
    return !event.defaultPrevented
        && e.usertextarea.value === ''
        && /no upload endpoint is configured/.test(warned);
});

// --- renderer / sanitizer ---------------------------------------------------

check('custom renderer is used', () => {
    const e = makeEditor({ toolbar: FULL_BAR, renderer: md => '<pre>' + md.toUpperCase() + '</pre>' }, 'hello');
    return e.previewContent.innerHTML.includes('HELLO');
});

check('DOMPurify still runs when only renderer is given', () => {
    const e = makeEditor({ toolbar: FULL_BAR, renderer: () => '<img src=x onerror=alert(1)>' }, 'x');
    return !e.previewContent.innerHTML.includes('onerror');
});

check('custom sanitizer is used', () => {
    const e = makeEditor({
        toolbar: FULL_BAR,
        renderer:  () => '<b>keep</b><i>strip</i>',
        sanitizer: html => html.replace('<i>strip</i>', '')
    }, 'x');
    const html = e.previewContent.innerHTML;
    return html.includes('keep') && !html.includes('strip');
});

check('script tags are stripped by default', () => {
    const e = makeEditor({ toolbar: FULL_BAR }, '<script>alert(1)</scr' + 'ipt>');
    return !/<script/i.test(e.previewContent.innerHTML);
});

// --- image upload via paste and drop ----------------------------------------

const checkAsync = async (name, fn) => {
    try {
        const result = await fn();
        if (result === true) { passed++; return; }
        failures.push(name + '\n      expected true, got ' + JSON.stringify(result));
    } catch (err) {
        failures.push(name + '\n      threw ' + err.name + ': ' + err.message);
    }
};

const UPLOAD_BAR = [...BASE_BAR, { image: { fileInput: { uploadUrl: '/api/upload' } } }, 'preview'];
const pngFile = () => new window.File(['x'], 'shot.png', { type: 'image/png' });

// Replaces fetch for one upload, and records what the editor sent
const stubUpload = (body) => {
    const sent = {};
    globalThis.fetch = async (url, init) => {
        sent.url = url;
        sent.method = init?.method;
        sent.form = init?.body;
        return { ok: true, json: async () => body };
    };
    return sent;
};

// The editor awaits fetch, so yield until the placeholder has been swapped out
const settle = async (editor) => {
    for (let i = 0; i < 20 && editor.usertextarea.value.includes('Uploading'); i++) {
        await new Promise(r => setTimeout(r, 0));
    }
};

await checkAsync('pasting an image uploads it and inserts the markdown', async () => {
    const sent = stubUpload({ success: true, image_path: '/media/shot.png', image_alt: 'A screenshot' });
    const e = makeEditor({ toolbar: UPLOAD_BAR }, '');
    paste(e, { files: [pngFile()] });
    await settle(e);
    return e.usertextarea.value === '![A screenshot](/media/shot.png)'
        && sent.url === '/api/upload' && sent.method === 'POST';
});

await checkAsync('a placeholder is shown while the upload is in flight', async () => {
    let release;
    globalThis.fetch = () => new Promise(r => { release = r; });
    const e = makeEditor({ toolbar: UPLOAD_BAR }, '');
    paste(e, { files: [pngFile()] });
    const during = e.usertextarea.value;
    release({ ok: true, json: async () => ({ success: true, image_path: '/m/a.png' }) });
    await settle(e);
    return during.includes('Uploading...') && e.usertextarea.value === '![](/m/a.png)';
});

await checkAsync('a failed upload leaves a visible marker, not silence', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
    const quiet = console.error; console.error = () => {};
    const e = makeEditor({ toolbar: UPLOAD_BAR }, 'before');
    paste(e, { files: [pngFile()] });
    await settle(e);
    console.error = quiet;
    return e.usertextarea.value === 'before![Upload failed]()';
});

await checkAsync('the failure marker is translatable', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
    const quiet = console.error; console.error = () => {};
    const e = makeEditor({ toolbar: UPLOAD_BAR, labels: { 'Upload failed': 'Fallo la subida' } }, '');
    paste(e, { files: [pngFile()] });
    await settle(e);
    console.error = quiet;
    return e.usertextarea.value === '![Fallo la subida]()';
});

const drop = (editor, files) => {
    const event = new window.Event('drop', { bubbles: true, cancelable: true });
    event.dataTransfer = { files, types: files.length ? ['Files'] : [] };
    editor.usertextarea.dispatchEvent(event);
    return event;
};

await checkAsync('a file drop is swallowed even with no upload configured', async () => {
    const quiet = console.warn; console.warn = () => {};
    const e = makeEditor({ toolbar: FULL_BAR }, 'my draft');
    const event = drop(e, [pngFile()]);
    console.warn = quiet;
    // Without preventDefault the browser would navigate to the file and lose the draft
    return event.defaultPrevented && e.usertextarea.value === 'my draft';
});

await checkAsync('a non-image file drop is swallowed too', async () => {
    const e = makeEditor({ toolbar: UPLOAD_BAR }, 'my draft');
    const pdf = new window.File(['x'], 'a.pdf', { type: 'application/pdf' });
    const event = drop(e, [pdf]);
    return event.defaultPrevented && e.usertextarea.value === 'my draft';
});

await checkAsync('dropping an image uploads it too', async () => {
    stubUpload({ success: true, image_path: '/media/dropped.png' });
    const e = makeEditor({ toolbar: UPLOAD_BAR }, '');
    drop(e, [pngFile()]);
    await settle(e);
    return e.usertextarea.value === '![](/media/dropped.png)';
});

await checkAsync('the upload placeholder is translatable', async () => {
    let release;
    globalThis.fetch = () => new Promise(r => { release = r; });
    const e = makeEditor({ toolbar: UPLOAD_BAR, labels: { 'Uploading...': 'Subiendo...' } }, '');
    paste(e, { files: [pngFile()] });
    const during = e.usertextarea.value;
    release({ ok: true, json: async () => ({ success: true, image_path: '/m/a.png' }) });
    await settle(e);
    return during.includes('Subiendo...');
});

// --- report -----------------------------------------------------------------

console.log('\n  ' + passed + ' passed, ' + failures.length + ' failed\n');
if (failures.length) {
    failures.forEach(f => console.log('  FAIL  ' + f + '\n'));
    process.exit(1);
}
