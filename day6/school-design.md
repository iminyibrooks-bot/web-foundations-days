# School Database Design

## Tables

- **students**: one row per student, with an `id` (primary key), a `name` and a unique `email`.
- **courses**: one row per course, with an `id` (primary key), a `title` and its `credits`.
- **enrolments**: one row each time a student is enrolled on a course. It holds `student_id`, `course_id` and the `grade`.

## Relationships

- **One-to-many:** one student has many enrolments, and one course has many enrolments. Each enrolment belongs to exactly one student and exactly one course.
- **Many-to-many:** students and courses. A student takes many courses, and a course has many students.
- **Why a join table is needed:** a single column cannot hold a list of courses for a student, or a list of students for a course. The `enrolments` table links the two, with one row per pair. It is also the right place for data about the pair itself, like the grade.
- **No double enrolment:** `UNIQUE (student_id, course_id)` stops the same student enrolling on the same course twice.

## Index

I would add an index on `enrolments(course_id)`:

```sql
CREATE INDEX idx_enrolments_course ON enrolments(course_id);
```

Queries like "all students on one course" and "students per course" search by `course_id`. The unique pair already covers lookups that start with `student_id`, but not lookups by `course_id` alone. The index lets the database jump straight to the matching rows, instead of scanning the whole table as it grows.

## SQL or NoSQL?

I would choose SQL. The data is naturally structured: students, courses and enrolments have fixed fields and clear relationships. The system needs rules the database can enforce itself, such as unique emails, foreign keys that stop an enrolment pointing at a student who does not exist, and no duplicate enrolments. It also needs joins and counts across tables, which SQL is built for. NoSQL could suit data with changing shapes or huge scale, but a school's records are consistent and relational, so SQL is the better fit.
