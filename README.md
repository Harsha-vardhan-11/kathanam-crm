# Kathanam's CRM Platform

A private CRM for **Kathanam** (a Golden Media company). Use it to track weddings and events, booking dates, crew, equipment, footage (GB), deliverables, terms, client payments, team payouts and expenses. You can use it on your laptop, PC or phone, from anywhere.

## It is completely free

| Part | What it does | Cost |
|---|---|---|
| **GitHub Pages** | Hosts the app at `https://<you>.github.io/kathanam-crm` | Free |
| **Google Apps Script** (in your own Google account) | Saves your data in your Google Drive and adds events to your Google Calendar | Free |

Neither service asks for a card, so neither can charge you. There's no Google Cloud console and no API key. If you ever went over Google's free daily limits (tens of thousands of requests, far more than a CRM uses), the script would simply stop until the next day. You would not get a bill.

---

## Put it online (one time, about 15 minutes)

### Part A — Your free backend in Google (5 min)

1. Go to **[script.google.com](https://script.google.com)** while signed in to the Google account whose Drive and Calendar you want to use. Click **New project**.
2. Delete the sample code. Paste in everything from [`apps-script/Code.gs`](apps-script/Code.gs). Rename the project to **Kathanam CRM** and click 💾 **Save**.
3. In the toolbar, choose the function **`setup`** and click **▶ Run**.
   - Google asks for permission. Click **Review permissions**, choose your account, then **Advanced → Go to Kathanam CRM (unsafe) → Allow**. It says "unsafe" only because you wrote the app yourself and Google hasn't reviewed it.
   - The **Execution log** then shows **YOUR SECRET KEY**. Copy it somewhere safe, like a password manager.
4. Click **Deploy → New deployment**. Click the ⚙ gear and choose **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**. This is needed so your phone can reach it. Nobody can read your data without the secret key.
   - Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).

### Part B — Host the app on GitHub Pages (10 min)

1. Create a free account at **[github.com](https://github.com)** if you don't have one.
2. Click **+ → New repository**. Name it `kathanam-crm`, choose **Public** (needed for free Pages), and click **Create repository**.
   - The code is public, but **your data is not**. Your data lives only in your Google Drive. Client details, payments and keys never go to GitHub; `.gitignore` keeps them out.
3. Upload the code. The easiest way is the button on the new repository page: **uploading an existing file**. Drag in everything inside this `kathanam-crm` folder (`docs`, `apps-script`, `README.md`, `server.py`, `start.bat`, `.gitignore`), then click **Commit changes**.
   - Or from a terminal in this folder:
     ```bash
     git push -u origin main
     ```
     First run `git remote add origin https://github.com/<you>/kathanam-crm.git`.
4. In the repository, go to **Settings → Pages**. Under Source, choose **Deploy from a branch**, branch **main**, folder **/docs**, then **Save**.
5. After a minute, your app is live at **`https://<you>.github.io/kathanam-crm/`**.

### Part C — Open it on each device

1. Open your link on your laptop and on your phone.
2. Paste the **Web app URL** and the **Secret key**, then press **Connect**. You do this once per device.
3. On your phone, add an app icon:
   - Android: Chrome ⋮ menu → **Add to Home screen**
   - iPhone: Safari Share → **Add to Home Screen**

That's it. Every event you save now also appears in your Google Calendar.

---

## The Assistant (optional, free)

Tell it what happened in plain words, typed or spoken (🎤). For example:

> New booking: Ravi & Priya, 98765 43210. Wedding 13 Dec 7pm at N Convention, reception 14 Dec 7pm same venue. Candid photo + drone for both, 2 LED screens and live streaming at reception. Quote 4.5L, advance 1L by UPI today.

It shows a checklist of everything it will add: the client project, each event with its coverage, crew, and payments. It asks about anything missing. **Nothing is saved until you tick what's right and press Confirm.** It never deletes anything.

It runs on Google's **Gemini free tier**, called from your own Apps Script, so it needs no card and can't bill you. At worst it hits a daily limit and asks you to try later. To switch it on:

1. Go to **[aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)** and click **Create API key**.
2. In Apps Script, go to ⚙ **Project Settings → Script Properties → Add script property**. Set Property to `GEMINI_KEY`, set Value to your key, and click **Save**.

Privacy note: on the free tier, Google may use what you send to improve its products. Only the message you type, plus the names of your projects, clients and team, is sent. Payments history is not.

## What's inside

| Page | What it's for |
|---|---|
| **Dashboard** | Upcoming events, money received, client dues, team dues, expenses, cash in hand |
| **Projects** | One per wedding, each with the 9 stages: 01 Client & Agreement · 02 Payments · 03 Event Schedule · 04 Team & Vendors · 05 Travel & Logistics · 06 Production · 07 Raw Footage (GB and backups) · 08 Post Production · 09 Final Deliverables |
| **Assistant** | Add clients, events, coverage and payments from one plain-language message, then confirm |
| **Events** | Each event has coverage checkboxes (Traditional Photography, Traditional Videography, Candid Photography, Candid Videography, Drone, Live Streaming, LED Screens) and a coverage-notes field. Coverage appears in Google Calendar and on the quotation |
| **Calendar** | Month view of booked dates. Tap a date to book it. Warns you when a person or a piece of gear is booked twice on the same day |
| **Team** | Crew and vendors, day rates, what you've paid them and what you still owe |
| **Equipment** | Gear list and which events each item is booked for |
| **Money** | Every client payment, payout and expense, with filters and a CSV export for Excel |
| **Settings** | Business details, default terms & conditions, backup and restore, Google Calendar |

**Printable documents** (choose Print / Save as PDF, then send on WhatsApp or email):
- **Quotation & Agreement:** client details, event dates and venues, deliverables, the amount in words, payment details, terms, and signature lines
- **Payment statement:** every payment received and the balance due
- **Receipt** for each client payment

Fill in **Settings → Business details** first so your phone, address and UPI appear on them.

## Your data and safety

- Your data is one file in the **"Kathanam CRM"** folder of your Google Drive. A dated backup copy is added every day, and the last 30 are kept.
- You can also use **Settings → Download backup** at any time. **Restore from backup** brings a backup file back.
- **Lost a phone?** In Apps Script, run **`resetKey`**, copy the new key from the log, and reconnect your other devices with it. The lost phone stops working.
- Make calendar changes in the CRM, not in Google Calendar. The CRM is the master copy.
- Two devices editing at the same moment is handled safely: the second one is told to reload and redo its change.

## Updating the backend later

If `Code.gs` changes, paste the new version into Apps Script, then go to **Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy**. The URL stays the same, so your devices keep working.

## Offline mode (optional)

With no internet, you can run the CRM on your laptop: double-click **`start.bat`**, or run `python server.py`. Phones on the same Wi-Fi can open the address it prints. Offline mode keeps its data in `data/db.json` on the laptop, separate from the online version. To move data between the two, use **Download backup** in one and **Restore from backup** in the other. To lock offline mode with a PIN, set `"pin"` in `config.json`.
