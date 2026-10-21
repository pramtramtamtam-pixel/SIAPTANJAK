function fields(form: HTMLFormElement) { return (Array.from(form.querySelectorAll('input,select,textarea')) as unknown as (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[]).filter(el => !el.closest('[data-dirty-ignore]') && !['submit', 'button', 'reset'].includes(el.type)); }
export function formSnapshot(form: HTMLFormElement) {
    return JSON.stringify(fields(form).map(el => {
        const input = el as HTMLInputElement, select = el as HTMLSelectElement;
        const value = ['checkbox', 'radio'].includes(el.type) ? input.checked : el.type === 'file' ? Array.from(input.files || []).map(file => [file.name, file.size, file.lastModified]) : select.multiple ? Array.from(select.selectedOptions).map(option => option.value) : el.value;
        return [el.getAttribute('name') || el.id || el.getAttribute('data-form-state') || '', el.type, value];
    }));
}
/** Compare saved field values, including changes made by map and checklist widgets. */
export function watchFormChanges(root: HTMLElement, onDirty: (form: HTMLFormElement, dirty: boolean) => void) {
    const baselines = new WeakMap<HTMLFormElement, string>(), engaged = new Set<HTMLFormElement>(), known = new Set<HTMLFormElement>();
    const register = () => { for (const form of known) {
        if (!root.contains(form)) {
            known.delete(form);
            engaged.delete(form);
        }
    } root.querySelectorAll('form').forEach(form => { if (!known.has(form)) {
        known.add(form);
        baselines.set(form, formSnapshot(form));
    } }); };
    const formOf = (event: Event) => (event.target as HTMLElement)?.closest?.('form') as HTMLFormElement | null;
    const check = (form: HTMLFormElement) => { if (root.contains(form) && baselines.has(form))
        onDirty(form, formSnapshot(form) !== baselines.get(form)); };
    const prepare = (event: Event) => { const form = formOf(event); if (!form || !root.contains(form))
        return; if (!engaged.has(form))
        baselines.set(form, formSnapshot(form)); known.add(form); engaged.add(form); };
    const change = (event: Event) => { const form = formOf(event); if (!form || !root.contains(form))
        return; if (!baselines.has(form))
        baselines.set(form, formSnapshot(form)); known.add(form); engaged.add(form); check(form); };
    const reset = () => { register(); for (const form of known) {
        if (root.contains(form)) {
            baselines.set(form, formSnapshot(form));
            onDirty(form, false);
        }
    } engaged.clear(); };
    register();
    const observer = new MutationObserver(() => { register(); for (const form of engaged) {
        if (root.contains(form))
            check(form);
        else {
            engaged.delete(form);
            known.delete(form);
        }
    } });
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['value', 'checked', 'selected'] });
    root.addEventListener('focusin', prepare, true);
    root.addEventListener('pointerdown', prepare, true);
    root.addEventListener('input', change, true);
    root.addEventListener('change', change, true);
    window.addEventListener('siap-form-saved', reset);
    return () => { observer.disconnect(); engaged.clear(); known.clear(); root.removeEventListener('focusin', prepare, true); root.removeEventListener('pointerdown', prepare, true); root.removeEventListener('input', change, true); root.removeEventListener('change', change, true); window.removeEventListener('siap-form-saved', reset); };
}
