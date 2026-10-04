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