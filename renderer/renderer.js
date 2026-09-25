const connectionStatus =
    document.getElementById("connectionStatus");

const databaseList =
    document.getElementById("databaseList");

const tableTitle =
    document.getElementById("tableTitle");

const tableInfo =
    document.getElementById("tableInfo");

const tableContainer =
    document.getElementById("tableContainer");

const loadDatabasesButton =
    document.getElementById("loadDatabases");

const databaseNameInput =
    document.getElementById("databaseNameInput");

const createDatabaseButton =
    document.getElementById("createDatabase");

const tableActions =
    document.getElementById("tableActions");

const selectedDatabaseTitle =
    document.getElementById("selectedDatabaseTitle");

const tableNameInput =
    document.getElementById("tableNameInput");

const createTableButton =
    document.getElementById("createTable");

const deleteTableButton =
    document.getElementById("deleteTable");

const dataActions =
    document.getElementById("dataActions");

const columnNameInput =
    document.getElementById("columnNameInput");

const columnTypeInput =
    document.getElementById("columnTypeInput");

const createColumnButton =
    document.getElementById("createColumn");

const rowEditorTitle =
    document.getElementById("rowEditorTitle");

const rowInputContainer =
    document.getElementById("rowInputContainer");

const saveRowButton =
    document.getElementById("saveRow");

const cancelEditRowButton =
    document.getElementById("cancelEditRow");

let selectedDatabase = null;
let selectedTable = null;
let selectedColumns = [];
let editingRowIndex = null;

// ---------------------------------------------------------
// HTTP
// ---------------------------------------------------------

async function request(endpoint, method = "GET", body = null) {
    let result;

    try {
        result = await window.databaseClient.request(
            endpoint,
            method,
            body
        );
    }
    catch (error) {
        throw new Error(
            `Failed to connect to server: ${error.message}`
        );
    }

    if (!result.ok) {
        const serverMessage =
            typeof result.body === "string"
                ? result.body
                : result.body?.message || result.statusText;

        throw new Error(
            `Server returned ${result.status}: ${serverMessage}`
        );
    }

    return result.body;
}

function showError(container, message) {
    container.innerHTML = "";

    const paragraph =
        document.createElement("p");

    paragraph.className = "error";
    paragraph.textContent = message;

    container.appendChild(paragraph);
}

function normalizeName(value) {
    return value.trim();
}

// ---------------------------------------------------------
// Databases
// ---------------------------------------------------------

async function loadDatabases() {
    try {
        connectionStatus.textContent = "Connecting...";

        const data = await request("/databases");

        connectionStatus.textContent = "Connected";

        databaseList.innerHTML = "";

        if (!data?.databases || data.databases.length === 0) {
            databaseList.innerHTML =
                '<p class="placeholder">No databases found</p>';

            clearSelection();
            return;
        }

        for (const databaseName of data.databases) {
            addDatabaseElement(databaseName);
        }
    }
    catch (error) {
        connectionStatus.textContent = "Disconnected";

        databaseList.innerHTML =
            '<p class="error">Failed to load databases</p>';

        console.error(error);
    }
}

function addDatabaseElement(databaseName) {
    const databaseItem =
        document.createElement("div");

    databaseItem.className = "entity-item";
    databaseItem.dataset.database = databaseName;

    const databaseButton =
        document.createElement("button");

    databaseButton.className = "database-button entity-main-button";
    databaseButton.textContent = databaseName;

    databaseButton.addEventListener(
        "click",
        () => loadTables(databaseName)
    );

    const deleteButton =
        document.createElement("button");

    deleteButton.className = "delete-button";
    deleteButton.textContent = "Delete";
    deleteButton.title = `Delete database ${databaseName}`;

    deleteButton.addEventListener(
        "click",
        event => {
            event.stopPropagation();
            deleteDatabase(databaseName);
        }
    );

    databaseItem.appendChild(databaseButton);
    databaseItem.appendChild(deleteButton);
    databaseList.appendChild(databaseItem);
}

async function createDatabase() {
    const databaseName =
        normalizeName(databaseNameInput.value);

    if (!databaseName) {
        databaseNameInput.focus();
        return;
    }

    if (/\s/.test(databaseName)) {
        alert("Database name contains just letters.");
        return;
    }


    try {
        createDatabaseButton.disabled = true;
        connectionStatus.textContent = "Creating database...";

        await request(
            `/databases/${encodeURIComponent(databaseName)}`,
            "POST"
        );

        databaseNameInput.value = "";
        connectionStatus.textContent = "Connected";

        clearSelection();
        await loadDatabases();
    }
    catch (error) {
        connectionStatus.textContent = "Connected";
        console.error(error);
        alert(error.message);
    }
    finally {
        createDatabaseButton.disabled = false;
    }
}

async function deleteDatabase(databaseName) {
    const confirmed = window.confirm(
        `Delete database "${databaseName}"?`
    );

    if (!confirmed) {
        return;
    }

    try {
        connectionStatus.textContent = "Deleting database...";

        await request(
            `/databases/${encodeURIComponent(databaseName)}`,
            "DELETE"
        );

        if (selectedDatabase === databaseName) {
            clearSelection();
        }

        connectionStatus.textContent = "Connected";
        await loadDatabases();
    }
    catch (error) {
        connectionStatus.textContent = "Connected";
        console.error(error);
        alert(error.message);
    }
}

// ---------------------------------------------------------
// Tables
// ---------------------------------------------------------

async function loadTables(databaseName) {
    try {
        selectedDatabase = databaseName;
        selectedTable = null;
        selectedColumns = [];
        editingRowIndex = null;

        dataActions.classList.add("hidden");
        resetRowEditor();
        tableActions.classList.remove("hidden");
        selectedDatabaseTitle.textContent =
            `Tables: ${databaseName}`;
        deleteTableButton.disabled = true;

        tableTitle.textContent = `${databaseName}`;
        tableInfo.innerHTML =
            '<p class="placeholder">Select a table.</p>';
        tableContainer.innerHTML = "";

        const data = await request(
            `/databases/${encodeURIComponent(databaseName)}/tables`
        );

        // Remove old table elements for this database.
        const oldTables =
            databaseList.querySelectorAll(
                `[data-database="${CSS.escape(databaseName)}"]` +
                ".table-item"
            );

        oldTables.forEach(
            element => element.remove()
        );

        for (const table of data.tables || []) {
            addTableElement(databaseName, table.name);
        }
    }
    catch (error) {
        console.error(error);
        showError(tableInfo, "Failed to load tables");
    }
}

function addTableElement(databaseName, tableName) {
    const tableItem =
        document.createElement("div");

    tableItem.className = "entity-item table-item";
    tableItem.dataset.database = databaseName;
    tableItem.dataset.table = tableName;

    const tableButton =
        document.createElement("button");

    tableButton.className = "table-button entity-main-button";
    tableButton.textContent = tableName;

    tableButton.addEventListener(
        "click",
        () => loadTable(databaseName, tableName)
    );

    const deleteButton =
        document.createElement("button");

    deleteButton.className = "delete-button";
    deleteButton.textContent = "Delete";
    deleteButton.title = `Delete table ${tableName}`;

    deleteButton.addEventListener(
        "click",
        event => {
            event.stopPropagation();
            deleteTable(databaseName, tableName);
        }
    );

    tableItem.appendChild(tableButton);
    tableItem.appendChild(deleteButton);
    databaseList.appendChild(tableItem);
}

async function createTable() {
    if (!selectedDatabase) {
        return;
    }

    const tableName =
        normalizeName(tableNameInput.value);

    if (!tableName) {
        tableNameInput.focus();
        return;
    }

    if (/\s/.test(tableName)) {
        alert("Database table name contains just letters.");
        return;
    }

    try {
        createTableButton.disabled = true;
        connectionStatus.textContent = "Creating table...";

        await request(
            `/databases/${encodeURIComponent(selectedDatabase)}` +
            `/tables/${encodeURIComponent(tableName)}`,
            "POST"
        );

        tableNameInput.value = "";
        connectionStatus.textContent = "Connected";

        await loadTables(selectedDatabase);
    }
    catch (error) {
        connectionStatus.textContent = "Connected";
        console.error(error);
        alert(error.message);
    }
    finally {
        createTableButton.disabled = false;
    }
}

async function deleteTable(databaseName, tableName) {
    const confirmed = window.confirm(
        `Delete table "${tableName}" from "${databaseName}"?`
    );

    if (!confirmed) {
        return;
    }

    try {
        connectionStatus.textContent = "Deleting table...";

        await request(
            `/databases/${encodeURIComponent(databaseName)}` +
            `/tables/${encodeURIComponent(tableName)}`,
            "DELETE"
        );

        if (
            selectedDatabase === databaseName &&
            selectedTable === tableName
        ) {
            selectedTable = null;
            deleteTableButton.disabled = true;
            tableTitle.textContent = databaseName;
            tableInfo.innerHTML =
                '<p class="placeholder">Select a table.</p>';
            tableContainer.innerHTML = "";
        }

        connectionStatus.textContent = "Connected";
        await loadTables(databaseName);
    }
    catch (error) {
        connectionStatus.textContent = "Connected";
        console.error(error);
        alert(error.message);
    }
}

// ---------------------------------------------------------
// Table structure
// ---------------------------------------------------------

async function loadTable(
    databaseName,
    tableName
) {
    try {
        selectedDatabase = databaseName;
        selectedTable = tableName;

        tableActions.classList.remove("hidden");
        selectedDatabaseTitle.textContent =
            `Tables: ${databaseName}`;
        deleteTableButton.disabled = false;

        const data = await request(
            `/databases/${encodeURIComponent(databaseName)}` +
            `/tables/${encodeURIComponent(tableName)}`
        );

        tableTitle.textContent =
            `${databaseName} / ${tableName}`;

        selectedColumns = data.columns || [];
        editingRowIndex = null;

        renderTableInfo(data);
        renderRowEditor(selectedColumns);
        dataActions.classList.remove("hidden");

        await loadRows(
            databaseName,
            tableName,
            selectedColumns
        );
    }
    catch (error) {
        console.error(error);
        showError(tableInfo, "Failed to load table");
    }
}

// ---------------------------------------------------------
// Table information
// ---------------------------------------------------------

function renderTableInfo(data) {
    tableInfo.innerHTML = "";

    const paragraph =
        document.createElement("p");

    paragraph.textContent =
        `${data.columns.length} column(s)`;

    tableInfo.appendChild(paragraph);
}

// ---------------------------------------------------------
// Rows
// ---------------------------------------------------------

async function loadRows(
    databaseName,
    tableName,
    columns
) {
    try {
        const data = await request(
            `/databases/${encodeURIComponent(databaseName)}` +
            `/tables/${encodeURIComponent(tableName)}/rows`
        );

        renderRows(
            columns,
            data.rows || []
        );
    }
    catch (error) {
        console.error(error);
        showError(tableContainer, "Failed to load rows");
    }
}

// ---------------------------------------------------------
// Render rows
// ---------------------------------------------------------

function renderRows(
    columns,
    rows
) {
    tableContainer.innerHTML = "";

    const table =
        document.createElement("table");

    const header =
        document.createElement("thead");

    const headerRow =
        document.createElement("tr");

    for (const column of columns) {
        const cell =
            document.createElement("th");

        const headerContent =
            document.createElement("div");
        headerContent.className = "column-header";

        const label =
            document.createElement("span");
        label.textContent =
            `${column.name} (${column.type})`;

        const deleteButton =
            document.createElement("button");
        deleteButton.className = "column-delete-button";
        deleteButton.textContent = "×";
        deleteButton.title = `Delete column ${column.name}`;
        deleteButton.addEventListener(
            "click",
            () => deleteColumn(column.name)
        );

        headerContent.appendChild(label);
        headerContent.appendChild(deleteButton);
        cell.appendChild(headerContent);
        headerRow.appendChild(cell);
    }

    const actionsHeader =
        document.createElement("th");
    actionsHeader.textContent = "Actions";
    headerRow.appendChild(actionsHeader);

    header.appendChild(headerRow);
    table.appendChild(header);

    const body =
        document.createElement("tbody");

    rows.forEach((row, rowIndex) => {
        const tableRow =
            document.createElement("tr");

        for (const value of row.values) {
            const cell =
                document.createElement("td");

            cell.textContent = value;
            tableRow.appendChild(cell);
        }

        const actionsCell =
            document.createElement("td");
        actionsCell.className = "row-actions-cell";

        const editButton =
            document.createElement("button");
        editButton.className = "row-action-button";
        editButton.textContent = "Edit";
        editButton.addEventListener(
            "click",
            () => startEditRow(rowIndex, row)
        );

        const deleteButton =
            document.createElement("button");
        deleteButton.className = "row-action-button danger";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener(
            "click",
            () => deleteRow(rowIndex)
        );

        actionsCell.appendChild(editButton);
        actionsCell.appendChild(deleteButton);
        tableRow.appendChild(actionsCell);
        body.appendChild(tableRow);
    });

    table.appendChild(body);
    tableContainer.appendChild(table);
}


// ---------------------------------------------------------
// Columns and row editing
// ---------------------------------------------------------

async function createColumn() {
    if (!selectedDatabase || !selectedTable) {
        return;
    }

    const columnName = normalizeName(columnNameInput.value);

    if (!columnName) {
        columnNameInput.focus();
        return;
    }

    if (/\s/.test(columnName)) {
        alert("Column name cannot contain spaces.");
        return;
    }

    try {
        createColumnButton.disabled = true;

        await request(
            `/databases/${encodeURIComponent(selectedDatabase)}` +
            `/tables/${encodeURIComponent(selectedTable)}/columns`,
            "POST",
            {
                name: columnName,
                type: columnTypeInput.value
            }
        );

        columnNameInput.value = "";
        await loadTable(selectedDatabase, selectedTable);
    }
    catch (error) {
        console.error(error);
        alert(error.message);
    }
    finally {
        createColumnButton.disabled = false;
    }
}

async function deleteColumn(columnName) {
    if (!selectedDatabase || !selectedTable) {
        return;
    }

    const confirmed = window.confirm(
        `Delete column "${columnName}"?`
    );

    if (!confirmed) {
        return;
    }

    try {
        await request(
            `/databases/${encodeURIComponent(selectedDatabase)}` +
            `/tables/${encodeURIComponent(selectedTable)}` +
            `/columns/${encodeURIComponent(columnName)}`,
            "DELETE"
        );

        await loadTable(selectedDatabase, selectedTable);
    }
    catch (error) {
        console.error(error);
        alert(error.message);
    }
}

function renderRowEditor(columns, values = null) {
    rowInputContainer.innerHTML = "";

    if (!columns || columns.length === 0) {
        rowInputContainer.innerHTML =
            '<p class="placeholder">Add at least one column first.</p>';
        saveRowButton.disabled = true;
        return;
    }

    columns.forEach((column, index) => {
        const field = document.createElement("div");
        field.className = "row-field";

        const label = document.createElement("label");
        label.textContent = `${column.name} (${column.type})`;

        const input = document.createElement("input");
        input.className = "row-value-input";
        input.dataset.index = index;
        input.dataset.type = column.type;
        input.placeholder = column.name;
        input.autocomplete = "off";

        if (values && index < values.length) {
            input.value = values[index] ?? "";
        }

        field.appendChild(label);
        field.appendChild(input);
        rowInputContainer.appendChild(field);
    });

    saveRowButton.disabled = false;
}

function parseInputValue(rawValue, type) {
    const normalizedType = String(type).toLowerCase();

    if (normalizedType === "integer") {
        if (!/^-?\d+$/.test(rawValue.trim())) {
            throw new Error(`"${rawValue}" is not a valid integer.`);
        }

        return Number.parseInt(rawValue, 10);
    }

    if (normalizedType === "real") {
        if (rawValue.trim() === "" || Number.isNaN(Number(rawValue))) {
            throw new Error(`"${rawValue}" is not a valid real number.`);
        }

        return Number(rawValue);
    }

    if (normalizedType === "char") {
        if (rawValue.length !== 1) {
            throw new Error("Char value must contain exactly one character.");
        }

        return rawValue;
    }

    return rawValue;
}

function collectRowValues() {
    const inputs =
        rowInputContainer.querySelectorAll(".row-value-input");

    return Array.from(inputs).map(input =>
        parseInputValue(input.value, input.dataset.type)
    );
}

async function saveRow() {
    if (!selectedDatabase || !selectedTable) {
        return;
    }

    let values;

    try {
        values = collectRowValues();
    }
    catch (error) {
        alert(error.message);
        return;
    }

    try {
        saveRowButton.disabled = true;

        const baseEndpoint =
            `/databases/${encodeURIComponent(selectedDatabase)}` +
            `/tables/${encodeURIComponent(selectedTable)}/rows`;

        if (editingRowIndex === null) {
            await request(
                baseEndpoint,
                "POST",
                { values }
            );
        }
        else {
            await request(
                `${baseEndpoint}/${editingRowIndex}`,
                "PUT",
                { values }
            );
        }

        editingRowIndex = null;
        rowEditorTitle.textContent = "Add row";
        saveRowButton.textContent = "Add row";
        cancelEditRowButton.classList.add("hidden");

        await loadTable(selectedDatabase, selectedTable);
    }
    catch (error) {
        console.error(error);
        alert(error.message);
    }
    finally {
        saveRowButton.disabled = selectedColumns.length === 0;
    }
}

function startEditRow(rowIndex, row) {
    editingRowIndex = rowIndex;
    rowEditorTitle.textContent = `Edit row ${rowIndex}`;
    saveRowButton.textContent = "Save changes";
    cancelEditRowButton.classList.remove("hidden");
    renderRowEditor(selectedColumns, row.values || []);

    const firstInput =
        rowInputContainer.querySelector(".row-value-input");

    if (firstInput) {
        firstInput.focus();
    }
}

function resetRowEditor() {
    editingRowIndex = null;
    rowEditorTitle.textContent = "Add row";
    saveRowButton.textContent = "Add row";
    cancelEditRowButton.classList.add("hidden");
    renderRowEditor(selectedColumns);
}

async function deleteRow(rowIndex) {
    if (!selectedDatabase || !selectedTable) {
        return;
    }

    const confirmed = window.confirm(
        `Delete row ${rowIndex}?`
    );

    if (!confirmed) {
        return;
    }

    try {
        await request(
            `/databases/${encodeURIComponent(selectedDatabase)}` +
            `/tables/${encodeURIComponent(selectedTable)}` +
            `/rows/${rowIndex}`,
            "DELETE"
        );

        await loadTable(selectedDatabase, selectedTable);
    }
    catch (error) {
        console.error(error);
        alert(error.message);
    }
}

// ---------------------------------------------------------
// Selection
// ---------------------------------------------------------

function clearSelection() {
    selectedDatabase = null;
    selectedTable = null;
    selectedColumns = [];
    editingRowIndex = null;

    dataActions.classList.add("hidden");
    resetRowEditor();
    tableActions.classList.add("hidden");
    deleteTableButton.disabled = true;
    tableTitle.textContent = "Select a table";
    tableInfo.innerHTML =
        '<p class="placeholder">Select a database and table.</p>';
    tableContainer.innerHTML = "";
}

// ---------------------------------------------------------
// Events
// ---------------------------------------------------------

loadDatabasesButton.addEventListener(
    "click",
    loadDatabases
);

createDatabaseButton.addEventListener(
    "click",
    createDatabase
);

createTableButton.addEventListener(
    "click",
    createTable
);

createColumnButton.addEventListener(
    "click",
    createColumn
);

saveRowButton.addEventListener(
    "click",
    saveRow
);

cancelEditRowButton.addEventListener(
    "click",
    resetRowEditor
);

databaseNameInput.addEventListener(
    "keydown",
    event => {
        if (event.key === "Enter") {
            createDatabase();
        }
    }
);

tableNameInput.addEventListener(
    "keydown",
    event => {
        if (event.key === "Enter") {
            createTable();
        }
    }
);


columnNameInput.addEventListener(
    "keydown",
    event => {
        if (event.key === "Enter") {
            createColumn();
        }
    }
);
