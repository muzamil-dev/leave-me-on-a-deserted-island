import { Database } from 'better-sqlite3';

export function initializeSchema(db: Database) {
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1), -- Single user for v1
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      dob_month INTEGER,
      dob_year INTEGER,
      aliases TEXT,          -- JSON array
      address_history TEXT,  -- JSON array
      imap_host TEXT,
      imap_user TEXT,
      imap_pass TEXT,        -- Should be encrypted
      captcha_api_key TEXT,
      captcha_provider TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      total_brokers INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0,
      failed INTEGER DEFAULT 0,
      skipped INTEGER DEFAULT 0,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    )
  `);

  
  db.exec(`
    CREATE TABLE IF NOT EXISTS opt_out_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      broker_id TEXT NOT NULL,
      status TEXT NOT NULL,
      method TEXT,
      error TEXT,
      screenshot_path TEXT,
      submitted_at DATETIME,
      confirmed_at DATETIME,
      next_recheck_at DATETIME,
      FOREIGN KEY (run_id) REFERENCES runs(id)
    )
  `);

  
  db.exec(`
    CREATE TABLE IF NOT EXISTS manual_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      broker_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      opt_out_url TEXT,
      instructions TEXT,
      resolved INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS discovered_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      broker_id TEXT NOT NULL,
      profile_url TEXT NOT NULL,
      found_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(broker_id, profile_url)
    )
  `);


  console.log('Database schema initialized.');
}
