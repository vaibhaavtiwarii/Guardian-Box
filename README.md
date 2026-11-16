# 🛡️ GuardianBox — Zero-Knowledge Encrypted File Sharing

> **The server is blind.** Your files are encrypted in the browser before they ever leave your device. The server stores only unreadable ciphertext. Not even we can see what you share.

**🌐 Live demo: [guardianbox-w5gu.onrender.com](https://guardianbox-w5gu.onrender.com)** _(free hosting — if the app has been idle, the first load can take about a minute)_

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

---

## 📖 Overview

GuardianBox is an **End-to-End Encrypted (E2EE)** file sharing service designed for maximum privacy. Unlike traditional cloud storage (Google Drive, Dropbox), GuardianBox implements a **zero-knowledge architecture** — the server never has access to your encryption keys or plaintext data.

### How It Works

```
┌─────────────┐     Encrypted Blob     ┌──────────────┐     Ciphertext     ┌─────────────────┐
│   Browser   │ ─────────────────────▶ │   Express    │ ─────────────────▶ │  S3-compatible  │
│  (Encrypt)  │                        │   Server     │                    │  object storage │
└─────────────┘                        └──────────────┘                    └─────────────────┘
       │                                      │
       │  Key stays in URL hash (#)           │  Stores only encrypted data
       │  Never sent to server                │  Zero knowledge of contents
       ▼                                      ▼
  <host>/file/abc#MyKey               Database: metadata only (no keys)
```

1. **Upload**: the user selects a file → enters (or generates) a key → the file is encrypted with **AES-256-GCM** in the browser → only the encrypted blob is sent to the server.
2. **Share**: a link is generated with the file ID in the path and the decryption key in the **URL hash** (`#`). Browsers never send the hash fragment to the server.
3. **Download**: the recipient opens the link → the browser reads the key from the hash → fetches the encrypted blob → decrypts it client-side → saves the original file.
4. **Expire**: files are deleted automatically after a chosen time (**hourly cron job**) or after N downloads (**burn after reading**).

**Options in the UI:** expiry of 1 hour, 6 hours, 24 hours, 7 days or never; download limit of 1, 5, 10 or unlimited (the API accepts any positive number).

---

## 🏗️ Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Backend | Node.js, Express 4, TypeScript |
| Database | libSQL / SQLite via `@libsql/client` — a local file in development, hosted [Turso](https://turso.tech) in production. Metadata only. |
| Object storage | Any S3-compatible store via `@aws-sdk/client-s3` — RustFS locally, [Tigris](https://www.tigrisdata.com) in production (AWS S3 and MinIO also work) |
| Cryptography | Web Crypto API (AES-256-GCM, PBKDF2-SHA-256) |
| Scheduling | `node-cron` (hourly cleanup) |

### Cryptography Details

- **Algorithm**: AES-256-GCM (authenticated encryption — tampering is detected)
- **Key derivation**: PBKDF2 with 600,000 iterations and SHA-256
- **IV**: 12-byte random Initialization Vector per encryption
- **Salt**: 16-byte random salt per encryption for key derivation
- **Key transport**: URL hash fragment (`#`), which browsers never include in HTTP requests. Keys are percent-encoded in the link, so passphrases with spaces or non-English characters survive the round trip.
- **Module**: all crypto lives in `guardianbox/client/src/utils/cryptoUtils.ts`. A plain-JS twin, `cryptoUtils.js`, is used by the proof script and the Node tests.

### API

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/files/upload` | Store ciphertext + IV + salt + expiry metadata |
| `GET` | `/api/files/:id/info` | File metadata (name, size, expiry, download count) |
| `GET` | `/api/files/:id` | Download the encrypted blob (counts toward the download limit) |
| `GET` | `/api/health` | Health check |

Upload fields: `file` (the ciphertext), `iv`, `salt`, `originalName`, `mimeType`, plus optional `expiresIn` (**seconds**) and `maxDownloads`. Expired or used-up files return `410 Gone`; unknown IDs, and files whose blob has vanished from storage, return `404`.

---

## 🚀 Getting Started

### Prerequisites

- Node.js **20+**
- npm
- Docker (for a local S3-compatible store) **or** an S3 bucket

### Setup

```bash
# Clone the repository
git clone https://github.com/vaibhaavtiwarii/Guardian-Box.git
cd Guardian-Box/guardianbox

# Environment variables
cp .env.example server/.env

# Install dependencies for the client and the server
npm run install:all
```

**Start a local S3-compatible store (RustFS):**

```bash
docker run -d --name rustfs \
  -e RUSTFS_ACCESS_KEY=minioadmin \
  -e RUSTFS_SECRET_KEY=minioadmin \
  -e RUSTFS_CONSOLE_ENABLE=true \
  -v rustfs-data:/data \
  -p 9000:9000 -p 9001:9001 \
  rustfs/rustfs:1.0.0
```

The console is at <http://127.0.0.1:9001/rustfs/console/> (login `minioadmin` / `minioadmin`). The server creates the `guardianbox-uploads` bucket automatically on first start. To use another provider, change the `S3_*` variables in `server/.env`.

**Run the app (two terminals):**

```bash
# Terminal 1 — API on :3001
cd server
npm run dev

# Terminal 2 — UI on :5173
cd client
npm run dev
```

Open <http://localhost:5173>.

### Configuration (`server/.env`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3001` | API port |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | *(empty)* | Hosted libSQL database. Leave empty locally to use a SQLite file (`server/data/guardianbox.db`) |
| `S3_ENDPOINT` | `http://localhost:9000` | S3-compatible endpoint |
| `S3_BUCKET` | `guardianbox-uploads` | Bucket name |
| `S3_REGION` | `us-east-1` | Region |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | `minioadmin` | Storage credentials (change in production) |
| `S3_FORCE_PATH_STYLE` | `true` | `true` for local RustFS/MinIO, `false` for hosted providers like Tigris |
| `S3_STRICT` | `false` | `true` = never fall back to local disk; the server refuses to start if the bucket is unreachable |
| `MAX_UPLOAD_MB` | `50` | Maximum encrypted upload size |
| `TRUST_PROXY` | *(empty)* | Set to `1` behind a reverse proxy (Render) so rate limiting sees real client IPs |
| `CORS_ORIGIN` | *(any)* | Comma-separated allowed origins in production |
| `RATE_LIMIT_PER_MIN` | `120` | Per-IP request limit on `/api` |

> If S3 is unreachable and `S3_STRICT` is not `true`, the server falls back to local disk (`server/storage/`) for convenience during development.

---

## ☁️ Deployment (free tier, no credit card)

The app deploys as **one web service** that serves both the API and the built React UI, plus two free hosted services for data:

| Piece | Service | Role |
|-------|---------|------|
| Web service | [Render](https://render.com) free web service | Runs Express and serves the built UI (HTTPS, which the Web Crypto API requires, is automatic) |
| Metadata DB | [Turso](https://turso.tech) | File records (no keys, no plaintext) — needed because Render's free filesystem is ephemeral |
| Encrypted blobs | [Tigris](https://www.tigrisdata.com) | S3-compatible object storage |
| Uptime monitor | [UptimeRobot](https://uptimerobot.com) | Pings `/api/health` every 5 minutes so the free instance stays awake |

**Steps**
1. Create a private Tigris bucket and an access key limited to it. Create a Turso database and an auth token.
2. In Render choose **New → Blueprint**, select this repository (it reads [`render.yaml`](render.yaml)) and enter the secret values when prompted: `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.
3. Every push to `main` redeploys automatically.
4. In UptimeRobot add an **HTTP(s)** monitor for `https://<your-service>.onrender.com/api/health` with a 5-minute interval.

**Free-tier behaviour:** Render spins a free service down after 15 minutes without traffic, and the first request afterwards takes about a minute. The UptimeRobot ping keeps it awake, but a short 502 right after a redeploy is normal. The hourly cleanup job cannot run while the service sleeps, so cleanup also runs on every start-up, and expiry and download limits are enforced on every request regardless.

---

## 🔒 Security Audit

### What's Protected

| Attack vector | Mitigation |
|--------------|------------|
| Server compromise | Zero-knowledge: the server stores only ciphertext. No keys in the DB. |
| Database leak | Only encrypted-blob references and metadata. No plaintext, no keys. |
| Man-in-the-middle | HTTPS in production. The key is in the URL hash and never appears in HTTP requests. |
| Brute force (key) | AES-256-GCM with PBKDF2 (600K iterations). Infeasible for a strong key. |
| IV reuse | Fresh random 12-byte IV per encryption. |
| Tampering | AES-GCM authentication tag — modified ciphertext fails to decrypt. |
| Reuse of a leaked link | Optional download limit and auto-expiry; expired files are deleted from storage. |
| Burn-after-read race | The download slot is claimed with an atomic SQL `UPDATE ... WHERE download_count < max_downloads`. |
| Abuse / scraping | Per-IP rate limit, restrictable CORS, `no-store` and `Referrer-Policy: no-referrer` headers. |
| Script injection | Content-Security-Policy on the UI (scripts only from the same origin) and a strict `default-src 'none'` policy on `/api`. |
| Input abuse | File IDs validated as UUIDs; `iv` and `salt` validated as base64; upload size capped. |

### Known Limitations & Risks

1. **Link loss = data loss**: if the user loses the sharing link (which contains the decryption key), the file is **irrecoverable**. There is no "forgot password" flow — that would require the server to know the key, defeating zero-knowledge.

2. **Browser and host trust**: the user must trust the JavaScript the host serves. A compromised host or an XSS flaw could exfiltrate the key. Mitigation: a strict CSP is set, and the app has no third-party scripts. Further hardening would be Subresource Integrity or a signed, self-hosted build. Fonts load from Google Fonts; that request never includes the URL fragment.

3. **Metadata exposure**: the server knows file sizes, upload times, and IP addresses. File *contents* are hidden, but traffic patterns are not.

4. **Insecure link sharing**: if the link is sent over an insecure channel (plain HTTP, unencrypted email), the key could be intercepted. Share links through an E2EE messenger (Signal, WhatsApp).

5. **Large files are buffered, not streamed**: the whole file is encrypted in one AES-GCM operation and buffered in server memory, so uploads are capped (default 50 MB, `MAX_UPLOAD_MB`). True streaming would need chunked AES-GCM (per-chunk IVs) and multipart S3 uploads — future work.

6. **Filename and MIME type are not encrypted**: they are stored server-side in plaintext so the recipient can see them before decrypting. Anyone with DB access learns file names, sizes and timestamps.

7. **Weak user-chosen keys**: the key is placed in the share link and also used for PBKDF2. A short passphrase is brute-forceable by anyone who obtains the ciphertext; prefer **Generate key**.

8. **No forward secrecy**: the same key decrypts the file until it expires. If the key is compromised at any point, access to that file is compromised.

9. **Download limit counts requests, not recipients**: anyone with the link can consume a download, and a failed decryption still uses one. Combine a download limit with a short expiry for sensitive files.

---

## 🔬 Proof of Zero-Knowledge Storage (Walkthrough)

Deliverable requirement: *a walkthrough showing that the file stored in the S3 bucket is indeed encrypted and unreadable without the client-side key.*

The proof has two parts.

### Part 1 — Inspect the object in the bucket (live deployment)

These steps were run against the live site at <https://guardianbox-w5gu.onrender.com>, with the object stored in the Tigris bucket.

1. Upload a small text file containing a recognizable sentence through the UI.
2. Open the Tigris dashboard and browse the bucket. The object has a random UUID name under `uploads/` and no extension.
3. Download the object and open it in a text editor: it is random bytes, and your sentence appears nowhere.
4. Open the share link and decrypt: the original text comes back. With a wrong key, decryption fails.

| Step | Screenshot |
|------|-----------|
| Share link generated after encrypt + upload | ![upload](proof/01-upload-share-link.png) |
| Object in the bucket (random UUID, no extension) | ![bucket](proof/02-bucket-object.png) |
| Stored object opened in a text editor — unreadable | ![ciphertext](proof/03-ciphertext-unreadable.png) |
| Recipient decrypts with the key from the link | ![decrypted](proof/04-decrypted-ok.png) |
| Wrong key rejected | ![wrong key](proof/05-wrong-key-rejected.png) |

Command-line check on the downloaded object (no output means the word is not present; use a word from your own file):

```powershell
Select-String -Path .\downloaded-object -Pattern "your-word-here" -Encoding ASCII
```

### Part 2 — Automated end-to-end script

```bash
# from guardianbox/ — the API server must be running
npm run proof
```

The script encrypts a message, uploads the ciphertext, checks that the database record holds no key or plaintext, decrypts with the correct key, confirms a wrong key is rejected, and tests burn-after-reading. The run below was made locally with `S3_STRICT=true` against the RustFS bucket, so the server was talking to real S3-compatible storage and **not** the local-disk fallback.

Actual output:

```
======================================================================
 GUARDIANBOX - ZERO-KNOWLEDGE E2EE VERIFICATION & S3 PROOF
======================================================================

[1] CLIENT-SIDE ENCRYPTION (Web Crypto API):
    Original Plaintext: "TOP SECRET WHISTLEBLOWER DISCLOSURE 2026: UNREDACTED EVIDENCE ARCHIVE"
    Generated Client Key: "GuardianKey_yWpWsIiBrrsEYFmaVU8l-7WJ"
    Encrypting in browser via AES-256-GCM with PBKDF2 (600,000 iterations)...
    Ciphertext Byte Length: 85 bytes
    Initialization Vector (IV): wCU0bNaKOpVGtq2G
    Key Derivation Salt: PQv4BmeBXSN1wHZhBBtGIA==

[2] CLIENT UPLOADS CIPHERTEXT TO BACKEND:
    Upload Successful!
    Stored File ID: b77e1b07-86a8-451b-bab7-bbe135156a59
    Max Downloads: 2
    Full Share URL: http://localhost:5173/file/b77e1b07-86a8-451b-bab7-bbe135156a59#GuardianKey_yWpWsIiBrrsEYFmaVU8l-7WJ
    * Notice: The hash portion "#GuardianKey_yWpWsIiBrrsEYFmaVU8l-7WJ" is NEVER sent to the server in HTTP requests.

[3] PROOF: INSPECTING STORAGE & DATABASE ON THE SERVER:
    Database Record for this file:
    {
      id: "b77e1b07-86a8-451b-bab7-bbe135156a59",
      original_name: "whistleblower_report.pdf",
      size: 85,
      download_count: 0,
      s3_key: "uploads/b77e1b07-86a8-451b-bab7-bbe135156a59",
      salt: "PQv4BmeB...",
      iv: "wCU0bNaK..."
    }
    -> ZERO-KNOWLEDGE CONFIRMED: No encryption keys, passwords, or plaintext stored anywhere in database!

[4] RECIPIENT OPENS SHARE LINK & DECRYPTS:
    Recipient browser reads key from URL hash: "GuardianKey_yWpWsIiBrrsEYFmaVU8l-7WJ"
    Fetching encrypted blob from GET /api/files/b77e1b07-86a8-451b-bab7-bbe135156a59...
    Downloaded encrypted blob (85 bytes)
    Decrypting in browser with Web Crypto AES-256-GCM...
    Decrypted Text: "TOP SECRET WHISTLEBLOWER DISCLOSURE 2026: UNREDACTED EVIDENCE ARCHIVE"
    Byte-for-byte exact match? => SUCCESS (100% MATCH)

[5] VERIFYING SECURITY: ATTEMPT DECRYPTION WITH WRONG KEY:
    SUCCESS: Decryption with wrong key rejected by AES-GCM authentication tag check.
    Error caught: The operation failed for an operation-specific reason

[6] EPHEMERAL STORAGE TEST (Burn after 2 downloads):
    Performing 2nd download (reaching max limit of 2)...
    2nd Download Status: 200 (Delivered final copy & burned)
    Performing 3rd download attempt (should be deleted / 410 or 404)...
    3rd Download Status: 410 (SUCCESS: File deleted from database and storage)

======================================================================
 ALL VERIFICATION CHECKS & PROOFS PASSED PERFECTLY!
======================================================================
```

> The script inspects the database record directly. When the blob is in S3 rather than on local disk it does not print a hex dump of the object — that inspection is the manual bucket check in Part 1.

---

## 🧪 Testing

```bash
# Server + crypto tests (from guardianbox/) — build the server first
npm run build:server
npm test

# Vitest suite for the client crypto module
cd client
npm test
```

**Crypto tests** (`tests/crypto.test.mjs`, client `cryptoUtils`):
- `encrypt(data, key)` followed by `decrypt(ciphertext, key)` returns the original data (text and 64 KB of binary)
- a wrong password fails to decrypt (authentication tag failure)
- tampered ciphertext is rejected (AES-GCM integrity)
- a fresh salt and IV are generated on every call
- generated keys are unique and base64 encoding round-trips

**Server tests** (`tests/server.test.mjs`) start the built server on a random port with a temporary database and local blob storage, then call the real API:
- upload stores a blob; download returns the same bytes with the `iv` and `salt` headers
- `expiresIn` is read as seconds, and an expired file returns `410` on both the info and download endpoints
- **burn after reading**: the last allowed download deletes the file, and the blob is removed from storage
- eight parallel downloads of a one-download file let exactly one succeed (atomic claim)
- unknown or malformed IDs return `404`; missing or invalid `iv` / `salt` return `400`
- a blob deleted from storage turns the link into a `404` and removes the record
- the file-info response never contains a key or plaintext

---

## 📁 Project Structure

```
Guardian-Box/
├── README.md
├── LICENSE
├── render.yaml                     # Render Blueprint (free web service)
├── proof/                          # Proof screenshots
└── guardianbox/
    ├── .env.example
    ├── client/                     # React frontend
    │   └── src/
    │       ├── components/         # Shell, drop zone, key input, limits, share link, hero art
    │       ├── pages/              # Upload and Download pages
    │       ├── utils/
    │       │   ├── cryptoUtils.ts  # 🔐 Web Crypto API module
    │       │   ├── cryptoUtils.js  # JS version of the same module
    │       │   ├── cryptoUtils.test.ts
    │       │   ├── api.ts          # API client
    │       │   └── format.ts       # Sizes, dates and limit wording
    │       └── types/              # TypeScript interfaces
    ├── server/                     # Express backend
    │   └── src/
    │       ├── config/             # DB and S3 configuration
    │       ├── controllers/        # Request handlers
    │       ├── middleware/         # Multer upload middleware
    │       ├── models/             # Database models
    │       ├── routes/             # API routes
    │       ├── services/           # Object storage service
    │       └── utils/              # Hourly cleanup cron job
    ├── scripts/e2e-proof.mjs       # End-to-end proof script
    └── tests/                      # crypto.test.mjs, server.test.mjs
```

---

## 👤 Author

**Vaibhav Tiwari** — [@vaibhaavtiwarii](https://github.com/vaibhaavtiwarii)

Built as a Cybersecurity project on end-to-end encrypted file sharing.

---

## 📜 License

MIT © 2026 Vaibhav Tiwari — see [LICENSE](LICENSE).

---

*Built with privacy in mind. Your files, your keys, your rules.*
