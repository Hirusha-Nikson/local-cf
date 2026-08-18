-- Grows the demo from one table into something that looks like a real
-- application: authors, threaded comments and a many-to-many tag join.
--
-- Deliberately written as an evolution of 0001 rather than a replacement.
-- Applying it exercises the part of the migration runner that matters — a
-- schema change against a table that already holds rows — and it is what the
-- D1 tab looks like on a project that has been alive for a while.

CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  handle     TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL DEFAULT 'author',
  avatar_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Three columns onto a populated table. 0004 backfills the rows that 0002
-- inserted before these existed.
ALTER TABLE posts ADD COLUMN author_id INTEGER REFERENCES users (id);
ALTER TABLE posts ADD COLUMN status    TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE posts ADD COLUMN views     INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  author_id  INTEGER REFERENCES users (id),
  -- Null for a top-level comment, otherwise the comment being replied to.
  parent_id  INTEGER REFERENCES comments (id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  approved   INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tags (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  slug  TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS post_tags (
  post_id INTEGER NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX IF NOT EXISTS posts_author     ON posts (author_id);
CREATE INDEX IF NOT EXISTS posts_status     ON posts (status);
CREATE INDEX IF NOT EXISTS comments_post    ON comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS comments_parent  ON comments (parent_id);
