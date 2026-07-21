// ============================================================
//  NOTES — kartu catatan portofolio (tulis / ubah / hapus)
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
      timeZone: 'Asia/Makassar',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }) + ' WITA';
  } catch { return ''; }
}

export async function loadNotes() {
  if (!state.user) { state.notes = []; renderNotes(); return; }
  try {
    state.notes = await fetchNotes(state.user.uid);
  } catch (e) {
    console.warn('notes load:', e.message);
    state.notes = [];
  }
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
        <textarea class="note-edit-input" id="note-edit-${safeId(n.id)}" rows="4">${escapeHtml(n.text)}</textarea>
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
      <p class="note-text">${escapeHtml(n.text)}</p>
      <div class="note-foot">
        <span class="note-stamp">${escapeHtml(stamp)}</span>
        <div class="note-actions">
          <button type="button" class="btn btn-sm" data-action="note-edit" data-id="${id}" title="${escapeHtml(t('notes.edit'))}" aria-label="${escapeHtml(t('notes.edit'))}"><i class="fa fa-pen"></i></button>
          <button type="button" class="btn btn-sm btn-danger" data-action="note-del" data-id="${id}" title="${escapeHtml(t('notes.delete'))}" aria-label="${escapeHtml(t('notes.delete'))}"><i class="fa fa-trash"></i></button>
        </div>
      </div>
    </article>`;
  }).join('');
}

export async function handleAddNote() {
  if (!state.user) return showAlert(t('notes.guest'), t('common.notLoggedInTitle'));
  const input = $('note-input');
  const text = (input?.value || '').trim();
  if (!text) return showAlert(t('notes.emptyText'));
  try {
    await createNote(state.user.uid, text);
  } catch (e) {
    return showAlert(e.message || String(e), t('notes.title'));
  }
  input.value = '';
  await loadNotes();
}

export function startEditNote(id) {
  state.editingNoteId = String(id);
  renderNotes();
  const el = document.getElementById('note-edit-' + safeId(id));
  if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
}

export function cancelEditNote() {
  state.editingNoteId = null;
  renderNotes();
}

export async function handleSaveNote(id) {
  if (!state.user) return showAlert(t('notes.guest'), t('common.notLoggedInTitle'));
  const el = document.getElementById('note-edit-' + safeId(id));
  const text = (el?.value || '').trim();
  if (!text) return showAlert(t('notes.emptyText'));
  try {
    await updateNote(state.user.uid, id, text);
  } catch (e) {
    return showAlert(e.message || String(e), t('notes.title'));
  }
  state.editingNoteId = null;
  await loadNotes();
}

export async function handleDeleteNote(id) {
  if (!state.user) return showAlert(t('notes.guest'), t('common.notLoggedInTitle'));
  const ok = await showConfirm(t('notes.confirmDelete'), t('notes.confirmTitle'), 'danger');
  if (!ok) return;
  try {
    await deleteNote(state.user.uid, id);
  } catch (e) {
    return showAlert(e.message || String(e), t('notes.title'));
  }
  if (state.editingNoteId === String(id)) state.editingNoteId = null;
  await loadNotes();
}
