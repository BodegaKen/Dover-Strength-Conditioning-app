# Deploying Dover Tigers S&C

This app needs two free accounts: **Neon** (a Postgres database) and **Vercel**
(hosting that runs the Next.js app and gives it a live URL). Both have
permanent free tiers that comfortably cover a single team's roster. Total
time: ~20 minutes, one-time.

---

## 1. Create the database (Neon)

1. Go to **neon.tech** → sign up (GitHub or Google sign-in is fastest).
2. Create a project — any name, e.g. "dover-sc".
3. On the project dashboard, click **Connection Details**. You'll see two
   connection strings (make sure "Pooled connection" is toggled where
   offered):
   - **Pooled** connection string → this is your `DATABASE_URL`
   - **Direct** (unpooled) connection string → this is your `DIRECT_URL`

   Both look like `postgresql://user:password@ep-xxxx.region.aws.neon.tech/dbname?sslmode=require`.
   Copy both somewhere safe — you'll paste them into Vercel in step 3.

That's the entire database setup. Neon's free tier auto-sleeps when idle and
wakes on the next request in under a second — fine for a team tool like this.

---

## 2. Push the code to GitHub

Vercel deploys from a GitHub repo.

1. Go to **github.com** → sign up if you don't have an account.
2. Create a new **empty** repository (no README/license) — name it
   `dover-sc-app`, visibility Private is fine.
3. On your own computer (or wherever you unzip this project), run:
   ```
   cd dover-sc-app
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/dover-sc-app.git
   git push -u origin main
   ```
   (If you don't have `git` installed, GitHub's "uploading an existing
   folder" web UI also works — drag the whole unzipped folder in, except
   `node_modules` if present.)

---

## 3. Deploy on Vercel

1. Go to **vercel.com** → sign up with your GitHub account (this lets Vercel
   see your repos directly).
2. **Add New → Project**, pick `dover-sc-app` from the list, click Import.
3. Before clicking Deploy, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the **pooled** Neon connection string from step 1 |
   | `DIRECT_URL` | the **direct** Neon connection string from step 1 |
   | `JWT_SECRET` | any long random string — generate one with `openssl rand -base64 32`, or just mash the keyboard for 40+ characters |
   | `COACH_NAME` | your name, e.g. `Coach Quinones` |
   | `COACH_USERNAME` | the username you want to log in with, e.g. `kquinones` |
   | `COACH_PIN` | a 4-6 digit PIN you'll use to log in the first time |

4. Click **Deploy**. First build takes 1-2 minutes. When it finishes you'll
   have a live URL like `dover-sc-app.vercel.app`.

---

## 4. Create the database tables and your coach account

The app's tables don't exist in the fresh Neon database yet, and neither
does your coach login. Both are created by running two commands **once**
against the production database. Easiest way, from your own computer:

```
cd dover-sc-app
npm install
```
Create a file named `.env` in the project folder (same folder as
`package.json`) with the same six values you put into Vercel:
```
DATABASE_URL="<pooled Neon connection string>"
DIRECT_URL="<direct Neon connection string>"
JWT_SECRET="<same long random string you put in Vercel>"
COACH_NAME="Coach Quinones"
COACH_USERNAME="kquinones"
COACH_PIN="1234"
```
Then run:
```
npx prisma migrate deploy
npm run seed
```
The second command prints your coach username and PIN — that's also just
what you put in `.env`, so nothing new to write down. (Keep this `.env` file
private; don't commit it to GitHub — it's already in `.gitignore`.)

---

## 5. Log in

Go to your Vercel URL, sign in with the coach username/PIN from step 3, and
you're in the Roster Admin screen. From there:

- **Add your roster** — one at a time, or paste the whole team (pasted from
  Hudl, MaxPreps, or a spreadsheet) via "Add the whole roster at once." Each
  player gets an auto-generated username and a random 4-digit PIN, shown to
  you once — hand those out to the players. They'll be asked to pick their
  own PIN the first time they log in.
- **Set the current phase/week** at the top of the Coach page — that's what
  drives every player's "This Week" numbers.
- Everything else (testing, logging, the leaderboard, progress charts) the
  players run themselves from their own logins.

---

## Day-to-day maintenance

- **A player graduates or leaves**: Archive them in Roster Admin (not
  Delete) — this keeps their lifts on the all-time leaderboard forever while
  removing them from the active roster and today's numbers.
- **A player forgets their PIN**: Reset PIN in Roster Admin gives you a new
  one to hand them; they'll be asked to set their own on next login.
- **Changing the phase/week**: just update it in the Coach page each week —
  no redeploy needed.
- **Updating the program's actual numbers** (a change to sets/reps/%e1RM in
  a future offseason): that lives in `data/program-data.json` in the code —
  edit it, commit, and push to GitHub; Vercel redeploys automatically.

## If something breaks

- **Vercel build fails**: click into the failed deployment's build log —
  it's almost always a missing/misspelled environment variable from step 3.
- **"Can't reach database"**: double check `DATABASE_URL`/`DIRECT_URL` were
  pasted correctly (no stray line breaks) and that the Neon project isn't
  paused (it wakes automatically on the next request, but very first-ever
  connections sometimes need a retry).
- Neither Neon nor Vercel charges a card on the free tier used here; nothing
  here can run up a bill unintentionally.
