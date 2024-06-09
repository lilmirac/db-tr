document.addEventListener("DOMContentLoaded", () => {
    const tcForm = document.getElementById("tc-search-form");
    const gsmForm = document.getElementById("gsm-search-form");
    const fieldForm = document.getElementById("field-search-form");

    tcForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const tc = document.getElementById("tc").value;
        await performAdvancedSearch(tc);
    });

    gsmForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const gsm = document.getElementById("gsm").value;
        const response = await fetch("/GSMSearch", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: `gsm=${gsm}`,
        });
        const result = await response.json();
        displayGsmResults(result, gsm);
    });

    fieldForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("name").value;
        const surname = document.getElementById("surname").value;
        const city = document.getElementById("city").value;
        const year = document.getElementById("year").value;
        const partialName = document.getElementById("partial_name").checked;
        const partialSurname = document.getElementById("partial_surname").checked;
        const params = new URLSearchParams();
        if (name) params.append("name", name);
        if (surname) params.append("surname", surname);
        if (city) params.append("city", city);
        if (year) params.append("year", year);
        if (partialName) params.append("partial_name", partialName);
        if (partialSurname) params.append("partial_surname", partialSurname);
        const response = await fetch("/FieldSearch", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString(),
        });
        const result = await response.json();
        displayFieldResults(result);
    });

    async function performAdvancedSearch(tc) {
        const response = await fetch("/AdvancedSearch", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: `tc=${tc}`,
        });
        const result = await response.json();
        displayResults(result);
    }

    function calculateAge(birthDate) {
        const parts = birthDate.split('.');
        const birth = new Date(parts[2], parts[1] - 1, parts[0]);
        const diff = Date.now() - birth.getTime();
        const age = new Date(diff).getUTCFullYear() - 1970;
        return Math.floor(age);
    }

    function formatPerson(person) {
        let html = `
            <div>
                <strong>${person.ADI} ${person.SOYADI} </strong>(${calculateAge(person.DOGUMTARIHI)})<br>
                ${person.TC}<br>
                ${person.DOGUMTARIHI}<br>
                ${person.NUFUSIL} - ${person.NUFUSILCE}<br>
        `;
        if (person.GSM && person.GSM.length > 0) {
            html += `<strong>Numbers:</strong> ${person.GSM.join('-  ')}<br>`;
        }
        html += '</div><br>';
        return html;
    }

    function displayResults(data) {
        const resultsDiv = document.getElementById("results");
        resultsDiv.innerHTML = "";
        data.forEach(person => {
            resultsDiv.innerHTML += formatPerson(person);
            if (person.ANNE && person.ANNE.length > 0) {
                resultsDiv.innerHTML += "<strong>Mother</strong><br>" + formatPerson(person.ANNE[0]);
            }
            if (person.BABA && person.BABA.length > 0) {
                resultsDiv.innerHTML += "<strong>Father</strong><br>" + formatPerson(person.BABA[0]);
            }
            if (person.KARDESLER && person.KARDESLER.length > 0) {
                person.KARDESLER.forEach(child => {
                    resultsDiv.innerHTML += "<strong>Sibling</strong><br>" + formatPerson(child);
                });
            }
            if (person.COCUKLAR && person.COCUKLAR.length > 0) {
                person.COCUKLAR.forEach(child => {
                    resultsDiv.innerHTML += "<strong>Child</strong><br>" + formatPerson(child);
                });
            }
        });
    }

    function createTcButton(tc) {
        const button = document.createElement("button");
        button.textContent = tc;
        button.addEventListener("click", async () => {
            await performAdvancedSearch(tc);
        });
        return button;
    }

    function displayGsmResults(data, gsm) {
        const gsmTable = document.getElementById("gsm-results");
        const fieldTable = document.getElementById("field-results");
        const tbody = gsmTable.querySelector("tbody");
        tbody.innerHTML = "";
        data.forEach(tc => {
            const tr = document.createElement("tr");
            const tcCell = document.createElement("td");
            const gsmCell = document.createElement("td");
            tcCell.appendChild(createTcButton(tc));
            gsmCell.textContent = gsm;
            tr.appendChild(tcCell);
            tr.appendChild(gsmCell);
            tbody.appendChild(tr);
        });
        fieldTable.style.display = "none";
        gsmTable.style.display = "table";
    }

    function displayFieldResults(data) {
        const fieldTable = document.getElementById("field-results");
        const gsmTable = document.getElementById("gsm-results");
        const tbody = fieldTable.querySelector("tbody");
        tbody.innerHTML = "";
        data.forEach(row => {
            const tr = document.createElement("tr");
            Object.entries(row).forEach(([key, cell]) => {
                const td = document.createElement("td");
                if (key === "TC" || key === "ANNETC" || key === "BABATC") {
                    td.appendChild(createTcButton(cell));
                } else {
                    td.textContent = cell;
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        gsmTable.style.display = "none";
        fieldTable.style.display = "table";
    }
});