# 🛡️ GuardianBox — Zero-Knowledge Encrypted File Sharing

> **The server is blind.** Your files are encrypted in the browser before they ever leave your device. The server stores only unreadable ciphertext. Not even we can see what you share.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

---

## 📖 Overview

GuardianBox is an **End-to-End Encrypted (E2EE)** file sharing service designed for maximum privacy. Unlike traditional cloud storage (Google Drive, Dropbox), GuardianBox implements a **zero-knowledge architecture** — the server never has access to your encryption keys or plaintext data.

### How It Works

```
┌─────────────┐     Encrypted Blob     ┌──────────────┐     Ciphertext     ┌──────────┐
│   Browser    │ ──────────────────────▶│   Express    │ ────────────────▶  │  S3/MinIO │
│  (Encrypt)   │                        │   Server     │                    │  Storage  │
└─────────────┘                         └──────────────┘                    └──────────┘
       │                                       │
       │  Key stays in URL hash (#)            │  Stores only encrypted data
       │  Never sent to server                 │  Zero knowledge of contents
       ▼                                       ▼
   guadianbox.com/download/abc#MyKey     Database: metadata only (no keys)
```

1. **Upload**: User selects a file → enters (or auto-generates) a password → file is encrypted with **AES-256-GCM** in the browser → encrypted blob is sent to the server
2. **Share**: A link is generated containing the file ID in the path and the decryption key in the **URL hash** (`#`). The hash fragment is **never sent to the server** by the browser.
3. **Download**: Recipient opens the link → browser extracts the key from the hash → fetches the encrypted blob from the server → decrypts it client-side → downloads the original file

---

## 🏗️ Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Backend | Node.js, Express 4, TypeScript |
| Database | SQLite (better-sqlite3) |
| Object Storage | AWS S3 / MinIO |
| Cryptography | Web Crypto API (AES-256-GCM, PBKDF2) |

### Cryptography Details

- **Algorithm**: AES-256-GCM (Authenticated Encryption with Associated Data)
- **Key Derivation**: PBKDF2 with 600,000 iterations and SHA-256
- **IV**: 12-byte random Initialization Vector per encryption
- **Salt**: 16-byte random salt per encryption for key derivation
- **Key Transport**: Via URL hash fragment (`#`), which browsers never include in HTTP requests

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Docker (for MinIO) or an AWS S3 bucket

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/guardianbox.git
cd guardianbox

# Set up environment variables
cp .env.example server/.env

# Install dependencies
cd client && pnpm install
cd ../server && pnpm install

# Start MinIO (local S3-compatible storage)
docker run -d -p 9000:9000 -p 9001:9001 \
  --name minio \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"

# Create the bucket
# Visit http://localhost:9001 and create a bucket named "guardianbox-uploads"

# Start the development servers
cd server && pnpm dev    # Terminal 1 — API on :3001
cd client && pnpm dev    # Terminal 2 — UI on :5173
```

---

## 🔒 Security Audit

### What's Protected

| Attack Vector | Mitigation |
|--------------|------------|
| Server compromise | Zero-knowledge: server stores only ciphertext. No keys in DB. |
| Database leak | Only encrypted blob references and metadata. No plaintext, no keys. |
| Man-in-the-middle | HTTPS in production. Key is in URL hash, never in HTTP requests. |
| Brute force (key) | AES-256-GCM with PBKDF2 (600K iterations). Computationally infeasible. |
| IV reuse | Fresh random 12-byte IV per encryption. |
| Replay attacks | Unique file IDs, optional download limits, auto-expiration. |

### Known Limitations & Risks

1. **Link Loss = Data Loss**: If the user loses the sharing link (which contains the decryption key), the file is **irrecoverable**. There is no "forgot password" flow — that would require the server to know the key, defeating zero-knowledge.

2. **Browser Trust**: The user must trust their browser and the JavaScript served. A compromised CDN or XSS attack could exfiltrate the key. Mitigation: Subresource Integrity (SRI), Content Security Policy (CSP).

3. **Metadata Exposure**: The server knows file sizes, upload times, and IP addresses. The file *contents* are hidden, but traffic patterns are not.

4. **URL Sharing Security**: If the link is shared over an insecure channel (e.g., plain HTTP, unencrypted email), the key could be intercepted. Users should share links via E2EE messaging (Signal, WhatsApp).

5. **No Forward Secrecy**: The same key decrypts the file forever (until the file expires). If the key is compromised at any point, all historical access is compromised.

---

## 🔬 Proof of Zero-Knowledge Storage (Walkthrough)

Deliverable requirement: *A walkthrough showing that the file stored in the S3 bucket is indeed encrypted and unreadable without the client-side key.*

Run the automated walkthrough and proof script:
```bash
npm run proof
```

### Walkthrough Evidence & Output

```
======================================================================
 GUARDIANBOX - ZERO-KNOWLEDGE E2EE VERIFICATION & S3 PROOF
======================================================================

[1] CLIENT-SIDE ENCRYPTION (Web Crypto API):
    Original Plaintext: "TOP SECRET WHISTLEBLOWER DISCLOSURE 2026: UNREDACTED EVIDENCE ARCHIVE"
    Generated Client Key: "GuardianKey_zsLhbDbAc16qSUYub508npBT"
    Encrypting in browser via AES-256-GCM with PBKDF2 (600,000 iterations)...
    Ciphertext Byte Length: 85 bytes
    Initialization Vector (IV): flpIEY/EA/uXE1jz
    Key Derivation Salt: OttYevWh5P4s1WXoRdJwgw==

[2] CLIENT UPLOADS CIPHERTEXT TO BACKEND:
    Upload Successful!
    Stored File ID: fdf9a0cf-b3f0-4547-859e-96917edc5f1f
    Max Downloads: 2
    Full Share URL: http://localhost:5173/file/fdf9a0cf-b3f0-4547-859e-96917edc5f1f#GuardianKey_zsLhbDbAc16qSUYub508npBT
    * Notice: The hash portion "#GuardianKey_..." is NEVER sent to the server in HTTP requests.

[3] PROOF: INSPECTING STORAGE & DATABASE ON THE SERVER:
    Raw file found on disk/S3 at: server/storage/guardianbox-uploads/uploads/fdf9a0cf-b3f0-4547-859e-96917edc5f1f
    Stored Blob Size: 85 bytes
    Hex Dump of Stored Blob (first 48 bytes):
    b25fc53a7adcb628919b1fc4862b45faf7203f3ffab2f327410c28ffeed5be122adc7b60b8b56e61c9046d8f43204db2
    Does stored blob contain "TOP SECRET"? => NO (VERIFIED ZERO-KNOWLEDGE)
    Does stored blob contain secret key?   => NO (VERIFIED ZERO-KNOWLEDGE)
    Database Record for this file:
    {
      id: "fdf9a0cf-b3f0-4547-859e-96917edc5f1f",
      original_name: "whistleblower_report.pdf",
      size: 85,
      download_count: 0,
      s3_key: "uploads/fdf9a0cf-b3f0-4547-859e-96917edc5f1f",
      salt: "OttYevWh...",
      iv: "flpIEY/E..."
    }
    -> ZERO-KNOWLEDGE CONFIRMED: No encryption keys, passwords, or plaintext stored anywhere in database!

[4] RECIPIENT OPENS SHARE LINK & DECRYPTS:
    Recipient browser reads key from URL hash: "GuardianKey_zsLhbDbAc16qSUYub508npBT"
    Fetching encrypted blob from GET /api/files/fdf9a0cf-b3f0-4547-859e-96917edc5f1f...
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
    Performing 3rd download attempt...
    3rd Download Status: 404 (SUCCESS: File deleted from database and storage)
```

---

## 🧪 Testing

```bash
# Run crypto unit tests
cd client && pnpm test
```

The test suite verifies:
- Encrypt → Decrypt roundtrip produces original data
- Wrong password produces a decryption error
- Random key generation produces unique keys
- IV and salt are unique per encryption

---

## 📁 Project Structure

```
guardianbox/
├── client/                    # React frontend
│   └── src/
│       ├── components/        # UI components
│       ├── pages/             # Route pages
│       ├── utils/
│       │   ├── cryptoUtils.ts # 🔐 Web Crypto API module
│       │   └── api.ts         # API client
│       └── types/             # TypeScript interfaces
├── server/                    # Express backend
│   └── src/
│       ├── config/            # DB and S3 configuration
│       ├── controllers/       # Request handlers
│       ├── middleware/        # Multer upload middleware
│       ├── models/            # Database models
│       ├── routes/            # API routes
│       └── utils/             # Cleanup cron job
└── README.md
```

---

## 📜 License

MIT

---

*Built with privacy in mind. Your files, your keys, your rules.*

