import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import axios from 'axios';
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/scrubbed.db');
const db = new Database(dbPath);

export async function listenForEmails() {
  const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get() as any;
  
  if (!profile || !profile.imap_host || !profile.imap_user || !profile.imap_pass) {
    console.log('IMAP credentials not configured. Email listener skipped.');
    return;
  }

  console.log(`Starting email listener for ${profile.imap_user}...`);

  const client = new ImapFlow({
    host: profile.imap_host,
    port: 993,
    secure: true,
    auth: {
      user: profile.imap_user,
      pass: profile.imap_pass 
    },
    logger: false
  });

  try {
    await client.connect();
    let lock = await client.getMailboxLock('INBOX');

    try {
      
      const messages = await client.search({ seen: false });

      if (messages) {
        for (const uid of messages) {
          const { content } = await client.download(uid.toString());
          const parsed = await simpleParser(content);

          
          const links = extractLinks(parsed.html || parsed.text || '');
          for (const link of links) {
            if (isConfirmationLink(link)) {
              console.log(`Found confirmation link: ${link}`);
              await axios.get(link);
              
            }
          }
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (error) {
    console.error('Email listener error:', error);
  }
}

function extractLinks(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"]+/g;
  return text.match(urlRegex) || [];
}

function isConfirmationLink(link: string): boolean {
  const keywords = ['confirm', 'opt-out', 'remove', 'verify', 'click'];
  return keywords.some(k => link.toLowerCase().includes(k));
}
