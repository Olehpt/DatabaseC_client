const SERVER_URL = "http://localhost:18080";

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


// ---------------------------------------------------------
// HTTP
// ---------------------------------------------------------

async function request(endpoint) {
    const response = await fetch(
        SERVER_URL + endpoint
    );

    if (!response.ok) {
        throw new Error(
            `Server returned ${response.status}: ${response.statusText}`
        );
    }

    return await response.json();
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

        if (!data.databases || data.databases.length === 0) {
            databaseList.innerHTML =
                '<p class="placeholder">No databases found</p>';

            return;
        }

        for (const databaseName of data.databases) {
            const databaseButton =
                document.createElement("button");

            databaseButton.className =
                "database-button";

            databaseButton.textContent =
                databaseName;

            databaseButton.addEventListener(
                "click",
                () => loadTables(databaseName)
            );

            databaseList.appendChild(
                databaseButton
            );
        }
    }
    catch (error) {
        connectionStatus.textContent = "Disconnected";

        databaseList.innerHTML =
            '<p class="error">Failed to connect to server</p>';

        console.error(error);
    }
}


// ---------------------------------------------------------
// Tables
// ---------------------------------------------------------

async function loadTables(databaseName) {
    try {
        const data = await request(
            `/databases/${encodeURIComponent(databaseName)}/tables`
        );

        // Remove old table buttons for this database
        const oldTables =
            databaseList.querySelectorAll(
                `[data-database="${CSS.escape(databaseName)}"]`
            );

        oldTables.forEach(
            element => element.remove()
        );

        for (const table of data.tables) {
            const tableButton =
                document.createElement("button");

            tableButton.className =
                "table-button";

            tableButton.textContent =
                table.name;

            tableButton.dataset.database =
                databaseName;

            tableButton.addEventListener(
                "click",
                () => loadTable(
                    databaseName,
                    table.name
                )
            );

            databaseList.appendChild(
                tableButton
            );
        }
    }
    catch (error) {
        console.error(error);

        tableInfo.innerHTML =
            '<p class="error">Failed to load tables</p>';
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
        const data = await request(
            `/databases/${encodeURIComponent(databaseName)}/tables/${encodeURIComponent(tableName)}`
        );

        tableTitle.textContent =
            `${databaseName} / ${tableName}`;

        renderTableInfo(data);

        await loadRows(
            databaseName,
            tableName,
            data.columns
        );
    }
    catch (error) {
        console.error(error);

        tableInfo.innerHTML =
            '<p class="error">Failed to load table</p>';
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
            `/databases/${encodeURIComponent(databaseName)}/tables/${encodeURIComponent(tableName)}/rows`
        );

        renderRows(
            columns,
            data.rows
        );
    }
    catch (error) {
        console.error(error);

        tableContainer.innerHTML =
            '<p class="error">Failed to load rows</p>';
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

            cell.textContent =
                value;

            tableRow.appendChild(cell);
        }

        body.appendChild(tableRow);
    }

    table.appendChild(body);

    tableContainer.appendChild(table);
}


// ---------------------------------------------------------
// Events
// ---------------------------------------------------------

loadDatabasesButton.addEventListener(
    "click",
    loadDatabases
);