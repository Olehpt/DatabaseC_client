const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const data = require('../renderer/data');
test('API value validation and complex round trip', () => {
    assert.equal(data.parseValue('-2147483648', 'integer'), -2147483648);
    for (const value of ['2147483648', '-2147483649', '1.5', '1e3']) assert.throws(() => data.parseValue(value, 'integer'));
    for (const value of ['', 'Infinity', '1e309', '0x10']) assert.throws(() => data.parseValue(value, 'real'));
    assert.equal(data.parseValue('1.5e2', 'real'), 150);
    assert.equal(data.parseValue('\0', 'char'), '\0');
    assert.throws(() => data.parseValue('Ж', 'char'));
    assert.equal(data.parseValue('', 'string'), '');
    assert.deepEqual(data.parseValue({real:'1.5', imag:'-2'}, 'complex'), {real:1.5, imag:-2});
    assert.equal(data.formatValue({real:1.5, imag:-2}), '1.5 − 2i');
});
test('sorting is numeric, stable, immutable and retains server indices', () => {
    const rows = [{index:4,values:[10]},{index:7,values:[2]},{index:9,values:[2]}];
    const columns = [{name:'n',type:'integer'}];
    assert.deepEqual(data.sortRows(rows,columns,{column:'n',direction:1}).map(r => r.index), [7,9,4]);
    assert.deepEqual(data.sortRows(rows,columns,{column:'n',direction:-1}).map(r => r.index), [4,7,9]);
    assert.deepEqual(rows.map(r => r.index), [4,7,9]);
    const complex = [{index:0,values:[{real:1,imag:3}]},{index:1,values:[{real:1,imag:2}]}];
    assert.equal(data.sortRows(complex,[{name:'z',type:'complex'}],{column:'z',direction:1})[0].index,1);
    assert.deepEqual(data.sortRows(rows, columns, null), rows);
});
class Node {
    constructor(tag) { this.tag = tag; this.children = []; this.value = ''; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    setAttribute(name,value) { this[name] = value; }
    querySelector(selector) { return descendants(this).find(n => selector === '[type=submit]' ? n.type === 'submit' : ['input','select'].includes(n.tag)); }
    focus() {} showModal() {} close() {}
}
function descendants(node) { return node.children.flatMap(child => [child,...descendants(child)]); }
function setup(handler) {
    const nodes = new Map();
    const document = {getElementById(id) { if (!nodes.has(id)) nodes.set(id,new Node('div')); return nodes.get(id); }, createElement: tag => new Node(tag), querySelectorAll: () => [...nodes.values()].flatMap(descendants).filter(n => n.tag === 'button')};
    const calls = [];
    const context = vm.createContext({document, ClientData:data, window:{confirm:() => true, databaseClient:{request:async (...args) => {calls.push(args); return {ok:true,body:await handler(...args)}; }}}, console});
    vm.runInContext(fs.readFileSync(require.resolve('../renderer/renderer.js'),'utf8'),context);
    return {context,document,calls};
}
test('hierarchy and sorted delete/edit use server row index', async () => {
    const rows = [{index:4,values:[10]},{index:7,values:[2]}];
    const env = setup(async path => path === '/databases' ? {databases:['demo']} : path.endsWith('/rows') ? {rows} : {columns:[{name:'n',type:'integer'}]});
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(env.document.getElementById('title').textContent,'Databases');
    await vm.runInContext("navigate('demo','items')",env.context);
    vm.runInContext("state.sort = {column:'n',direction:1}; renderTable()",env.context);
    const deleteButton = descendants(env.document.getElementById('content')).find(n => n.textContent === 'Delete');
    await deleteButton.onclick();
    assert.equal(env.calls.find(call => call[1] === 'DELETE')[0],'/databases/demo/tables/items/rows/7');
    vm.runInContext("state.sort = {column:'n',direction:1}; renderTable()",env.context);
    await descendants(env.document.getElementById('content')).find(n => n.textContent === 'Edit').onclick();
    assert.equal(env.document.getElementById('editorTitle').textContent,'Edit record #7');
});
test('late response cannot overwrite newer navigation', async () => {
    let release;
    const env = setup(path => path === '/databases' ? {databases:[]} : path.includes('/slow/') ? new Promise(resolve => {release=resolve;}) : {tables:[{name:'current'}]});
    await new Promise(resolve => setImmediate(resolve));
    const old = vm.runInContext("navigate('slow')",env.context);
    await vm.runInContext("navigate('fast')",env.context);
    release({tables:[{name:'stale'}]}); await old;
    const labels = descendants(env.document.getElementById('content')).map(n => n.textContent);
    assert.ok(labels.includes('current')); assert.ok(!labels.includes('stale'));
});
test('adding columns is blocked until the last record is deleted or all records are cleared', async () => {
    for (const clearAll of [false, true]) {
        let rows = [{index:0, values:[1]}, {index:1, values:[2]}];
        const env = setup(async (path, method) => {
            if (path === '/databases') return {databases:['demo']};
            if (method === 'DELETE') {
                if (path.endsWith('/rows')) rows = [];
                else rows = rows.filter(row => row.index !== Number(path.split('/').at(-1)));
                return {};
            }
            if (path.endsWith('/rows')) return {rows};
            return {columns:[{name:'n',type:'integer'}]};
        });
        const alerts = [];
        env.context.window.alert = message => alerts.push(message);
        await new Promise(resolve => setImmediate(resolve));
        await vm.runInContext("navigate('demo','items')", env.context);
        const addColumn = async () => {
            vm.runInContext("state.tab = 'schema'; renderTable()", env.context);
            await descendants(env.document.getElementById('toolbar')).find(node => node.textContent === 'Add column').onclick();
        };
        await addColumn();
        assert.equal(alerts.length, 1);
        assert.match(alerts[0], /Cannot add a column/);
        assert.notEqual(env.document.getElementById('editorTitle').textContent, 'Add column');
        if (clearAll) {
            vm.runInContext("state.tab = 'rows'; renderTable()", env.context);
            await descendants(env.document.getElementById('toolbar')).find(node => node.textContent === 'Clear records').onclick();
        } else {
            for (let i = 0; i < 2; i++) {
                vm.runInContext("state.tab = 'rows'; renderTable()", env.context);
                await descendants(env.document.getElementById('content')).find(node => node.textContent === 'Delete').onclick();
                if (i === 0) {
                    await addColumn();
                    assert.equal(alerts.length, 2);
                }
            }
        }
        const count = alerts.length;
        await addColumn();
        assert.equal(alerts.length, count);
        assert.equal(env.document.getElementById('editorTitle').textContent, 'Add column');
        assert.equal(descendants(env.document.getElementById('fields')).filter(node => node.tag === 'input').length, 2);
    }
});
test('HTTP bridge preserves binary payload and server error messages', async () => {
    const http = require('node:http');
    const payload = Buffer.from([0,255,128,1,13,10]);
    let received, headers;
    const server = http.createServer((req,res) => {
        const chunks=[];
        req.on('data',chunk => chunks.push(chunk));
        req.on('end',() => {
            received=Buffer.concat(chunks); headers=req.headers;
            if (req.url.endsWith('/export')) {res.setHeader('Content-Type','application/octet-stream'); res.end(payload);}
            else if (req.url.endsWith('/import')) res.end('{"message":"ok"}');
            else {res.statusCode=409; res.end('{"message":"duplicate"}');}
        });
    });
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    try {
        const electron = {app:{whenReady:() => ({then:() => {}}),on:() => {}},ipcMain:{handle:() => {}},BrowserWindow:{},dialog:{}};
        const context=vm.createContext({Buffer, __dirname:require('node:path').resolve(__dirname,'..'), require:name => name === 'electron' ? electron : name === 'http' ? {request:(options,callback) => http.request({...options,hostname:'127.0.0.1',port:server.address().port},callback)} : require(name)});
        vm.runInContext(fs.readFileSync(require.resolve('../main.js'),'utf8'),context);
        const exported=await vm.runInContext("requestServer('/databases/demo/export','GET',null,true)",context);
        assert.deepEqual(exported.body,payload);
        context.payload=payload;
        const imported=await vm.runInContext("requestServer('/databases/demo/import','POST',payload)",context);
        assert.ok(imported.ok); assert.deepEqual(received,payload); assert.equal(headers['content-type'],'application/octet-stream');
        const failed=await vm.runInContext("requestServer('/duplicate')",context);
        assert.equal(failed.ok,false); assert.equal(failed.body.message,'duplicate');
    } finally {await new Promise(resolve => server.close(resolve));}
});
