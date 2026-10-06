const $ = id => document.getElementById(id);
const { parseValue, formatValue, sortRows } = ClientData;
const state = { database: null, table: null, tab: 'rows', columns: [], rows: [], sort: null };
let generation = 0, busy = false;
function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
}
function button(text, action, className) {
    const node = element('button', text, className);
    node.type = 'button';
    node.disabled = busy;
    node.onclick = () => run(action);
    return node;
}
function errorMessage(error) { $('message').textContent = error.message; $('message').hidden = false; }
async function run(action) {
    if (busy) return;
    $('message').hidden = true;
    try { await action(); } catch (error) { errorMessage(error); }
}
async function request(endpoint, method = 'GET', body = null) {
    let result;
    try { result = await window.databaseClient.request(endpoint, method, body); }
    catch { $('connectionStatus').textContent = 'Disconnected'; throw new Error('Could not connect to localhost:18080. Start the server and click Refresh.'); }
    $('connectionStatus').textContent = 'Connected · localhost:18080';
    if (!result.ok) throw new Error(`${result.status}: ${result.body?.message || result.body || result.statusText}`);
    return result.body;
}
function databasePath() { return `/databases/${encodeURIComponent(state.database)}`; }
function tablePath() { return `${databasePath()}/tables/${encodeURIComponent(state.table)}`; }
function navigate(database = null, table = null) {
    state.database = database; state.table = table; state.tab = 'rows'; state.sort = null;
    state.columns = []; state.rows = [];
    return refresh();
}
function shell() {
    const nav = $('breadcrumbs'); nav.replaceChildren(button('Databases', () => navigate()));
    if (state.database) nav.append(element('span', '/'), button(state.database, () => navigate(state.database)));
    if (state.table) nav.append(element('span', '/'), element('span', state.table));
    $('title').textContent = state.table || state.database || 'Databases';
    $('subtitle').textContent = state.table ? 'Table records and structure' : state.database ? 'Select a table to work with its records' : 'Select a database to work with its tables';
    $('toolbar').replaceChildren(); $('content').replaceChildren(element('p', 'Loading…'));
}
async function refresh() {
    const token = ++generation;
    shell();
    try {
        if (!state.database) {
            const data = await request('/databases');
            if (token !== generation) return;
            $('toolbar').append(button('Create database', () => nameEditor('Create database', '', name => mutate(`/databases/${encodeURIComponent(name)}`, 'POST')), 'primary'), button('Import database', importNew));
            cards(data.databases, name => navigate(name), (actions, name) => {
                actions.append(button('Export', () => exportDatabase(name)), button('Replace from file', () => replaceDatabase(name)), button('Delete', () => remove(`/databases/${encodeURIComponent(name)}`, `Delete database "${name}" and all its tables?`), 'danger'));
            });
        } else if (!state.table) {
            const data = await request(`${databasePath()}/tables`);
            if (token !== generation) return;
            $('toolbar').append(button('Create table', () => nameEditor('Create table', '', name => mutate(`${databasePath()}/tables/${encodeURIComponent(name)}`, 'POST')), 'primary'));
            cards(data.tables.map(table => table.name), name => navigate(state.database, name), (actions, name) => {
                const path = `${databasePath()}/tables/${encodeURIComponent(name)}`;
                actions.append(button('Rename', () => nameEditor('Rename table', name, next => mutate(path, 'PUT', { name: next }))), button('Delete', () => remove(path, `Delete table "${name}" and all its records?`), 'danger'));
            });
        } else {
            const path = tablePath();
            const [table, rows] = await Promise.all([request(path), request(`${path}/rows`)]);
            if (token !== generation) return;
            state.columns = table.columns; state.rows = rows.rows;
            if (!state.columns.some(column => column.name === state.sort?.column)) state.sort = null;
            renderTable();
        }
    } catch (error) {
        if (token !== generation) return;
        $('content').replaceChildren(element('p', 'Could not load data. Please try again.', 'empty'));
        throw error;
    }
}
function cards(names, open, actionsFor, separateOpen = true) {
    const container = element('div', undefined, 'cards');
    for (const name of names) {
        const card = element('article', undefined, 'card');
        const actions = element('div', undefined, 'actions');
        if (separateOpen) actions.append(button('Open', () => open(name)));
        actionsFor(actions, name);
        card.append(separateOpen ? element('div', name, 'entity-name') : button(name, () => open(name), 'open'), actions);
        container.append(card);
    }
    $('content').replaceChildren(names.length ? container : element('p', 'Nothing here yet. Create your first item.', 'empty'));
}
function renderTable() {
    $('subtitle').textContent = `${state.rows.length} records · ${state.columns.length} columns`;
    const toolbar = $('toolbar'); toolbar.replaceChildren();
    for (const [tab, label] of [['rows', 'Records'], ['schema', 'Structure']]) toolbar.append(button(label, () => { state.tab = tab; renderTable(); }, state.tab === tab ? 'active' : ''));
    if (state.tab === 'schema') {
        toolbar.append(button('Add column', columnEditor, 'primary'));
        cards(state.columns.map(column => column.name), name => renameColumn(name), (actions, name) => {
            actions.append(element('span', state.columns.find(column => column.name === name).type), button('Rename', () => renameColumn(name)), button('Delete', () => remove(`${tablePath()}/columns/${encodeURIComponent(name)}`, `Delete column "${name}" and its values in all records?`), 'danger'));
        }, false);
        return;
    }
    const add = button('Add record', () => rowEditor(), 'primary'); add.disabled = busy || !state.columns.length;
    toolbar.append(add);
    if (state.rows.length) toolbar.append(button('Clear records', () => remove(`${tablePath()}/rows`, 'Delete all records in this table? Columns will be preserved.'), 'danger'));
    if (state.sort) toolbar.append(button('Reset sorting', () => { state.sort = null; renderTable(); }));
    if (!state.columns.length) { $('content').replaceChildren(element('p', 'Add columns in the Structure tab.', 'empty')); return; }
    const wrap = element('div', undefined, 'table-wrap'), table = element('table'), head = element('thead'), header = element('tr');
    header.append(element('th', '#'));
    for (const column of state.columns) {
        const th = element('th'); const selected = state.sort?.column === column.name;
        th.setAttribute('aria-sort', selected ? (state.sort.direction === 1 ? 'ascending' : 'descending') : 'none');
        const sortButton = button(`${column.name} ${selected ? state.sort.direction === 1 ? '↑' : '↓' : '↕'}`, () => {
            state.sort = selected && state.sort.direction === -1 ? null : { column: column.name, direction: selected ? -1 : 1 }; renderTable();
        });
        sortButton.title = column.type === 'complex' ? 'Sort by real part, then imaginary part' : 'Client-side sorting: ascending → descending → original order';
        th.append(sortButton, element('small', column.type)); header.append(th);
    }
    header.append(element('th', 'Actions')); head.append(header); table.append(head);
    const body = element('tbody');
    for (const row of sortRows(state.rows, state.columns, state.sort)) {
        const tr = element('tr'); tr.append(element('td', String(row.index)));
        for (const value of row.values) tr.append(element('td', formatValue(value)));
        const td = element('td'), actions = element('div', undefined, 'actions');
        actions.append(button('Edit', () => rowEditor(row)), button('Delete', () => remove(`${tablePath()}/rows/${row.index}`, `Delete record #${row.index}?`), 'danger'));
        td.append(actions); tr.append(td); body.append(tr);
    }
    table.append(body); wrap.append(table); $('content').replaceChildren(wrap);
    if (!state.rows.length) $('content').append(element('p', 'No records yet. Add your first record.', 'empty'));
}
async function mutate(path, method, body = null) {
    busy = true;
    document.querySelectorAll('button').forEach(node => { node.disabled = true; });
    $('refresh').disabled = true;
    try { await request(path, method, body); }
    finally { busy = false; document.querySelectorAll('button').forEach(node => { node.disabled = false; }); }
    await refresh();
}
async function remove(path, message) { if (window.confirm(message)) await mutate(path, 'DELETE'); }
function openEditor(title, build, save) {
    $('editorTitle').textContent = title; $('fields').replaceChildren(); $('editorError').textContent = '';
    const collect = build($('fields'));
    $('editorForm').onsubmit = async event => {
        event.preventDefault();
        if (busy) return;
        const submit = $('editorForm').querySelector('[type=submit]'); submit.disabled = true;
        try { await save(collect()); $('editor').close(); }
        catch (error) { $('editorError').textContent = error.message; }
        finally { submit.disabled = false; }
    };
    $('editor').showModal(); $('fields').querySelector('input,select')?.focus();
}
function inputField(container, title, value = '') {
    const label = element('label', title), input = element('input'); input.value = value; label.append(input); container.append(label); return input;
}
function nameEditor(title, current, save) {
    openEditor(title, fields => {
        const input = inputField(fields, 'Name', current); input.required = true;
        return () => { const name = input.value.trim(); if (!name) throw new Error('Enter a name.'); return name; };
    }, save);
}
function valueField(container, column, value) {
    if (column.type === 'complex') {
        const group = element('div', undefined, 'complex-fields'); container.append(element('p', `${column.name} (complex)`), group);
        const real = inputField(group, 'Real part', value?.real ?? 0), imag = inputField(group, 'Imaginary part', value?.imag ?? 0);
        return () => parseValue({ real: real.value, imag: imag.value }, 'complex');
    }
    const fallback = ['integer', 'real'].includes(column.type) ? '0' : column.type === 'char' ? '\\0' : '';
    const input = inputField(container, `${column.name} (${column.type})`, value === undefined ? fallback : column.type === 'char' && value === '\0' ? '\\0' : value);
    if (column.type === 'char') input.placeholder = 'One byte or \\0';
    return () => parseValue(column.type === 'char' && input.value === '\\0' ? '\0' : input.value, column.type);
}
function rowEditor(row) {
    const path = `${tablePath()}/rows${row ? `/${row.index}` : ''}`;
    openEditor(row ? `Edit record #${row.index}` : 'Add record', fields => {
        const getters = state.columns.map(column => valueField(fields, column, row?.values[state.columns.indexOf(column)]));
        return () => getters.map((get, i) => { try { return get(); } catch (error) { throw new Error(`${state.columns[i].name}: ${error.message}`); } });
    }, values => mutate(path, row ? 'PUT' : 'POST', { values }));
}
function renameColumn(name) { const path = `${tablePath()}/columns/${encodeURIComponent(name)}`; nameEditor('Rename column', name, next => mutate(path, 'PUT', { name: next })); }
function columnEditor() {
    if (state.rows.length) {
        window.alert('Cannot add a column while the table contains records. Delete all records or use Clear records, then try again.');
        return;
    }
    const path = `${tablePath()}/columns`;
    openEditor('Add column', fields => {
        const name = inputField(fields, 'Name'); name.required = true;
        const label = element('label', 'Type'), select = element('select');
        for (const type of ['integer', 'real', 'char', 'string', 'complex']) { const option = element('option', type); option.value = type; select.append(option); }
        label.append(select); fields.append(label);
        const defaults = element('div'); fields.append(defaults); let getDefault;
        const update = () => { defaults.replaceChildren(); getDefault = valueField(defaults, { name: 'Default value for existing records', type: select.value }); };
        select.onchange = update; update();
        return () => { if (!name.value.trim()) throw new Error('Enter a name.'); return { name: name.value.trim(), type: select.value, default: getDefault() }; };
    }, body => mutate(path, 'POST', body));
}
async function exportDatabase(name) {
    const result = await window.databaseClient.exportDatabase(name);
    if (!result.canceled && !result.ok) throw new Error(result.message);
}
function importNew() {
    nameEditor('Import database from .bin', '', async name => {
        const result = await window.databaseClient.importDatabase(name);
        if (result.canceled) return;
        if (!result.ok) throw new Error(result.message);
        await refresh();
    });
}
async function replaceDatabase(name) {
    if (!window.confirm(`Replace all data in database "${name}" with the contents of a file?`)) return;
    const result = await window.databaseClient.importDatabase(name, true);
    if (result.canceled) return;
    if (!result.ok) throw new Error(result.message);
    await refresh();
}
$('cancelEditor').onclick = () => $('editor').close();
$('refresh').onclick = () => run(refresh);
run(refresh);
