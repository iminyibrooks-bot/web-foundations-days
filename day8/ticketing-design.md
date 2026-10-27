# TicketHub Design Document

TicketHub is a website that sells tickets for concerts and events. This document follows the six-part framework: requirements, estimates, API, data model, architecture and trade-offs.

## 1. Requirements

### Functional
- Users can sign up and log in.
- Users can browse and search events and see event details.
- Users can view the seat map of an event with live availability.
- Users can hold seats for a short time, then pay for them.
- Users can view their tickets and orders.
- Organisers can create events and seat maps.

### Non-functional
- **Speed:** event pages load in under 300 ms, and the seat map in under 1 second even during a big sale.
- **Correctness:** two people must never buy the same seat, a paid ticket is never lost, and a user is never charged twice for one order.
- **Fairness:** sales are first come, first served, a waiting room stops bots and refresh-spamming from jumping the line, and each user can hold at most 4 seats.
- **Availability:** the site stays up during a big sale, and if it is overloaded it queues people instead of crashing.
- **Security:** HTTPS everywhere, passwords stored as hashes, and card details handled by the payment provider, not by us.
- **Durability:** orders and tickets are replicated and backed up.

## 2. Estimates

### Assumptions
- 2 million registered users.
- A normal day has 50,000 visitors, each viewing 10 pages, and 5,000 tickets are sold.
- A big sale has 200,000 people trying to buy 20,000 seats within the first 10 minutes (600 seconds).
- During the big sale each person makes about 10 requests (open the event, refresh the seat map, hold, pay).
- Peak is 5 times the daily average. A day has 86,400 seconds.
- An order and ticket rows take about 1 KB.

### Normal traffic

| Measure | Working | Result |
|---|---|---|
| Page views per day | 50,000 x 10 | 500,000 |
| Page views per second (average) | 500,000 / 86,400 | about 6 |
| Page views per second (peak) | 6 x 5 | about 29 |
| Tickets sold per second (average) | 5,000 / 86,400 | about 0.06 |
| Tickets sold per second (peak) | 0.06 x 5 | about 0.3 |
| Storage per year | 5,000 x 365 x 1 KB | about 1.8 GB (a few GB with seat rows) |

Normally there are about 100 views for every sale, so the system is **read-heavy**, and one small server could handle it.

### Big sale

| Measure | Working | Result |
|---|---|---|
| Users arriving per second | 200,000 / 600 | about 333 |
| Requests per second | 200,000 x 10 / 600 | about 3,300 |
| Seats sold per second (if it sells out) | 20,000 / 600 | about 33 |
| Competition for each seat | 200,000 / 20,000 | 10 people per seat |

### Comparison

The big sale is about **575 times** the normal average and **115 times** the normal peak, and sales per second go from 0.06 to 33. The design problem is not the daily load, it is the first 10 minutes: huge bursts of reads, and many people fighting for the same rows at once.

## 3. API

Base URL `/v1`, JSON bodies, and `Authorization: Bearer <token>` after login.

| Method | Path | Description | Success status |
|---|---|---|---|
| POST | `/auth/login` | Log in and receive a token | 200 OK |
| GET | `/events` | Browse and search events (`?q=`, `?page=`) | 200 OK |
| GET | `/events/{id}` | Event details | 200 OK |
| GET | `/events/{id}/seats` | Seat map with availability | 200 OK |
| POST | `/events/{id}/holds` | Hold one or more seats for 5 minutes | 201 Created |
| DELETE | `/holds/{id}` | Release a hold | 204 No Content |
| POST | `/orders` | Pay for a hold and create the order and tickets | 201 Created |
| GET | `/orders/{id}` | View one order | 200 OK |
| GET | `/me/tickets` | List my tickets | 200 OK |

Hold request, `POST /events/7/holds`:

```json
{ "seatIds": [1201, 1202] }
```

Hold response, `201 Created`:

```json
{ "holdId": "h_8f3a", "seatIds": [1201, 1202], "expiresAt": "2026-11-01T18:05:00Z" }
```

Pay request, `POST /orders` (with the header `Idempotency-Key: 5c1e...`):

```json
{ "holdId": "h_8f3a", "paymentToken": "tok_visa_123" }
```

Errors:

| Status | When |
|---|---|
| 400 | invalid request, such as asking for more than 4 seats |
| 401 | missing or expired token |
| 402 | payment was declined |
| 409 | a seat is already held or sold by someone else |
| 410 | the hold has expired |
| 429 | too many requests, or the waiting room is still closed |

```json
{ "error": { "status": 409, "code": "SEAT_TAKEN", "message": "Seat 1202 is no longer available" } }
```

## 4. Data model

### users
| Column | Type | Notes |
|---|---|---|
| id | BIGINT | primary key |
| name | VARCHAR(100) | required |
| email | VARCHAR(255) | required, unique |
| password_hash | VARCHAR(255) | required |

### events
| Column | Type | Notes |
|---|---|---|
| id | BIGINT | primary key |
| name | VARCHAR(200) | required |
| venue | VARCHAR(200) | required |
| starts_at | TIMESTAMP | required |
| on_sale_at | TIMESTAMP | when tickets go on sale |

### seats
| Column | Type | Notes |
|---|---|---|
| id | BIGINT | primary key |
| event_id | BIGINT | foreign key to events(id) |
| section, row_label, seat_number | VARCHAR / INT | where the seat is |
| price_cents | INT | required |
| status | VARCHAR(10) | `available`, `held` or `sold` |
| held_by | BIGINT | foreign key to users(id), null unless held |
| held_until | TIMESTAMP | when the hold expires |

Unique: (event_id, section, row_label, seat_number), so a seat cannot be created twice.

### orders
| Column | Type | Notes |
|---|---|---|
| id | BIGINT | primary key |
| user_id | BIGINT | foreign key to users(id) |
| event_id | BIGINT | foreign key to events(id) |
| status | VARCHAR(10) | `paid` or `failed` |
| total_cents | INT | required |
| idempotency_key | VARCHAR(64) | unique, stops double charging |
| created_at | TIMESTAMP | default now |

### tickets
| Column | Type | Notes |
|---|---|---|
| id | BIGINT | primary key |
| order_id | BIGINT | foreign key to orders(id) |
| seat_id | BIGINT | foreign key to seats(id), **unique** |
| code | VARCHAR(40) | the ticket code shown as a QR code |

### Relationships
- **One-to-many:** one user has many orders, one event has many seats and many orders, and one order has many tickets.
- **One-to-one:** a seat has at most one ticket, which the unique `seat_id` on `tickets` enforces.
- A user can hold seats temporarily through `held_by`, and sold seats are linked to a user through the ticket's order.

## 5. How double-booking is prevented

Several layers protect each seat, and the database, not the cache, makes the final decision.

1. **An atomic conditional hold.** Holding a seat is one statement:

```sql
UPDATE seats
SET status = 'held', held_by = :user_id, held_until = NOW() + INTERVAL '5 minutes'
WHERE id = :seat_id
  AND (status = 'available' OR (status = 'held' AND held_until < NOW()));
```

If it changes 1 row, the user has the seat. If it changes 0 rows, someone else got there first and the API returns `409`. The database locks the row during the update, so two requests at the same instant are handled one after the other: the second one sees the seat as held and changes nothing.

2. **A transaction around multiple seats.** Holding two seats happens in one transaction. If any seat fails, the whole transaction rolls back, so nobody ends up with half an order.

3. **A transaction at payment time.** Paying runs `BEGIN`, locks the held seats with `SELECT ... FOR UPDATE`, checks they are still held by this user and not expired, then marks them `sold`, creates the order and the tickets, and runs `COMMIT`. If a hold has expired, the transaction rolls back and the API returns `410`.

4. **A constraint as the last line of defence.** `tickets.seat_id` is `UNIQUE`. Even if a bug in the code tried to sell a seat twice, the second insert would fail and the transaction would roll back.

5. **Idempotency.** Each payment carries an idempotency key, stored as a unique value on the order, so a retry after a timeout cannot charge the user twice.

6. **Hold expiry.** A hold lasts 5 minutes, and the `held_until` check means an expired hold is treated as free, so abandoned seats return to sale automatically. A worker also clears old holds so the seat map stays tidy.

The cached seat map is only a hint to the user. A seat can look free on screen and still be refused with `409`, but it can never be sold twice.

## 6. Architecture

```
                 Client (browser or app)
                            |
                            v
                          DNS
                            |
                            v
              CDN (pages, images, JS, CSS)
                            |
                            v
              +---------------------------+
              |  Waiting room (queue)     |   lets people in at a safe rate
              +-------------+-------------+
                            |
                            v
                  +-----------------+
                  |  Load balancer  |
                  +--------+--------+
                           |
          +----------------+----------------+
          v                v                v
    +-----------+    +-----------+    +-----------+
    | App server|    | App server|    | App server|   (autoscaled)
    +-----+-----+    +-----+-----+    +-----+-----+
          |                |                |
          +----------------+----------------+
                           |
     +----------+----------+----------+------------------+
     |          |                     |                  |
     v          v                     v                  v
 +-------+  +----------+         +---------+      +-------------+
 | Cache |  | Primary  |         |  Queue  |----->|   Workers   |
 |       |  | database |         |         |      | (emails,    |
 +-------+  +----+-----+         +---------+      |  QR codes,  |
                 |                                |  refunds)   |
          replicates                              +------+------+
                 |                                       |
                 v                                       v
          +--------------+                      +----------------+
          | Read replica |                      | Payment provider|
          +--------------+                      +----------------+
```

### Components

- **Client:** the browser or app the user touches, which sends requests and shows seats, holds and tickets.
- **DNS:** it solves finding the service by turning the site's name into the address of our entry point.
- **CDN:** it solves slow, crowded page loads by serving event pages, images and scripts from locations close to the user, so they never reach our servers.
- **Waiting room:** it solves the stampede at the start of a big sale by letting people in at a rate the system can handle, in the order they arrived.
- **Load balancer:** it solves one server being overloaded or failing by spreading requests across many app servers and skipping any that are down.
- **App servers:** they run the API logic, and because they keep no user state we can add more of them quickly when a sale starts.
- **Cache:** it solves the flood of repeated reads by keeping event details and a short-lived copy of the seat map in fast memory, so the database is not asked the same question thousands of times.
- **Primary database:** it solves correct, consistent storage by handling all seat holds, orders and tickets with transactions and constraints.
- **Read replica:** it solves read load on the primary by serving browsing and "my tickets" queries from a copy of the data.
- **Queue and workers:** they solve slow side-jobs by letting the app server reply straight away while workers send confirmation emails, create QR codes and retry refunds.
- **Payment provider:** it solves handling card payments safely, so we never store card numbers.

### How it survives the big sale

- The **waiting room** turns 333 arrivals per second into a steady flow, about 33 seats of buying per second, which one primary database can handle.
- The **CDN and cache** absorb most of the 3,300 requests per second, because event pages and the seat map can be shared between users.
- **App servers** are stateless, so more are added when the sale starts and removed afterwards.
- The **database only handles the writes that matter** (holds, payments), and each is a small, indexed update on a single seat row.
- **Slow work** (emails, QR codes) is moved to the queue, so it never slows the buying.
- **Rate limits** per user and per IP stop bots from flooding holds.
- **No single point of failure:** the load balancer, cache and queue run as clusters or managed services, there are several app servers in different zones, and the primary database replicates to a replica that can be promoted if it fails.

## 7. Trade-offs

1. **Waiting room: fairness and stability versus speed.** It keeps the site alive and the line fair, but some users wait several minutes and some will give up. Without it, the site might crash and fairness would depend on whose requests got through.
2. **Cached seat map: speed versus accuracy.** A seat map cached for 2 to 3 seconds is fast and cheap, but users sometimes click a seat that is already gone and get a `409`. We accept this because the database still guarantees correctness, and the cost is a slightly worse experience.
3. **Hold time: fewer lost sales versus locked-up seats.** A 5-minute hold gives people time to pay, but while it runs, those seats cannot be bought by others. A shorter hold frees seats faster but frustrates slow payers.
4. **One SQL primary: strong correctness versus write scaling.** One primary with transactions makes double-booking impossible to get wrong, and 33 writes per second is easy for it. The cost is that writes cannot be spread over many machines, so if the load grew a hundredfold we would need to split data per event (sharding).
