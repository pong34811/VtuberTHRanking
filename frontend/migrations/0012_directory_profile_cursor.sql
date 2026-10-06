CREATE TABLE directory_profile_cursor (
  id INTEGER PRIMARY KEY CHECK (id=1),
  last_vtuber_id INTEGER NOT NULL DEFAULT 0
);
INSERT INTO directory_profile_cursor(id) VALUES (1);
