function loadResults() {
  const className = document.getElementById('classSelect').value;
  const csvUrl = `https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/results/${className}.csv`;

  Papa.parse(csvUrl, {
    download: true,
    header: true,
    complete: function(results) {
      displayResults(results.data);
    },
    error: function(err) {
      alert("Failed to load results.");
    }
  });
}

function displayResults(data) {
  const container = document.getElementById('resultsContainer');
  container.innerHTML = '';

  if (data.length === 0) {
    container.innerHTML = '<p>No results found.</p>';
    return;
  }

  const table = document.createElement('table');
  const headers = Object.keys(data[0]);
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  data.forEach(row => {
    const tr = document.createElement('tr');
    headers.forEach(header => {
      const td = document.createElement('td');
      td.textContent = row[header];
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}
