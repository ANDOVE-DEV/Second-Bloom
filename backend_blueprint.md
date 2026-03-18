# Second Bloom — Backend Blueprint

> **Versione**: 1.0.0 | **Data**: 2026-03-18  
> **Stack**: NestJS · PostgreSQL 16 · Redis 7 · Socket.io · AWS S3/Rekognition · Jumio/Onfido · Stripe · FCM

---

## 1. Architettura Generale

```
┌────────────────────────────────────────────────────────────┐
│                        CLIENT (Flutter)                     │
│                REST/HTTPS          WebSocket (Socket.io)    │
└────────────────────┬───────────────────────┬───────────────┘
                     │                       │
           ┌─────────▼───────────────────────▼──────────┐
           │              API Gateway / Nginx             │
           │         (TLS termination, rate limiting)     │
           └─────────────────────┬──────────────────────┘
                                 │
           ┌─────────────────────▼──────────────────────┐
           │             NestJS Application               │
           │  ┌──────────────────────────────────────┐   │
           │  │  HTTP Modules (REST Controllers)      │   │
           │  │  auth · users · matching · chat       │   │
           │  │  verification · subscriptions · etc.  │   │
           │  └──────────────────────────────────────┘   │
           │  ┌──────────────────────────────────────┐   │
           │  │  WebSocket Gateway (Socket.io /chat)  │   │
           │  └──────────────────────────────────────┘   │
           │  ┌──────────────────────────────────────┐   │
           │  │  Bull Queue Workers                   │   │
           │  │  matching-job · moderation-job        │   │
           │  └──────────────────────────────────────┘   │
           └──────┬────────────────┬────────────────┬────┘
                  │                │                │
         ┌────────▼──┐    ┌────────▼──┐   ┌────────▼──┐
         │ PostgreSQL│    │  Redis 7  │   │  AWS S3   │
         │    16     │    │  Cache/   │   │  (media)  │
         │ (primary) │    │  Sessions │   └───────────┘
         └───────────┘    └───────────┘
```

**Servizi esterni**:
- **Jumio / Onfido** — KYC biometrico
- **AWS Rekognition** — moderazione immagini
- **Twilio / Agora** — Safe-Call voce/video
- **Stripe** — pagamenti abbonamento + boost
- **Firebase FCM** — notifiche push
- **SendGrid / AWS SES** — email transazionali

---

## 2. Struttura Cartelle NestJS

```
second-bloom-backend/
├── src/
│   ├── app.module.ts
│   ├── main.ts                        # bootstrap, helmet, cors, validation pipe
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   └── refresh.strategy.ts
│   │   │   └── dto/
│   │   │       ├── register.dto.ts
│   │   │       ├── login.dto.ts
│   │   │       └── reset-password.dto.ts
│   │   │
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   ├── entities/
│   │   │   │   ├── user.entity.ts
│   │   │   │   └── profile.entity.ts
│   │   │   └── dto/
│   │   │       └── update-profile.dto.ts
│   │   │
│   │   ├── matching/
│   │   │   ├── matching.module.ts
│   │   │   ├── matching.controller.ts
│   │   │   ├── matching.service.ts
│   │   │   ├── affinity.service.ts    # calcolo Affinity Score
│   │   │   ├── matching.processor.ts  # Bull worker notturno
│   │   │   ├── entities/
│   │   │   │   ├── swipe.entity.ts
│   │   │   │   └── match.entity.ts
│   │   │   └── dto/
│   │   │       └── swipe.dto.ts
│   │   │
│   │   ├── chat/
│   │   │   ├── chat.module.ts
│   │   │   ├── chat.gateway.ts        # @WebSocketGateway('/chat')
│   │   │   ├── chat.service.ts
│   │   │   ├── icebreaker.service.ts
│   │   │   ├── entities/
│   │   │   │   ├── conversation.entity.ts
│   │   │   │   ├── message.entity.ts
│   │   │   │   └── icebreaker-template.entity.ts
│   │   │   └── dto/
│   │   │       └── send-message.dto.ts
│   │   │
│   │   ├── verification/
│   │   │   ├── verification.module.ts
│   │   │   ├── verification.controller.ts
│   │   │   ├── verification.service.ts
│   │   │   └── entities/
│   │   │       └── verification.entity.ts
│   │   │
│   │   ├── moderation/
│   │   │   ├── moderation.module.ts
│   │   │   ├── moderation.service.ts
│   │   │   └── moderation.processor.ts  # Bull worker S3→Rekognition
│   │   │
│   │   ├── safe-call/
│   │   │   ├── safe-call.module.ts
│   │   │   ├── safe-call.controller.ts
│   │   │   ├── safe-call.service.ts
│   │   │   └── entities/
│   │   │       └── call-log.entity.ts
│   │   │
│   │   ├── family-button/
│   │   │   ├── family-button.module.ts
│   │   │   ├── family-button.controller.ts
│   │   │   └── family-button.service.ts
│   │   │
│   │   ├── subscriptions/
│   │   │   ├── subscriptions.module.ts
│   │   │   ├── subscriptions.controller.ts
│   │   │   └── subscriptions.service.ts
│   │   │
│   │   ├── boosts/
│   │   │   ├── boosts.module.ts
│   │   │   ├── boosts.controller.ts
│   │   │   └── boosts.service.ts
│   │   │
│   │   ├── notifications/
│   │   │   ├── notifications.module.ts
│   │   │   └── notifications.service.ts   # FCM wrapper
│   │   │
│   │   └── onboarding/
│   │       ├── onboarding.module.ts
│   │       ├── onboarding.controller.ts
│   │       ├── onboarding.service.ts
│   │       └── entities/
│   │           └── onboarding-step.entity.ts
│   │
│   ├── common/
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   ├── interceptors/
│   │   │   ├── free-tier-limit.interceptor.ts  # blocca dopo 5 swipe/giorno
│   │   │   └── logging.interceptor.ts
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   └── roles.decorator.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   └── pipes/
│   │       └── parse-uuid.pipe.ts
│   │
│   ├── config/
│   │   ├── app.config.ts
│   │   ├── database.config.ts
│   │   ├── redis.config.ts
│   │   ├── jwt.config.ts
│   │   └── env.validation.ts          # class-validator schema per env vars
│   │
│   └── database/
│       └── migrations/                # TypeORM migrations
│
├── test/
│   ├── unit/
│   └── e2e/
│
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── nest-cli.json
├── tsconfig.json
└── package.json
```

---

## 3. Schema Database Completo (PostgreSQL)

### 3.1 Tabella `users`

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(10) NOT NULL DEFAULT 'user'   CHECK (role IN ('user','admin')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  is_verified   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.2 Tabella `profiles`

```sql
CREATE TABLE profiles (
  user_id              UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name         VARCHAR(50)  NOT NULL,
  birth_date           DATE         NOT NULL,
  gender               VARCHAR(10)  NOT NULL CHECK (gender IN ('man','woman','other')),
  seeking              VARCHAR(10)  NOT NULL CHECK (seeking IN ('man','woman','any')),
  bio                  TEXT,
  city                 VARCHAR(100),
  latitude             DECIMAL(9,6),
  longitude            DECIMAL(9,6),
  intent               VARCHAR(20)  CHECK (intent IN ('convivenza','relazione_stabile','amicizia','vediamo')),
  smokes               BOOLEAN,
  has_cohabiting_kids  BOOLEAN,
  political_lean       VARCHAR(20)  CHECK (political_lean IN ('left','center','right','apolitical','prefer_not')),
  religion             VARCHAR(20)  CHECK (religion IN ('christian','jewish','muslim','buddhist','atheist','other','prefer_not')),
  interests            TEXT[]       NOT NULL DEFAULT '{}',
  avatar_url           VARCHAR(500),
  subscription_tier    VARCHAR(10)  NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free','gold')),
  is_invisible         BOOLEAN      NOT NULL DEFAULT false,
  onboarding_completed BOOLEAN      NOT NULL DEFAULT false,
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

### 3.3 Tabella `device_tokens`

```sql
CREATE TABLE device_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      VARCHAR(500) NOT NULL,
  platform   VARCHAR(10) NOT NULL CHECK (platform IN ('ios','android')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);
```

### 3.4 Tabella `swipes`

```sql
CREATE TABLE swipes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action     VARCHAR(5) NOT NULL CHECK (action IN ('yes','pass')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (actor_id, target_id)
);
CREATE INDEX idx_swipes_actor ON swipes(actor_id);
CREATE INDEX idx_swipes_target ON swipes(target_id);
```

### 3.5 Tabella `matches`

```sql
CREATE TABLE matches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  matched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active    BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (user_a_id, user_b_id)
);
CREATE INDEX idx_matches_user_a ON matches(user_a_id);
CREATE INDEX idx_matches_user_b ON matches(user_b_id);
```

### 3.6 Tabella `conversations`

```sql
CREATE TABLE conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   UUID NOT NULL UNIQUE REFERENCES matches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.7 Tabella `messages`

```sql
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  type            VARCHAR(15) NOT NULL DEFAULT 'text' CHECK (type IN ('text','icebreaker','system')),
  is_read         BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at DESC);
```

### 3.8 Tabella `icebreaker_templates`

```sql
CREATE TABLE icebreaker_templates (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL,   -- es. 'musica_classica', 'viaggi', 'cucina'
  template TEXT NOT NULL            -- es. "Entrambi amate {hobby}. Chiedi a {nome} qual è {domanda}."
);
```

### 3.9 Tabella `verifications`

```sql
CREATE TABLE verifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider     VARCHAR(10) NOT NULL CHECK (provider IN ('jumio','onfido')),
  session_id   VARCHAR(255) NOT NULL UNIQUE,
  status       VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.10 Tabella `call_logs`

```sql
CREATE TABLE call_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id     UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  initiated_by UUID NOT NULL REFERENCES users(id),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at     TIMESTAMPTZ,
  duration_s   INTEGER
);
```

### 3.11 Tabella `boosts`

```sql
CREATE TABLE boosts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  payment_ref VARCHAR(255) NOT NULL
);
CREATE INDEX idx_boosts_active ON boosts(user_id, expires_at);
```

### 3.12 Tabella `onboarding_steps`

```sql
CREATE TABLE onboarding_steps (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  step_key     VARCHAR(50) NOT NULL,   -- es. 'photo', 'bio', 'interests', 'intent'
  completed_at TIMESTAMPTZ,
  UNIQUE (user_id, step_key)
);
```

---

## 4. Schema Redis

| Chiave | Tipo | TTL | Contenuto |
|---|---|---|---|
| `session:refresh:{userId}` | String | 30 giorni | Hash del refresh token |
| `blacklist:token:{jti}` | String | 15 min | `1` (token JWT invalidato) |
| `rate:login:{ip}` | Counter | 15 min | Numero tentativi login |
| `match:queue:{userId}` | Sorted Set | 24 ore | `score=S`, `member=targetUserId` |
| `match:seen:{userId}` | Set | 30 giorni | UUID profili già mostrati |
| `undo:{userId}` | String | 10 min | `swipeId` dell'ultimo swipe |
| `swipes_today:{userId}` | Counter | TTL a mezzanotte | Numero di "Sì" giornalieri |
| `boost:{userId}` | String | 24 ore | `1` (boost attivo) |
| `typing:{conversationId}:{userId}` | String | 5 sec | `1` (sta scrivendo) |

---

## 5. API REST — Endpoint Completi

### Auth (`/auth`)

| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| POST | `/auth/register` | No | Registrazione nuovo utente |
| POST | `/auth/login` | No | Login → JWT + refresh token |
| POST | `/auth/refresh` | Refresh token | Rinnova access token |
| POST | `/auth/logout` | JWT | Invalida refresh token |
| POST | `/auth/forgot-password` | No | Invia email con OTP reset |
| POST | `/auth/reset-password` | No | Applica nuova password con OTP |

### Users (`/users`)

| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| GET | `/users/me` | JWT | Profilo completo utente autenticato |
| PATCH | `/users/me` | JWT | Aggiorna dati profilo / preferenze |
| POST | `/users/me/avatar` | JWT | Upload foto profilo (multipart/form-data) |
| DELETE | `/users/me` | JWT | Soft-delete account (GDPR) |
| GET | `/users/me/export` | JWT | Export dati personali (GDPR Art. 20) |
| POST | `/users/me/device-token` | JWT | Registra token FCM |
| PATCH | `/users/me/visibility` | JWT + Gold | Attiva/disattiva modalità invisibile |

### Matching (`/matching`)

| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| GET | `/matching/discover` | JWT | Prossimo profilo dalla coda Redis |
| POST | `/matching/swipe` | JWT | Registra "Sì"/"Passa oltre" |
| POST | `/matching/undo` | JWT | Annulla ultimo swipe |
| GET | `/matching/matches` | JWT | Lista match attivi |
| GET | `/matching/who-liked-me` | JWT + Gold | Chi ha messo "Sì" sul tuo profilo |

### Chat (`/chat`)

| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| GET | `/chat/conversations` | JWT | Lista conversazioni dell'utente |
| GET | `/chat/conversations/:id/messages` | JWT | Storico messaggi (paginato) |

### Verification (`/verification`)

| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| POST | `/verification/start` | JWT | Crea sessione KYC Jumio/Onfido |
| POST | `/verification/webhook` | HMAC | Callback dal provider (aggiorna status) |

### Safe-Call (`/safe-call`)

| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| POST | `/safe-call/token` | JWT | Genera token stanza voce/video (Twilio/Agora) |
| DELETE | `/safe-call/end` | JWT | Chiude sessione e salva log |

### Family Button (`/family-button`)

| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| POST | `/family-button/share` | JWT | Invia email scheda match a contatto fidato |

### Subscriptions (`/subscriptions`)

| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| POST | `/subscriptions/checkout` | JWT | Crea sessione Stripe / valida IAP receipt |
| POST | `/subscriptions/webhook` | Stripe-Signature | Aggiorna stato abbonamento |
| GET | `/subscriptions/status` | JWT | Tier attivo e data scadenza |
| DELETE | `/subscriptions/cancel` | JWT | Cancella abbonamento |

### Boosts (`/boosts`)

| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| POST | `/boosts/activate` | JWT | Acquista e attiva boost 24h |
| GET | `/boosts/status` | JWT | Boost attivo? + ore rimanenti |

### Onboarding (`/onboarding`)

| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| GET | `/onboarding/status` | JWT | Passo corrente + % completamento |
| POST | `/onboarding/complete-step` | JWT | Marca step completato |

---

## 6. WebSocket Gateway — `/chat`

### Autenticazione
Il JWT deve essere passato nell'handshake Socket.io:
```js
const socket = io('/chat', { auth: { token: '<access_token>' } });
```
Il `WsJwtGuard` valida il token a ogni connessione e popola `socket.data.user`.

### Events Client → Server

| Evento | Payload | Validazione |
|---|---|---|
| `join_conversation` | `{ conversationId: string }` | L'utente deve essere parte del match associato |
| `send_message` | `{ conversationId: string, content: string, type: 'text'\|'icebreaker' }` | `content` max 1000 caratteri, `conversationId` valido |
| `typing` | `{ conversationId: string }` | Rate limit: max 1 evento ogni 2 secondi |
| `read_message` | `{ messageId: string }` | Il messaggio deve appartenere alla conversazione dell'utente |

### Events Server → Client

| Evento | Payload | Quando |
|---|---|---|
| `new_message` | `{ id, conversationId, senderId, content, type, createdAt }` | Nuovo messaggio in una conversazione joined |
| `user_typing` | `{ conversationId, userId }` | L'altro utente sta scrivendo |
| `message_read` | `{ messageId, readAt }` | Il destinatario ha letto il messaggio |
| `match_created` | `{ matchId, matchedUser: { id, displayName, avatarUrl } }` | Nuovo match reciproco |
| `error` | `{ code, message }` | Errore di validazione o autorizzazione |

---

## 7. Algoritmo Affinity Score

### Formula

$$S = (0.4 \cdot O) + (0.3 \cdot V) + (0.2 \cdot I) - \log_{10}(D+1)$$

### Calcolo Componenti

#### O — Intenzionalità (peso 0.40)
```
intent_a == intent_b         → O = 1.0
Casi compatibili             → O = 0.5
  - 'relazione_stabile' ↔ 'convivenza'
  - 'amicizia' ↔ 'vediamo'
Tutti gli altri casi         → O = 0.0
```

#### V — Valori & Stile di Vita (peso 0.30)
Media pesata di 4 sottocampi, ciascuno ∈ [0,1]:

| Sottocampo | Peso | Logica |
|---|---|---|
| `smokes` | 0.30 | `1.0` se uguale, `0.0` se diverso |
| `has_cohabiting_kids` | 0.25 | `1.0` se uguale, `0.5` se diverso |
| `political_lean` | 0.20 | `1.0` se uguale, `0.5` se adiacente, `0.0` se opposto; `prefer_not` → neutro `0.5` |
| `religion` | 0.25 | `1.0` se uguale, `0.5` se `prefer_not` su uno, `0.0` se opposto dichiarato |

#### I — Interessi Comuni (peso 0.20)
Indice di Jaccard sugli array `interests`:
```
I = |interests_a ∩ interests_b| / |interests_a ∪ interests_b|
```

#### D — Prossimità (penalità logaritmica)
Distanza con formula Haversine (lat/lon → km):
```
penalità = log10(D + 1)
```
- A 0 km: penalità ≈ 0
- A 30 km: penalità ≈ 1.49
- A 100 km: penalità ≈ 2.00

### Boost Multiplier
Se `boost:{userId}` è attivo in Redis, lo score S dell'utente boostato viene moltiplicato per `k = 1.5` nelle code degli altri utenti.

### Penalità Profilo Incompleto
Se il profilo ha completamento < 80%, S viene moltiplicato per `0.7` prima di essere inserito nelle code dei candidati.

---

## 8. Pipeline Matching (Bull Worker)

```
Trigger: Cron ogni notte alle 03:00 UTC
         + on-demand per nuovi utenti all'onboarding

Per ogni utente attivo (is_active = true, onboarding_completed = true):

  1. FETCH candidati da PostgreSQL:
     - Stesso `seeking`/`gender` compatibile
     - età nel range preferito (±10 anni default)
     - distanza ≤ 200 km
     - NOT IN SELECT target_id FROM swipes WHERE actor_id = $userId
     - is_active = true
     - LIMIT 200

  2. CALCOLA S per ogni candidato (AffinityService)

  3. APPLICA boost multiplier (legge Redis `boost:{candidateId}`)

  4. ORDINA per S decrescente

  5. SALVA in Redis:
     ZADD match:queue:{userId} <score> <candidateId>  con TTL 86400s

  6. MANTIENI seen set:
     Non ri-aggiungere UUID presenti in match:seen:{userId}
```

---

## 9. Sicurezza

### Misure OWASP Top 10

| Rischio | Misura |
|---|---|
| Broken Access Control | JWT guard su ogni endpoint protetto; autorizzazione a livello di risorsa (l'utente accede solo ai propri dati) |
| Injection | TypeORM con query parametrizzate; `class-validator` su tutti i DTO; nessuna query raw dinamica |
| XSS | Helmet.js (CSP headers); sanitizzazione contenuto messaggi chat |
| Auth Failures | bcrypt cost 12; JWT RS256; refresh token ruotanti; rate limiting login; OTP a scadenza per password reset |
| Security Misconfiguration | Variabili d'ambiente validate allo startup; Docker secrets per credenziali; `NODE_ENV=production` disabilita stack trace |
| Cryptographic Failures | TLS 1.2+ obbligatorio; chiavi JWT asimmetriche; password mai esposte in log o response |
| SSRF | URL dei webhook validati contro allowlist dei provider (Jumio, Stripe, Onfido) |
| Webhook Security | Validazione firma HMAC `X-Signature` su tutti i webhook (Stripe, Jumio/Onfido) prima di qualsiasi elaborazione |

### Autorizzazione a Livello di Risorsa
- Chat: un utente può accedere solo a conversazioni in cui è parte del match associato.
- Safe-Call: il token di stanza viene emesso solo se entrambi gli utenti hanno un match attivo.
- Family Button: l'email inviata non include dati di contatto del match (solo dati pubblici del profilo verificato).

---

## 10. Gestione Errori e Codici HTTP

| Codice | Scenario |
|---|---|
| `400 Bad Request` | DTO non valido (class-validator) |
| `401 Unauthorized` | JWT assente/scaduto/invalido |
| `403 Forbidden` | Accesso a risorsa altrui; funzione riservata a Gold |
| `404 Not Found` | Risorsa inesistente |
| `409 Conflict` | Email già registrata; swipe duplicato |
| `422 Unprocessable Entity` | Logica di business violata (es. undo senza swipe precedente) |
| `429 Too Many Requests` | Rate limiting login; limite 5 swipe/giorno Free tier |
| `503 Service Unavailable` | Provider esterno non raggiungibile (Jumio, Stripe) |

---

## 11. Infrastruttura & DevOps

### Docker Compose (sviluppo)

```yaml
services:
  app:
    build: .
    ports: ["3000:3000"]
    env_file: .env
    depends_on: [postgres, redis]

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: secondbloom
      POSTGRES_USER: sb_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pg_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data

volumes:
  pg_data:
  redis_data:
```

### Variabili d'Ambiente (`.env.example`)

```env
# App
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://sb_user:password@localhost:5432/secondbloom

# Redis
REDIS_URL=redis://:password@localhost:6379

# JWT (RS256 — caricare come file o stringa PEM)
JWT_PRIVATE_KEY=...
JWT_PUBLIC_KEY=...
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=30d

# AWS
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=second-bloom-media
AWS_REKOGNITION_THRESHOLD=80

# Verifica Identità
JUMIO_API_TOKEN=...
JUMIO_API_SECRET=...
ONFIDO_API_TOKEN=...

# Twilio / Agora (Safe-Call)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...

# Stripe
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_GOLD_PRICE_ID=...
STRIPE_BOOST_PRICE_ID=...

# Firebase FCM
FIREBASE_SERVICE_ACCOUNT_JSON=...

# Email
SENDGRID_API_KEY=...
EMAIL_FROM=noreply@secondbloom.app
```

### CI/CD — GitHub Actions

```
on: push (main, develop)

jobs:
  lint-and-test:
    - npm ci
    - npm run lint
    - npm run test:unit
    - npm run test:e2e (con postgres/redis in service containers)

  build:
    - docker build
    - push to ECR / registry

  deploy (solo main):
    - deploy su ECS / Railway / Render
```

---

## 12. Testing

| Livello | Tool | Copertura Target |
|---|---|---|
| Unit | Jest | Services core: auth, affinity, matching, chat |
| Integration | Jest + Supertest | Tutti gli endpoint REST critici |
| E2E | Jest + Supertest | Flussi: registrazione→match→chat; pagamento→Gold; verifica KYC |
| WebSocket | Socket.io-client in Jest | Gateway chat: connessione, invio, ricezione, errori auth |

---

## 13. Conformità GDPR

| Requisito | Implementazione |
|---|---|
| Art. 17 — Diritto all'oblio | `DELETE /users/me` → soft-delete immediato; hard-delete o anonimizzazione entro 30 giorni (job scheduler) |
| Art. 20 — Portabilità | `GET /users/me/export` → JSON con tutti i dati del profilo, preferenze, messaggi inviati |
| Minimizzazione | Solo i campi strettamente necessari al matching sono obbligatori; political/religion sono facoltativi con opzione `prefer_not` |
| Sicurezza del trattamento | TLS in transito; colonne sensitive cifrate a riposo (pgcrypto per dati KYC); log di accesso separati |

---

## 14. Roadmap di Sviluppo (Riepilogo Fasi)

| Fase | Moduli | Settimane |
|---|---|---|
| 1 — Fondamenta | Setup, Auth, Users/Profiles | 1 – 3 |
| 2 — Matching Engine | Affinity Score, Swipe, Cache Redis | 4 – 6 |
| 3 — Chat Real-time | Socket.io Gateway, Icebreaker | 7 – 9 |
| 4 — Trust & Safety | Verifica KYC, Moderazione AI | 10 – 11 |
| 5 — Sicurezza Appuntamenti | Safe-Call, Family Button | 12 |
| 6 — Monetizzazione | Subscriptions Gold, Boosts | 13 |
| 7 — Engagement | Notifiche FCM, Onboarding Bot | 14 |
