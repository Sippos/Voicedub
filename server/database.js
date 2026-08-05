const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'voicedub.sqlite'));

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS clips (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    tags TEXT DEFAULT '[]',
    filename TEXT NOT NULL,
    original_url TEXT NOT NULL,
    script_cues TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dubs (
    id TEXT PRIMARY KEY,
    clip_id TEXT NOT NULL,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    audio_filename TEXT NOT NULL,
    audio_url TEXT NOT NULL,
    mix_volume REAL DEFAULT 0.2,
    created_at TEXT NOT NULL,
    FOREIGN KEY(clip_id) REFERENCES clips(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reactions (
    dub_id TEXT NOT NULL,
    reaction_type TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    PRIMARY KEY(dub_id, reaction_type),
    FOREIGN KEY(dub_id) REFERENCES dubs(id) ON DELETE CASCADE
  );
`);

module.exports = db;
