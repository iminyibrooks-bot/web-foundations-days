PRAGMA foreign_keys = ON;

-- Tables
CREATE TABLE students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  credits INTEGER NOT NULL
);

CREATE TABLE enrolments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  grade TEXT,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  UNIQUE (student_id, course_id)
);

-- Sample data
INSERT INTO students (name, email) VALUES
  ('Amina Hassan', 'amina@example.com'),
  ('Brian Otieno', 'brian@example.com'),
  ('Cynthia Wanjiru', 'cynthia@example.com'),
  ('David Mwangi', 'david@example.com');

INSERT INTO courses (title, credits) VALUES
  ('Web Development', 4),
  ('Databases', 3),
  ('Networking', 3);

INSERT INTO enrolments (student_id, course_id, grade) VALUES
  (1, 1, 'A'),
  (1, 2, 'B'),
  (2, 1, 'B'),
  (2, 3, NULL),
  (3, 2, 'A'),
  (3, 1, 'C');

-- Query 1: all courses for one student (by name)
SELECT c.title
FROM students s
JOIN enrolments e ON e.student_id = s.id
JOIN courses c ON c.id = e.course_id
WHERE s.name = 'Amina Hassan';

-- Query 2: all students on one course
SELECT s.name
FROM courses c
JOIN enrolments e ON e.course_id = c.id
JOIN students s ON s.id = e.student_id
WHERE c.title = 'Web Development';

-- Query 3: number of students per course
SELECT c.title, COUNT(e.id) AS student_count
FROM courses c
LEFT JOIN enrolments e ON e.course_id = c.id
GROUP BY c.id, c.title;

-- Query 4: students who have no enrolments
SELECT s.name
FROM students s
LEFT JOIN enrolments e ON e.student_id = s.id
WHERE e.id IS NULL;

-- Query 5: update one enrolment's grade
UPDATE enrolments
SET grade = 'A'
WHERE student_id = 2 AND course_id = 3;
