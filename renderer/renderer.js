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

let selectedDatabase = null;
let selectedTable = null;

// ---------------------------------------------------------
// HTTP
// ---------------------------------------------------------

async function request(endpoint, method = "GET") {
    let result;

    try {
        result = await window.databaseClient.request(
            endpoint,
            method
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

        renderTableInfo(data);

        await loadRows(
            databaseName,
            tableName,
            data.columns || []
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

        cell.textContent =
            `${column.name} (${column.type})`;

        headerRow.appendChild(cell);
    }

    header.appendChild(headerRow);
    table.appendChild(header);

    const body =
        document.createElement("tbody");

    for (const row of rows) {
        const tableRow =
            document.createElement("tr");

        for (const value of row.values) {
            const cell =
                document.createElement("td");

            cell.textContent = value;
            tableRow.appendChild(cell);
        }

        body.appendChild(tableRow);
    }

    table.appendChild(body);
    tableContainer.appendChild(table);
}

// ---------------------------------------------------------
// Selection
// ---------------------------------------------------------

function clearSelection() {
    selectedDatabase = null;
    selectedTable = null;

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
