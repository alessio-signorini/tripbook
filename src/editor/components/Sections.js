import { useRef, useEffect, useState } from 'preact/hooks';
import { html } from './html.js';
import { structural, updateTrip, confirmDialog, navigate } from '../state/index.js';
import { StopCard } from './StopCard.js';
import { Menu, AutoTextarea } from './controls.js';
import { moveSection, moveStop, deleteSection } from '../core/editing.js';
import { sectionLetter, plural } from '../../shared/format.js';

const SORTABLE_OPTIONS = {
  animation: 150,
  forceFallback: true,
  fallbackOnBody: true,
  delay: 150,
  delayOnTouchOnly: true,
  scroll: true,
  bubbleScroll: true,
  ghostClass: 'sortable-ghost',
  chosenClass: 'sortable-chosen',
  dragClass: 'sortable-drag',
};

/** Sortable mutates the DOM, so put the dragged node back first and let Preact re-render from state. */
function revertDom({ item, from, oldIndex }) {
  item.remove();
  from.insertBefore(item, from.children[oldIndex] ?? null);
}

/** Attach SortableJS to `ref`. The library is a separate chunk, loaded on first use. */
function useSortable(ref, options) {
  const latest = useRef(options);
  latest.current = options;
  useEffect(() => {
    let sortable = null;
    let cancelled = false;
    import('sortablejs').then(({ default: Sortable }) => {
      if (cancelled || !ref.current) return;
      sortable = Sortable.create(ref.current, { ...SORTABLE_OPTIONS, ...options, onEnd: (evt) => latest.current.onEnd(evt) });
    });
    return () => {
      cancelled = true;
      sortable?.destroy();
    };
  }, []);
}

export function SectionsSortable({ tripId, reorder, children }) {
  const ref = useRef();
  useSortable(ref, {
    group: 'sections',
    handle: '.drag-section',
    draggable: '.section-card',
    onEnd(evt) {
      revertDom(evt);
      const id = evt.item.dataset.id;
      structural(tripId, 'Moved.', (t) => moveSection(t, id, evt.newDraggableIndex));
    },
  });
  return html`<div ref=${ref} class=${reorder ? 'reorder' : ''}>${children}</div>`;
}

function StopsSortable({ tripId, sectionId, children }) {
  const ref = useRef();
  useSortable(ref, {
    group: 'stops',
    handle: '.drag-stop',
    draggable: '.stop-card',
    onEnd(evt) {
      revertDom(evt);
      const id = evt.item.dataset.id;
      const to = evt.to.dataset.section;
      structural(tripId, 'Moved.', (t) => moveStop(t, id, to, evt.newDraggableIndex));
    },
  });
  return html`<ul class="stop-list" ref=${ref} data-section=${sectionId}>${children}</ul>`;
}

/** One section: head (letter, title, style, count, collapse, menu), note, sortable stops, Add stop. */
export function SectionCard({ trip, entry, index, reorder }) {
  const { section } = entry;
  const [collapsed, setCollapsed] = useState(false);
  const [noteFocus, setNoteFocus] = useState(false);
  const set = (patch) => updateTrip(trip.id, (t) => Object.assign(t.sections.find((s) => s.id === section.id), patch));
  const isRoute = section.style === 'route';

  async function remove() {
    if (section.stops.length && !(await confirmDialog({ title: 'Delete section', message: `Delete this section and its ${section.stops.length} stops?`, confirmLabel: 'Delete', danger: true }))) return;
    structural(trip.id, 'Section deleted.', (t) => deleteSection(t, section.id));
  }

  return html`<section class="section-card" data-id=${section.id}>
    <div class="section-head">
      <span class="drag drag-section" aria-hidden="true">⠿</span>
      <span class="letter">${sectionLetter(index)}</span>
      <input class="title" type="text" placeholder="Section title" aria-label="Section title" value=${section.title} onInput=${(e) => set({ title: e.target.value })} />
      <div class="segmented" role="group" aria-label="Section style">
        <button type="button" aria-pressed=${isRoute} onClick=${() => set({ style: 'route' })}>Route</button>
        <button type="button" aria-pressed=${section.style === 'list'} onClick=${() => set({ style: 'list' })}>List</button>
      </div>
      <span class="hint">${plural(section.stops.length, 'stop')}</span>
      <button type="button" class="icon-btn" aria-label=${collapsed ? 'Expand section' : 'Collapse section'} aria-expanded=${!collapsed} onClick=${() => setCollapsed(!collapsed)}>${collapsed ? '▸' : '▾'}</button>
      <${Menu} label="Section actions">
        <button role="menuitem" disabled=${index === 0} onClick=${() => structural(trip.id, 'Moved.', (t) => moveSection(t, section.id, index - 1))}>Move up</button>
        <button role="menuitem" disabled=${index === trip.sections.length - 1} onClick=${() => structural(trip.id, 'Moved.', (t) => moveSection(t, section.id, index + 1))}>Move down</button>
        <button role="menuitem" class="danger" onClick=${remove}>Delete section</button>
      <//>
    </div>
    ${!collapsed && html`<div class="section-note">
      <${AutoTextarea} minRows=${1} placeholder="Section note (Markdown)" aria-label="Section note" value=${section.note} onInput=${(note) => set({ note })} onFocus=${() => setNoteFocus(true)} onBlur=${() => setNoteFocus(false)} class=${noteFocus || !section.note ? '' : 'folded'} />
    </div>
    <${StopsSortable} tripId=${trip.id} sectionId=${section.id}>
      ${entry.stops.map((e) => html`<${StopCard} key=${e.stop.id} tripId=${trip.id} stop=${e.stop} label=${e.label} reorder=${reorder} isRoute=${isRoute} />`)}
    <//>
    <div class="add-row"><button type="button" class="btn btn-small" onClick=${() => navigate(`#/capture/${trip.id}~${section.id}`)}>Add stop</button></div>`}
  </section>`;
}
