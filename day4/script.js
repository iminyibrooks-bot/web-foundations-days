const textarea = document.getElementById("note-text");
const charCount = document.getElementById("char-count");
const wordCount = document.getElementById("word-count");
const clearBtn = document.getElementById("clear-btn");
const themeBtn = document.getElementById("theme-toggle");

function updateCounts() {
  const text = textarea.value;
  const chars = text.length;
  const trimmed = text.trim();

  let words = 0;
  if (trimmed !== "") {
    words = trimmed.split(/\s+/).length;
  }

  charCount.textContent = `${chars} / 200 characters`;
  wordCount.textContent = `${words} words`;

  charCount.classList.remove("warning", "over");
  if (chars > 200) {
    charCount.classList.add("over");
  } else if (chars > 180) {
    charCount.classList.add("warning");
  }
}

function saveDraft() {
  localStorage.setItem("draft", textarea.value);
}

function clearAll() {
  textarea.value = "";
  localStorage.removeItem("draft");
  updateCounts();
}

function applyTheme(isDark) {
  document.body.classList.toggle("dark", isDark);
  if (isDark) {
    themeBtn.textContent = "Light mode";
  } else {
    themeBtn.textContent = "Dark mode";
  }
}

textarea.addEventListener("input", () => {
  updateCounts();
  saveDraft();
});

clearBtn.addEventListener("click", clearAll);

textarea.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearAll();
  }
});

themeBtn.addEventListener("click", () => {
  const isDark = !document.body.classList.contains("dark");
  applyTheme(isDark);
  localStorage.setItem("theme", isDark ? "dark" : "light");
});

// When the page loads
textarea.value = localStorage.getItem("draft") || "";
applyTheme(localStorage.getItem("theme") === "dark");
updateCounts();