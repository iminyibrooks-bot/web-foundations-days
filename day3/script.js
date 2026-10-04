let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

function searchNotes(word) {
  const w = word.toLowerCase();
  return notes.filter(note => note.text.toLowerCase().includes(w));
}

console.log(searchNotes("JAVASCRIPT")); // expected: only note 4
console.log(searchNotes("xyz"));        // expected: [] (no results)

function longestNote() {
  if (notes.length === 0) {
    return null;
  }
  let longest = notes[0];
  for (const note of notes) {
    if (note.text.length > longest.text.length) {
      longest = note;
    }
  }
  return longest;
}

console.log(longestNote()); // expected: note 3, "Email the project report to Grace"

function countByCategory() {
  const counts = {};
  for (const note of notes) {
    if (counts[note.category]) {
      counts[note.category] = counts[note.category] + 1;
    } else {
      counts[note.category] = 1;
    }
  }
  return counts;
}

console.log(countByCategory()); // expected: { personal: 2, study: 2, work: 1 }
const categories = ["personal", "work", "study"];

function getSummary() {
  const total = notes.length;
  if (total === 0) {
    return "0 notes.";
  }
  const counts = countByCategory();
  let word = "notes";
  if (total === 1) {
    word = "note";
  }
  const parts = [];
  for (const category of categories) {
    if (counts[category]) {
      parts.push(`${counts[category]} ${category}`);
    }
  }
  return `${total} ${word}: ${parts.join(", ")}.`;
}

console.log(getSummary()); // expected: "5 notes: 2 personal, 1 work, 2 study."

function isDuplicate(text) {
  const clean = text.trim().toLowerCase();
  return notes.some(note => note.text.trim().toLowerCase() === clean);
}

console.log(isDuplicate("  call MUM ")); // expected: true (ignores case and spaces)
console.log(isDuplicate("Walk the dog")); // expected: false

function addNote(text, category) {
  const clean = text.trim();
  if (clean.length < 1 || clean.length > 200) {
    console.log("Rejected: text must be 1-200 characters.");
    return false;
  }
  if (isDuplicate(clean)) {
    console.log("Rejected: duplicate note.");
    return false;
  }
  if (!categories.includes(category)) {
    console.log("Rejected: category must be personal, work or study.");
    return false;
  }
  notes.push({ id: notes.length + 1, text: clean, category: category });
  return true;
}

console.log(addNote("Walk the dog", "personal")); // expected: true
console.log(addNote("walk the dog", "personal")); // expected: false (duplicate)
console.log(addNote("", "work")); // expected: false (too short)
console.log(addNote("Plan sprint", "fun")); // expected: false (bad category)
console.log(addNote("x".repeat(201), "work")); // expected: false (too long)
console.log(getSummary()); // expected: "6 notes: 3 personal, 1 work, 2 study."