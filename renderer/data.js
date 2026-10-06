(function(root) {
    function parseValue(raw, type) {
        if (type === 'complex') return { real: parseValue(raw.real, 'real'), imag: parseValue(raw.imag, 'real') };
        if (type === 'string') return raw;
        if (type === 'char') {
            if (new TextEncoder().encode(raw).length !== 1) throw new Error('A char value must contain exactly one UTF-8 byte.');
            return raw;
        }
        const text = raw.trim();
        if (!text || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) throw new Error('Enter a number.');
        const number = Number(text);
        if (!Number.isFinite(number)) throw new Error('The number must be finite.');
        if (type === 'integer' && (!/^[+-]?\d+$/.test(text) || !Number.isInteger(number) || number < -2147483648 || number > 2147483647)) throw new Error('Enter an integer between -2147483648 and 2147483647.');
        return number;
    }
    function formatValue(value) {
        if (typeof value === 'object' && value !== null) return `${value.real} ${value.imag < 0 ? '−' : '+'} ${Math.abs(value.imag)}i`;
        return String(value).replaceAll('\0', '\\0');
    }
    function sortRows(rows, columns, sort) {
        if (!sort) return [...rows];
        const index = columns.findIndex(column => column.name === sort.column);
        if (index < 0) return [...rows];
        const type = columns[index].type;
        return [...rows].sort((a,b) => {
            const x = a.values[index], y = b.values[index];
            const comparison = type === 'complex' ? (x.real - y.real || x.imag - y.imag)
                : ['integer','real'].includes(type) ? x - y : String(x).localeCompare(String(y), 'ru');
            return comparison * sort.direction || a.index - b.index;
        });
    }
    const api = { parseValue, formatValue, sortRows };
    if (typeof module !== 'undefined') module.exports = api; else root.ClientData = api;
})(globalThis);
