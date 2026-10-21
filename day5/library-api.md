# Library API Design

A REST API for a library's `books` resource.

## Endpoints

### List all books
- **GET** `/books`
- Returns every book.
- Success: `200 OK`

### Get one book
- **GET** `/books/{id}`
- Returns the book with that id.
- Success: `200 OK`

### Create a book
- **POST** `/books`
- Adds a new book.
- Example body: `{ "title": "Things Fall Apart", "author": "Chinua Achebe", "year": 1958 }`
- Success: `201 Created`

### Update a book
- **PUT** `/books/{id}`
- Replaces the book's details.
- Example body: `{ "title": "Things Fall Apart", "author": "Chinua Achebe", "year": 1959 }`
- Success: `200 OK`

### Delete a book
- **DELETE** `/books/{id}`
- Removes the book.
- Success: `204 No Content`

### List books by an author
- **GET** `/books?author=Achebe`
- Returns only books whose author matches the query parameter.
- Success: `200 OK`

## Error codes

### 400 Bad Request
- The request is malformed or invalid.
- Example: `POST /books` with the `title` missing or empty.

### 404 Not Found
- The resource does not exist.
- Example: `GET /books/9999` when no book has that id.
