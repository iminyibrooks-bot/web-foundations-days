# SnapShare Scaling Plan

SnapShare is a photo-sharing app where users upload photos and scroll a feed of photos from people they follow.

## Assumptions

- 10 million registered users, and 10% are active each day.
- Each active user uploads 1 photo per day and views 50 feed pages per day.
- An average photo is 2 MB, and each photo also gets a 50 KB thumbnail.
- Traffic is spread evenly over 24 hours (86,400 seconds) for the average, and the peak is 5 times the average.
- 1 TB = 1,000,000 MB and 1 GB = 1,000,000 KB (decimal units, to keep the maths simple).
- Photo metadata (owner, caption, file location) is about 1 KB per photo, so it is tiny compared with the photo files.

## Calculations

### Daily active users

10,000,000 registered users x 10% = **1,000,000 daily active users**

### Uploads per second

| Measure | Working | Result |
|---|---|---|
| Uploads per day | 1,000,000 users x 1 photo | 1,000,000 |
| Average uploads per second | 1,000,000 / 86,400 | about 12 per second |
| Peak uploads per second | 12 x 5 | about 58 per second |

At the peak, uploads bring in about 58 x 2 MB = **116 MB per second** of photo data.

### Feed views per second

| Measure | Working | Result |
|---|---|---|
| Feed views per day | 1,000,000 users x 50 pages | 50,000,000 |
| Average feed views per second | 50,000,000 / 86,400 | about 579 per second |
| Peak feed views per second | 579 x 5 | about 2,900 per second |

### Photo storage per year

| Measure | Working | Result |
|---|---|---|
| Original photos per day | 1,000,000 x 2 MB | 2 TB |
| Thumbnails per day | 1,000,000 x 50 KB | 50 GB |
| Original photos per year | 2 TB x 365 | 730 TB |
| Thumbnails per year | 50 GB x 365 | about 18.25 TB |
| **Total per year** | 730 TB + 18.25 TB | **about 748 TB (roughly 0.75 PB)** |

Metadata adds only about 1,000,000 x 1 KB x 365 = 365 GB per year, which is under 0.1% of the photo storage.

## Read-heavy or write-heavy?

SnapShare is **read-heavy**. There are 50,000,000 feed views per day against 1,000,000 uploads per day, which is a ratio of **50 reads for every 1 write**.

What this means for the design:

- Most effort should go into making reads cheap: a CDN for photos, a cache for feeds and metadata, and a read replica so reads do not compete with writes.
- Writes (about 12 per second on average) are low enough for one primary database, so we do not need to split (shard) the database yet.
- Because a photo is written once and read many times, caching works very well: a cached photo or feed page is reused hundreds of times.

## Why photos should not be stored inside the database

- **Size:** 748 TB per year of photos would make the database huge, slow to back up and expensive to restore, while the metadata is only about 365 GB.
- **Cost:** database storage is far more expensive per gigabyte than object storage, which is built for large files.
- **Performance:** serving 2 MB files through the database would fill its memory and connections, slowing down the small, fast queries that the feed needs.
- **Scaling and delivery:** object storage grows almost without limit and plugs straight into a CDN, while a database does not.

So the photo files (originals and thumbnails) go in **object storage**, and the database keeps only the metadata and the file's location (a key or URL).

## Architecture diagram

```
            Users (phones and browsers)
                       |
                       v
               +---------------+
               |      CDN      |-----> serves photos and thumbnails
               +-------+-------+       (fetches from object storage on a miss)
                       |
                       v
               +---------------+
               | Load balancer |
               +-------+-------+
                       |
        +--------------+--------------+
        |              |              |
        v              v              v
  +-----------+  +-----------+  +-----------+
  | App server|  | App server|  | App server|
  +-----+-----+  +-----+-----+  +-----+-----+
        |              |              |
        +--------------+--------------+
                       |
     +-----------+-----+------+-----------------+
     |           |            |                 |
     v           v            v                 v
+--------+  +----------+  +---------+   +----------------+
| Cache  |  | Database |  |  Queue  |   | Object storage |
|        |  | (primary)|  |         |   | (photo files)  |
+--------+  +----+-----+  +----+----+   +--------^-------+
                 |             |                 |
         replicates            v                 |
                 |        +----------+           |
                 v        |  Worker  |-----------+
          +-------------+ | (thumb-  |  reads original,
          | Read replica| |  nails)  |  writes 50 KB thumbnail
          +-------------+ +----------+
```

## Components

- **CDN:** it solves slow photo loading for users far from our servers by keeping copies of photos and thumbnails at locations close to them, and it takes most of the photo traffic off our servers.
- **Load balancer:** it solves the problem of one server being overloaded or going down by spreading requests across many app servers and skipping any that fail.
- **App servers:** they run the application logic (log in, upload, feed) and, because they hold no user state, we can add more of them as traffic grows.
- **Cache:** it solves repeated slow database reads by keeping hot data, such as feed pages and photo metadata, in fast memory.
- **Database (primary):** it solves safe, consistent storage of the data that must never be lost, such as users, follows and photo metadata, and it handles all writes.
- **Read replica:** it solves read load on the primary by holding a copy of the data that serves feed reads, which are the vast majority of queries.
- **Object storage:** it solves storing hundreds of terabytes of photo files cheaply and durably, and it connects directly to the CDN.
- **Queue:** it solves slow uploads by letting the app server hand off the thumbnail job and reply to the user immediately, and it holds jobs safely if the workers are busy.
- **Worker:** it solves the heavy work of resizing images by taking jobs from the queue and creating the 50 KB thumbnails away from the user's request.

## Upload flow, step by step

1. The user picks a photo in the app, and the app sends it to SnapShare through the load balancer.
2. The load balancer sends the request to one healthy app server.
3. The app server checks that the user is logged in and that the file is a valid image of an allowed size.
4. The app server saves the original photo (about 2 MB) in object storage and gets back its location.
5. The app server writes a row in the database primary with the owner, caption, time, the photo's location and the status `processing`.
6. The app server puts a "create thumbnail" job on the queue, containing the photo's id.
7. The app server replies to the user straight away with "upload successful", so the user does not wait for the thumbnail.
8. A worker takes the job from the queue, reads the original from object storage and creates a 50 KB thumbnail.
9. The worker saves the thumbnail in object storage and updates the database row with the thumbnail's location and the status `ready`.
10. The cache entries for the followers' feeds are refreshed or expired, so the photo appears in their feeds, and the CDN serves its thumbnail.

If a worker fails halfway, the job goes back on the queue and is retried, so the thumbnail is still created.

## Trade-offs

1. **Caching speeds up feeds but can show stale data.** A feed can be a few seconds or minutes out of date, so a new photo may not appear straight away. We accept this because feeds do not need to be perfectly fresh, and it keeps the database load low. Shorter cache times give fresher feeds but more database load.
2. **Read replicas scale reads but lag behind the primary.** A replica can be a moment behind, so a user could upload a photo and not see it immediately. We accept this for scalable reads, and for the user's own photos we can read from the primary or the cache so they see their upload at once.
3. **A queue makes uploads fast but thumbnails arrive late.** The user gets a quick reply, but for a short time the photo has no thumbnail, so the app must show a placeholder. It also adds another component to run and monitor.
4. **A CDN cuts latency and load but costs money and can serve old files.** Photos rarely change, so it is worth it, but if a photo is deleted it may stay on CDN servers until its cached copy expires.
