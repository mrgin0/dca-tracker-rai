// ============================================================
//  NOTES — jurnal rich-text (tulis / ubah / hapus)
//  Tersimpan di Firestore: users/{uid}/notes/{id}
// ============================================================

import { state } from './state.js?v=10';
import { t, locale } from './i18n.js?v=10';
import { escapeHtml, safeId, showAlert, showConfirm } from './utils.js?v=10';
import { fetchNotes, createNote, updateNote, deleteNote } from './store.js?v=10';

const $ = (id) => document.getElementById(id);

function fmtNoteTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(locale(), {
      timeZone: 'Asia/Makassar', day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }) + ' WITA';
  } catch { return ''; }
}

function sanitizeRichHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html || ''), 'text/html');
  const blocked = 'script,style,iframe,object,embed,form,input,textarea,button,select,option,meta,link';
  doc.body.querySelectorAll(blocked).forEach((el) => el.remove());
  doc.body.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value || '';
      if (name.startsWith('on') || name === 'srcdoc') el.removeAttribute(attr.name);
      else if (name === 'href' && !/^(https?:|mailto:|tel:|#)/i.test(value)) el.removeAttribute(attr.name);
      else if (name === 'src' && !/^(https?:|data:image\/(?:png|jpe?g|gif|webp);)/i.test(value)) el.removeAttribute(attr.name);
      else if (!['href','src','alt','title','target','rel','style','class'].includes(name)) el.removeAttribute(attr.name);
    });
    if (el.tagName === 'A' && el.getAttribute('target') === '_blank') el.setAttribute('rel', 'noopener noreferrer');
  });
  return doc.body.innerHTML;
}

function plainTextFromHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = sanitizeRichHtml(html);
  return (div.textContent || div.innerText || '').replace(/\u00a0/g, ' ').trim();
}

function looksLikeHtml(value) {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ''));
}

function noteBodyHtml(value) {
  if (!looksLikeHtml(value)) return escapeHtml(String(value || '')).replace(/\n/g, '<br>');
  return sanitizeRichHtml(value);
}

function editorValue(el) {
  return sanitizeRichHtml(el?.innerHTML || '');
}

function restoreSelection() {
  const editor = $('note-input');
  if (!editor) return;
  editor.focus();
}

function insertTable(editor) {
  if (!editor) return;
  const rowsRaw = window.prompt('Jumlah baris tabel:', '3');
  if (rowsRaw === null) return;
  const colsRaw = window.prompt('Jumlah kolom tabel:', '3');
  if (colsRaw === null) return;
  const rows = Math.min(20, Math.max(1, Number.parseInt(rowsRaw, 10) || 3));
  const cols = Math.min(10, Math.max(1, Number.parseInt(colsRaw, 10) || 3));
  const head = `<thead><tr>${Array.from({ length: cols }, () => '<th>Header</th>').join('')}</tr></thead>`;
  const body = Array.from({ length: Math.max(0, rows - 1) }, () =>
    `<tr>${Array.from({ length: cols }, () => '<td>Isi</td>').join('')}</tr>`
  ).join('');
  document.execCommand('insertHTML', false, `<table class="note-table">${head}<tbody>${body}</tbody></table><p><br></p>`);
}


function runEditorCommand(command, value = null) {
  restoreSelection();
  if (command === 'createLink' || command === 'insertImage') {
    const promptText = command === 'createLink' ? 'Masukkan URL tautan:' : 'Masukkan URL gambar:';
    const url = window.prompt(promptText, 'https://');
    if (!url) return;
    document.execCommand(command, false, url.trim());
  } else if (command === 'insertTable') {
    insertTable($('note-input'));
  } else {
    document.execCommand(command, false, value);
  }
  const editor = $('note-input');
  if (editor) editor.dispatchEvent(new Event('input', { bubbles: true }));
}

export function initNoteEditor() {
  const root = $('note-editor');
  if (!root || root.dataset.ready === '1') return;
  root.dataset.ready = '1';
  root.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('[data-command]');
    if (btn && btn.tagName === 'BUTTON') e.preventDefault();
  });
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-command]');
    if (!btn) return;
    runEditorCommand(btn.dataset.command, btn.dataset.value || null);
  });
  root.addEventListener('change', (e) => {
    const select = e.target.closest('select[data-command]');
    if (!select) return;
    runEditorCommand(select.dataset.command, select.value);
  });
  const editor = $('note-input');
  editor?.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'enter') {
      e.preventDefault();
      $('note-add')?.click();
    }
  });
}

function renderEditEditor(note) {
  const html = noteBodyHtml(note.text);
  return `<div class="rich-editor rich-editor-inline" id="note-edit-editor-${safeId(note.id)}">
    <div class="rich-toolbar" role="toolbar" aria-label="Format catatan">
      <select class="rich-select" data-edit-command="fontName" aria-label="Font"><option value="Inter">Sans Serif</option><option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Courier New">Courier New</option></select>
      <select class="rich-select rich-size" data-edit-command="fontSize" aria-label="Ukuran"><option value="2">12pt</option><option value="1">10pt</option><option value="3">14pt</option><option value="4">16pt</option><option value="5">18pt</option><option value="6">24pt</option></select>
      <select class="rich-select rich-format" data-edit-command="formatBlock" aria-label="Paragraf"><option value="p">Paragraph</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="blockquote">Quote</option></select>
      <span class="rich-divider"></span>
      <button type="button" class="rich-btn" data-edit-command="bold" title="Bold"><i class="fa-solid fa-bold"></i></button>
      <button type="button" class="rich-btn" data-edit-command="italic" title="Italic"><i class="fa-solid fa-italic"></i></button>
      <button type="button" class="rich-btn" data-edit-command="underline" title="Underline"><i class="fa-solid fa-underline"></i></button>
      <button type="button" class="rich-btn" data-edit-command="strikeThrough" title="Coret"><i class="fa-solid fa-strikethrough"></i></button>
      <button type="button" class="rich-btn" data-edit-command="removeFormat" title="Hapus format"><i class="fa-solid fa-eraser"></i></button>
      <button type="button" class="rich-btn" data-edit-command="justifyLeft" title="Rata kiri"><i class="fa-solid fa-align-left"></i></button>
      <button type="button" class="rich-btn" data-edit-command="justifyCenter" title="Rata tengah"><i class="fa-solid fa-align-center"></i></button>
      <button type="button" class="rich-btn" data-edit-command="justifyRight" title="Rata kanan"><i class="fa-solid fa-align-right"></i></button>
      <button type="button" class="rich-btn" data-edit-command="insertUnorderedList" title="Bullet"><i class="fa-solid fa-list-ul"></i></button>
      <button type="button" class="rich-btn" data-edit-command="insertOrderedList" title="Nomor"><i class="fa-solid fa-list-ol"></i></button>
      <button type="button" class="rich-btn" data-edit-command="createLink" title="Tautan"><i class="fa-solid fa-link"></i></button>
      <button type="button" class="rich-btn" data-edit-command="insertTable" title="Tabel"><i class="fa-solid fa-table"></i></button>
      <button type="button" class="rich-btn" data-edit-command="undo" title="Undo"><i class="fa-solid fa-rotate-left"></i></button>
      <button type="button" class="rich-btn" data-edit-command="redo" title="Redo"><i class="fa-solid fa-rotate-right"></i></button>
    </div>
    <div class="rich-input note-edit-input" id="note-edit-${safeId(note.id)}" contenteditable="true" role="textbox" aria-multiline="true">${html}</div>
  </div>`;
}

export async function loadNotes() {
  if (!state.user) { state.notes = []; renderNotes(); return; }
  try { state.notes = await fetchNotes(state.user.uid); }
  catch (e) { console.warn('notes load:', e.message); state.notes = []; }
  renderNotes();
}

export function renderNotes() {
  const list = $('note-list');
  const count = $('note-count');
  if (!list) return;

  if (count) count.textContent = state.notes.length === 1 ? t('notes.count1') : t('notes.count', { n: state.notes.length });
  if (!state.user) {
    list.innerHTML = `<div class="empty"><i class="fa-regular fa-pen-to-square"></i>${escapeHtml(t('notes.guest'))}</div>`;
    return;
  }
  if (!state.notes.length) {
    list.innerHTML = `<div class="empty"><i class="fa-regular fa-pen-to-square"></i>${escapeHtml(t('notes.empty'))}</div>`;
    return;
  }

  list.innerHTML = state.notes.map((n) => {
    const id = escapeHtml(n.id);
    const stamp = n.updatedAt && n.updatedAt !== n.createdAt
      ? t('notes.updated', { at: fmtNoteTime(n.updatedAt) })
      : t('notes.created', { at: fmtNoteTime(n.createdAt) });

    if (state.editingNoteId === n.id) {
      return `<article class="note-card editing">
        ${renderEditEditor(n)}
        <div class="note-foot">
          <span class="note-stamp">${escapeHtml(stamp)}</span>
          <div class="note-actions">
            <button type="button" class="btn btn-sm" data-action="note-cancel">${escapeHtml(t('notes.cancel'))}</button>
            <button type="button" class="btn btn-sm btn-primary" data-action="note-save" data-id="${id}">${escapeHtml(t('notes.save'))}</button>
          </div>
        </div>
      </article>`;
    }

    return `<article class="note-card">
      <div class="note-text rich-content">${noteBodyHtml(n.text)}</div>
      <div class="note-foot">
        <span class="note-stamp">${escapeHtml(stamp)}</span>
        <div class="note-actions">
          <button type="button" class="btn btn-sm" data-action="note-edit" data-id="${id}" title="${escapeHtml(t('notes.edit'))}" aria-label="${escapeHtml(t('notes.edit'))}"><i class="fa fa-pen"></i></button>
          <button type="button" class="btn btn-sm btn-danger" data-action="note-del" data-id="${id}" title="${escapeHtml(t('notes.delete'))}" aria-label="${escapeHtml(t('notes.delete'))}"><i class="fa fa-trash"></i></button>
        </div>
      </div>
    </article>`;
  }).join('');

  if (state.editingNoteId) {
    const editor = document.getElementById('note-edit-' + safeId(state.editingNoteId));
    if (editor) editor.focus();
    bindInlineEditor(editor?.closest('.rich-editor-inline'));
  }
}

function bindInlineEditor(root) {
  if (!root || root.dataset.ready === '1') return;
  root.dataset.ready = '1';
  root.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('[data-edit-command]');
    if (btn && btn.tagName === 'BUTTON') e.preventDefault();
  });
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-edit-command]');
    if (!btn) return;
    const editor = root.querySelector('.rich-input');
    editor?.focus();
    const command = btn.dataset.editCommand;
    if (command === 'createLink') {
      const url = window.prompt('Masukkan URL tautan:', 'https://');
      if (url) document.execCommand(command, false, url.trim());
    } else if (command === 'insertTable') {
      insertTable(editor);
    } else document.execCommand(command, false, btn.dataset.value || null);
  });
  root.addEventListener('change', (e) => {
    const select = e.target.closest('select[data-edit-command]');
    if (!select) return;
    const editor = root.querySelector('.rich-input');
    editor?.focus();
    document.execCommand(select.dataset.editCommand, false, select.value);
  });
}

export async function handleAddNote() {
  if (!state.user) return showAlert(t('notes.guest'), t('common.notLoggedInTitle'));
  const input = $('note-input');
  const html = editorValue(input);
  if (!plainTextFromHtml(html)) return showAlert(t('notes.emptyText'));
  try { await createNote(state.user.uid, html); }
  catch (e) { return showAlert(e.message || String(e), t('notes.title')); }
  input.innerHTML = '';
  await loadNotes();
}

export function startEditNote(id) {
  state.editingNoteId = String(id);
  renderNotes();
}

export function cancelEditNote() {
  state.editingNoteId = null;
  renderNotes();
}

export async function handleSaveNote(id) {
  if (!state.user) return showAlert(t('notes.guest'), t('common.notLoggedInTitle'));
  const el = document.getElementById('note-edit-' + safeId(id));
  const html = editorValue(el);
  if (!plainTextFromHtml(html)) return showAlert(t('notes.emptyText'));
  try { await updateNote(state.user.uid, id, html); }
  catch (e) { return showAlert(e.message || String(e), t('notes.title')); }
  state.editingNoteId = null;
  await loadNotes();
}

export async function handleDeleteNote(id) {
  if (!state.user) return showAlert(t('notes.guest'), t('common.notLoggedInTitle'));
  const ok = await showConfirm(t('notes.confirmDelete'), t('notes.confirmTitle'), 'danger');
  if (!ok) return;
  try { await deleteNote(state.user.uid, id); }
  catch (e) { return showAlert(e.message || String(e), t('notes.title')); }
  if (state.editingNoteId === String(id)) state.editingNoteId = null;
  await loadNotes();
}
