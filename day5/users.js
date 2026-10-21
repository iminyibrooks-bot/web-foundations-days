const loadBtn = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const statusEl = document.querySelector("#status");
const usersList = document.querySelector("#users-list");

let users = [];

function renderUsers(list) {
  usersList.textContent = "";

  if (list.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No users match your filter.";
    usersList.appendChild(li);
    return;
  }

  for (const user of list) {
    const li = document.createElement("li");

    const name = document.createElement("strong");
    name.textContent = user.name;

    const details = document.createElement("p");
    details.textContent = `${user.email} · ${user.address.city} · ${user.company.name}`;

    li.append(name, details);
    usersList.appendChild(li);
  }
}

function applyFilter() {
  const term = filterInput.value.trim().toLowerCase();
  const matches = users.filter((user) =>
    user.name.toLowerCase().includes(term)
  );
  renderUsers(matches);
}

async function loadUsers() {
  loadBtn.disabled = true;
  statusEl.textContent = "Loading...";

  try {
    const response = await fetch("https://jsonplaceholder.typicode.com/users");
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    users = await response.json();
    applyFilter();
    statusEl.textContent = `Loaded ${users.length} users.`;
  } catch (error) {
    statusEl.textContent = `Error: ${error.message}`;
  } finally {
    loadBtn.disabled = false;
  }
}

loadBtn.addEventListener("click", loadUsers);

filterInput.addEventListener("input", () => {
  if (users.length > 0) {
    applyFilter();
  }
});
