# Backups and how to recover – KPT Examinations website

Keep this guide. Read it calmly before you do anything – most problems do **not**
need a restore (see "First, do you really need a restore?").

---

## 1. What is backed up

| Backed up (in every backup file) | NOT in the backup |
|---|---|
| Everything in the database: students, exams, registrations, IA, attendance, fees, hall tickets, practical batches and marks, valuation, results, users of the website, settings, audit log | **Logins** – kept by Clerk (clerk.com) |
| | **Photos and uploaded files** – kept in Cloudinary and Google Drive (the backup keeps only their links) |

## 2. Where the backups are

- **Google Drive → folder "Backups"** – one file per backup, e.g. `kpt-backup-20261119-0200.kptbak`.
- **Website → Admin → Database backup** – the list, with *Open in Drive* and *Download*.

**When they are made**
- **Automatically every night** between about 2:00 and 3:00 AM (India time).
- **By hand** – *Back up now* on the same page (do it before big work: publishing results, a large import, a new academic year).

**How many are kept** (old ones are removed by themselves after every nightly backup)
- the newest of each of the last **7 days**
- the newest of each of the last **4 weeks**
- the first of each of the last **6 months**
- every backup marked **★ Kept** (click *Keep* on the list) – never removed

If a nightly backup fails, an email goes to the address shown on the backup page.
If the page shows an **orange** box ("last good backup 2 days ago"), the nightly backup is not working –
click *Back up now* and read the failed line in the list.

## 3. THE KEY – without it no backup can be opened

Every backup file is encrypted. It opens **only** with the key the website used when it was made.

- **Which key:** the setting named **`PAPER_MASTER_KEY`**
  (the website would use `BACKUP_KEY`, then `STUDENT_DATA_KEY`, if one of those were ever added – today neither is).
  Checked on 19-11-2026: the latest backup opens with `PAPER_MASTER_KEY`.
- **Where it is:**
  1. on the office computer, in the file `backend/.env` (line starting `PAPER_MASTER_KEY=`)
  2. on Vercel → the **backend** project → *Settings → Environment Variables* → `PAPER_MASTER_KEY`
- **Keep a third copy OFFLINE** – write the value on paper (sealed envelope with the Principal) or in a password manager.
  If both the computer and the Vercel account are lost, this copy is the only way to open the backups.
- **Never change `PAPER_MASTER_KEY`.** The question papers are encrypted with it too; a new value would make the
  old backups and the stored question papers unreadable.
- The key is **never** put on GitHub (`backend/.env` is not uploaded).

(`CRON_SECRET` on Vercel is a different thing – it only lets Vercel start the nightly backup. It is not needed to recover.)

## 4. First, do you really need a restore?

| What happened | Do this – no restore needed |
|---|---|
| A student / record was deleted by mistake | **Admin → Recycle bin** – restore it there (kept for 30 days) |
| Wrong marks / wrong fee tick | Correct it on the page; the audit log shows what it was before |
| The website does not open / shows errors | Check Vercel (deployments) and MongoDB Atlas (is the cluster running?) – the data is usually fine |
| Many records wrong or the database damaged / emptied | **Restore** – section 6 |
| MongoDB Atlas account or cluster lost | **New cluster + restore** – section 7 |

## 5. What you need on the computer (once)

1. The project folder (this one: `kptexams`), with `backend/.env` in it.
2. **Node.js** installed (nodejs.org, the LTS version). Check: open a terminal and type `node -v`.
3. In a terminal, once:
   ```
   cd "path\to\kptexams\backend"
   npm install
   ```

## 6. Restore, step by step

### Step 1 – get the backup file
Admin → Database backup → *Download* (or open Google Drive → Backups and download it).
Choose the newest backup **from before** the problem happened.
Put the file in the `backend` folder.

### Step 2 – look inside (changes NOTHING)
```
cd "path\to\kptexams\backend"
node --env-file=.env scripts/restoreBackup.js kpt-backup-20261119-0200.kptbak
```
It prints when the backup was made and how many records each part has (students, examregistrations, …).
If it says *"Unsupported state or unable to authenticate data"* → the key in `backend/.env` is not the one
the backup was made with (see section 3).

### Step 3 – restore into a NEW, empty database (safe – the live website is not touched)
You need the database link: open `backend/.env`, copy the value after `MONGO_URI=` (it starts with `mongodb+srv://`).
```
node --env-file=.env scripts/restoreBackup.js kpt-backup-20261119-0200.kptbak --to "PASTE-MONGO_URI-HERE" --db kpt_restore_check
```
This makes a separate database `kpt_restore_check` in the same Atlas cluster. Open it in MongoDB Atlas
(*Browse Collections*) and check that the data you need is there. The script refuses a database that already
has data, so you cannot overwrite anything by mistake in this step.

From here you can copy back only what was lost (ask the developer), **or** do step 4.

### Step 4 – replace the live data (only if the live database is really damaged)
**Everything done on the website after the backup's time is lost.** First make a backup of the damaged state
(*Back up now*, note "before restore"), so nothing is lost for ever.

Find the live database name: in `backend/.env`, the value after `MONGO_DB_NAME=`.
```
node --env-file=.env scripts/restoreBackup.js kpt-backup-20261119-0200.kptbak --to "PASTE-MONGO_URI-HERE" --db LIVE-DATABASE-NAME --replace
```
`--replace` empties each part of the live database and fills it from the backup.

### Step 5 – after a restore
- Open the website and check a few students, an exam, the fees.
- **Logins:** people added *after* the backup can still sign in (Clerk) but the website will not know them –
  add them again under Users.
- **Photos:** students whose photo was uploaded *after* the backup have the photo in Cloudinary but not the
  link – upload it again (Change photo).
- Make a fresh backup (*Back up now*, note "after restore").

## 7. If the MongoDB Atlas cluster itself is lost

1. Create a new free cluster in MongoDB Atlas; create a database user; allow access from anywhere (0.0.0.0/0) as before.
2. Copy its connection link (`mongodb+srv://…`).
3. Restore into it (section 6, step 3 – with the **new** link and `--db` = the old `MONGO_DB_NAME` value).
4. Put the new link in **Vercel → backend → Environment Variables → `MONGO_URI`** and in `backend/.env`, then redeploy.

## 8. Practise once (recommended, 15 minutes)

On a quiet day, do section 6 **steps 1–3** with yesterday's backup into `kpt_restore_check`.
If it opens and the numbers look right, you know the key and the steps work. Then delete the
`kpt_restore_check` database in Atlas (*Browse Collections → the database → Drop*).

## 9. Quick checklist to keep with the key

- [ ] `PAPER_MASTER_KEY` written down offline (sealed envelope / password manager)
- [ ] Admin → Database backup shows a green "Last backup today"
- [ ] Failure email address is correct on the backup page
- [ ] A test restore (section 8) done once
- [ ] Before results / big imports: *Back up now* and click **Keep** on it
