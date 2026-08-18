-- Enough data that the dashboard has something honest to show: 12 authors,
-- 24 posts across three statuses, 32 comments including replies, and a tag
-- join with real overlap.
--
-- Values are handwritten rather than generated in a recursive CTE. "Post 41"
-- repeated forty times proves the table renders; it does not show what the
-- table browser is like to actually read, which is the only thing worth
-- looking at in a screenshot.

INSERT INTO users (handle, name, email, role, avatar_key, created_at) VALUES
  ('nikson',  'H Nikson',        'nikson@example.dev',  'owner',     'avatars/nikson.png',  '2025-11-02T08:14:00Z'),
  ('mira',    'Mira Halvorsen',  'mira@example.dev',    'editor',    'avatars/mira.png',    '2025-11-19T13:40:00Z'),
  ('tobias',  'Tobias Lund',     'tobias@example.dev',  'author',    'avatars/tobias.png',  '2025-12-03T09:05:00Z'),
  ('sana',    'Sana Qureshi',    'sana@example.dev',    'author',    'avatars/sana.png',    '2026-01-08T17:22:00Z'),
  ('devin',   'Devin Okonkwo',   'devin@example.dev',   'author',    'avatars/devin.png',   '2026-01-27T11:48:00Z'),
  ('yuki',    'Yuki Tanabe',     'yuki@example.dev',    'author',    'avatars/yuki.png',    '2026-02-14T15:31:00Z'),
  ('rosa',    'Rosa Iglesias',   'rosa@example.dev',    'editor',    'avatars/rosa.png',    '2026-03-02T10:09:00Z'),
  ('kwame',   'Kwame Boateng',   'kwame@example.dev',   'author',    'avatars/kwame.png',   '2026-03-21T14:55:00Z'),
  ('elin',    'Elin Marchetti',  'elin@example.dev',    'author',    NULL,                  '2026-04-11T07:37:00Z'),
  ('bogdan',  'Bogdan Petrescu', 'bogdan@example.dev',  'author',    NULL,                  '2026-05-06T19:03:00Z'),
  ('aiko',    'Aiko Nakamura',   'aiko@example.dev',    'moderator', 'avatars/aiko.png',    '2026-06-18T12:26:00Z'),
  ('samir',   'Samir Haddad',    'samir@example.dev',   'author',    NULL,                  '2026-07-29T16:44:00Z');

-- The three rows from 0002 predate author_id/status/views. Backfill them so
-- there is no island of NULLs sitting at the top of the table.
UPDATE posts SET author_id = 1, status = 'published', views = 1420 WHERE id = 1;
UPDATE posts SET author_id = 2, status = 'published', views =  980 WHERE id = 2;
UPDATE posts SET author_id = 1, status = 'draft',     views =    0 WHERE id = 3;

INSERT INTO posts (title, body, created_at, author_id, status, views) VALUES
  ('Why our D1 writes doubled after a schema change',      'The index we added was never used by the query planner, but it was still maintained on every insert.', '2026-01-14T09:12:00Z', 3, 'published',  8420),
  ('Reading KV metadata without a second round trip',      'getWithMetadata returns both in one call. We had been issuing two.',                                  '2026-01-22T14:38:00Z', 4, 'published',  6115),
  ('R2 multipart uploads from a Worker',                   'Anything over about 90 MB needs the multipart API, and the part size has to be uniform.',             '2026-02-03T11:05:00Z', 5, 'published',  4902),
  ('A Durable Object is not a database',                   'Treating one as a shared table gets you a single-threaded bottleneck with extra steps.',              '2026-02-17T16:21:00Z', 3, 'published', 12308),
  ('Queue consumers and the retry you did not plan for',   'A thrown error retries the whole batch, not the message. Ack early and often.',                       '2026-02-28T08:47:00Z', 6, 'published',  3771),
  ('Measuring cold starts honestly',                       'The first request after a deploy is not a cold start. The first request to a new isolate is.',        '2026-03-09T13:14:00Z', 7, 'published',  5566),
  ('Migrations that are safe to run twice',                'IF NOT EXISTS is not idempotency. It is a way to hide that you have no idempotency.',                 '2026-03-18T10:52:00Z', 2, 'published',  7194),
  ('Local development without a Cloudflare account',       'Everything below the account boundary runs offline. That is more than people expect.',                '2026-03-30T15:09:00Z', 1, 'published', 15240),
  ('Storing binary values in KV',                          'Base64 costs you a third of your value budget. Use the arrayBuffer form.',                            '2026-04-07T09:33:00Z', 8, 'published',  2988),
  ('The persist directory is just SQLite',                 'Which means you can open it, back it up, and corrupt it like any other SQLite file.',                 '2026-04-19T12:41:00Z', 1, 'published',  9037),
  ('Prefix listing is not a filesystem',                   'R2 delimiters give you folder-shaped results over a flat keyspace. The difference bites at scale.',   '2026-04-27T17:58:00Z', 5, 'published',  3402),
  ('Rate limiting with a Durable Object alarm',            'One object per key, one alarm per window. The alarm is what makes it cheap.',                         '2026-05-08T11:26:00Z', 6, 'published',  6680),
  ('When to reach for Hyperdrive',                         'If your origin database is the latency, a connection pool at the edge is the fix.',                   '2026-05-21T14:03:00Z', 9, 'published',  2145),
  ('Testing Workers without deploying them',               'Miniflare runs the same workerd binary. The fidelity argument is mostly settled.',                    '2026-06-02T08:19:00Z', 4, 'published',  8811),
  ('Two processes, one SQLite file, zero survivors',       'WAL mode does not make concurrent writers from separate runtimes safe.',                              '2026-06-15T16:47:00Z', 1, 'published', 11726),
  ('Structured logging that survives the tail',            'console.log of an object is not structured. JSON.stringify it or lose the fields.',                   '2026-06-24T10:35:00Z',10, 'published',  1904),
  ('Cache API versus KV, decided by TTL',                  'Under a minute, use the Cache API. Over an hour, use KV. In between, measure.',                       '2026-07-06T13:52:00Z', 7, 'published',  5273),
  ('A postmortem on our queue backlog',                    'Max batch size of one turned a spike into a four-hour tail. It is now ten.',                          '2026-07-15T09:08:00Z', 8, 'review',        0),
  ('Durable Object storage limits in practice',            'The 128 KB value cap is per key, and the error you get when you exceed it is unhelpful.',             '2026-07-28T15:24:00Z',11, 'review',        0),
  ('Everything we got wrong about edge caching',           'Draft. Needs the numbers from the March incident before this goes anywhere.',                         '2026-08-04T11:41:00Z', 2, 'draft',         0),
  ('Notes towards a local-first workflow',                 'Draft. Half of this is an argument with myself about when the network should be involved.',           '2026-08-12T18:06:00Z',12, 'draft',         0);

INSERT INTO tags (slug, label) VALUES
  ('d1',              'D1'),
  ('kv',              'KV'),
  ('r2',              'R2'),
  ('durable-objects', 'Durable Objects'),
  ('queues',          'Queues'),
  ('performance',     'Performance'),
  ('postmortem',      'Postmortem'),
  ('local-first',     'Local-first');

INSERT INTO post_tags (post_id, tag_id) VALUES
  (4, 1), (4, 6),
  (5, 2),
  (6, 3),
  (7, 4), (7, 6),
  (8, 5), (8, 7),
  (9, 6),
  (10, 1),
  (11, 8),
  (12, 2),
  (13, 1), (13, 8),
  (14, 3),
  (15, 4), (15, 5),
  (16, 6),
  (17, 8),
  (18, 1), (18, 7),
  (19, 6),
  (20, 2), (20, 6),
  (21, 5), (21, 7),
  (22, 4),
  (23, 6), (23, 7),
  (24, 8);

INSERT INTO comments (post_id, author_id, parent_id, body, approved, created_at) VALUES
  ( 4,  5, NULL, 'We hit this exact thing last quarter. The planner ignored the index until we rewrote the WHERE clause.', 1, '2026-01-14T15:22:00Z'),
  ( 4,  3,    1, 'Do you remember which form it ended up preferring? We are mid-rewrite on the same table.',               1, '2026-01-15T08:41:00Z'),
  ( 4,  5,    2, 'Equality first, then the range. Putting the range column first was the whole problem.',                  1, '2026-01-15T10:03:00Z'),
  ( 5,  6, NULL, 'This saved us a measurable amount of latency on the session path. Two calls to one.',                    1, '2026-01-23T09:17:00Z'),
  ( 5,  4,    4, 'Worth noting the metadata is capped at 1 KB, so it is not a general escape hatch.',                      1, '2026-01-23T11:55:00Z'),
  ( 6,  1, NULL, 'The uniform part size requirement is buried in the docs and costs everyone a day.',                      1, '2026-02-04T13:30:00Z'),
  ( 7,  2, NULL, 'Strong agree. We moved three of ours back to D1 and the p99 halved.',                                    1, '2026-02-18T09:48:00Z'),
  ( 7,  8,    7, 'Did you keep any as DOs? Curious where you drew the line.',                                              1, '2026-02-18T14:12:00Z'),
  ( 7,  2,    8, 'Anything needing a single writer stayed. Anything doing reads at fan-out moved.',                        1, '2026-02-19T08:26:00Z'),
  ( 8,  7, NULL, 'The batch-level retry semantics are the single most surprising thing about Queues.',                     1, '2026-03-01T10:14:00Z'),
  ( 8,  6,   10, 'retryAll() with delaySeconds made ours tolerable, but ack-per-message is the real fix.',                 1, '2026-03-01T16:39:00Z'),
  ( 9,  3, NULL, 'Please define "new isolate" — I think half our dashboard is measuring the wrong event.',                 1, '2026-03-10T11:07:00Z'),
  ( 9,  7,   12, 'Any request that cannot be served by an existing one. Deploys are a subset, not the set.',               1, '2026-03-10T15:44:00Z'),
  (10,  9, NULL, 'The distinction between "will not error" and "is idempotent" deserves its own post.',                    1, '2026-03-19T09:52:00Z'),
  (11,  4, NULL, 'This is the argument that got our team to try local-first tooling at all.',                              1, '2026-03-31T12:18:00Z'),
  (11, 10,   15, 'Same. The no-account part is what made it an easy sell to security.',                                    1, '2026-04-01T08:33:00Z'),
  (12,  1, NULL, 'arrayBuffer form also skips a string allocation you do not need. Worth it twice over.',                  1, '2026-04-08T14:26:00Z'),
  (13,  5, NULL, 'Learned this the hard way by opening it with the wrong workerd and losing an afternoon.',                1, '2026-04-20T10:41:00Z'),
  (13,  1,   18, 'That failure mode is why the CLI warns on a version mismatch now.',                                      1, '2026-04-20T16:09:00Z'),
  (14,  6, NULL, 'The delimiter behaviour matches S3 closely enough that the S3 mental model transfers.',                  1, '2026-04-28T11:33:00Z'),
  (15,  8, NULL, 'One object per key is obvious in hindsight and took us two designs to reach.',                           1, '2026-05-09T09:15:00Z'),
  (15, 11,   21, 'Did you need to worry about the alarm firing on a cold object?',                                         1, '2026-05-09T13:47:00Z'),
  (15,  6,   22, 'It wakes the object. That is the point — the alarm is the only thing that has to be scheduled.',         1, '2026-05-10T08:52:00Z'),
  (16,  2, NULL, 'We reached for it too early. The origin was not the bottleneck; our own query was.',                     1, '2026-05-22T15:28:00Z'),
  (17,  9, NULL, 'The fidelity argument being settled is doing a lot of work in that sentence.',                           0, '2026-06-03T10:04:00Z'),
  (17,  4,   25, 'Fair. It is settled for bindings. Not for anything touching the account API.',                           1, '2026-06-03T14:37:00Z'),
  (18,  3, NULL, 'Bookmarking this for the next person who suggests sharing a persist directory.',                         1, '2026-06-16T09:26:00Z'),
  (19, 12, NULL, 'JSON.stringify or lose the fields is the whole post and it should be on a poster.',                      1, '2026-06-25T12:11:00Z'),
  (20,  7, NULL, 'The in-between case is where we spend all our time and "measure" is the honest answer.',                 1, '2026-07-07T16:53:00Z'),
  (21,  1, NULL, 'Holding this until the numbers are in. Do not publish yet.',                                            0, '2026-07-16T08:29:00Z'),
  (22, 11, NULL, 'The 128 KB error message says "too large" and nothing about which key. Filed upstream.',                 1, '2026-07-29T13:18:00Z'),
  (22,  5,   31, 'Wrapping the put and rethrowing with the key attached is the workaround we settled on.',                 1, '2026-07-30T09:44:00Z');
