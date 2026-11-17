// Which focused element keeps the letters of the computer keyboard for itself. Only where one types text: a
// slider, a list, a checkbox or a button clicked a moment ago (the track's position, "In time with", the file
// picker after choosing a track) must not take the piano's keys away until the page is clicked again.

const NOT_TEXT = new Set(['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'color', 'image']);

/** `t` is a place where one types text (a text field, a text area, an editable area). */
export function typesText(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') return !NOT_TEXT.has(((el as HTMLInputElement).type || 'text').toLowerCase());
  return false;
}

/** `t` uses the arrow keys itself (a slider, a list): they are not shortcuts there. */
export function usesArrows(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'SELECT' || (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'range'));
}
