CREATE TABLE IF NOT EXISTS bb_guide_preferences (
  user_id INTEGER PRIMARY KEY,
  language TEXT NOT NULL DEFAULT 'en',
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bb_guide_progress (
  user_id INTEGER NOT NULL,
  guide_key TEXT NOT NULL,
  completed_step INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, guide_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bb_guide_progress_user
  ON bb_guide_progress(user_id, updated_at);
