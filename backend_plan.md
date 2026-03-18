# Second Bloom — Piano di Sviluppo Backend

## Stack Tecnologico di Riferimento

| Layer | Tecnologia |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | NestJS (TypeScript) |
| Database primario | PostgreSQL 16 |
| Cache / Sessioni | Redis 7 |
| Real-time | Socket.io |
| Verifica identità | Jumio o Onfido (API) |
| Moderazione AI | AWS Rekognition |
| Archiviazione media | AWS S3 |
| Autenticazione | JWT + Refresh Token (Redis) |

---

## Struttura del Progetto NestJS

```
src/
├── app.module.ts
├── main.ts
│
├── modules/
│   ├── auth/
│   ├── users/
│   ├── profiles/
│   ├── matching/
│   ├── chat/
│   ├── safe-call/
│   ├── verification/
│   ├── moderation/
│   ├── subscriptions/
│   ├── boosts/
│   ├── notifications/
│   └── family-button/
│
├── common/
│   ├── guards/
│   ├── interceptors/
│   ├── decorators/
│   ├── filters/
│   └── pipes/
│
├── config/
│   ├── database.config.ts
│   ├── redis.config.ts
│   └── env.config.ts
│
└── database/
    └── migrations/
```

---

## Fasi di Sviluppo

---

### FASE 1 — Fondamenta (Settimane 1–3)

**Obiettivo**: Infrastruttura di base operativa, autenticazione, profilo utente.

#### 1.1 Setup Progetto & Infrastruttura

- Inizializzare progetto NestJS con TypeScript strict mode.
- Configurare Docker Compose con i servizi: `postgres`, `redis`, `app`.
- Integrare **TypeORM** per la gestione delle migrazioni e delle entità PostgreSQL.
- Configurare **dotenv** + schema di validazione con `class-validator` per le variabili d'ambiente.
- Configurare pipeline CI (GitHub Actions): lint, test, build.

#### 1.2 Modulo Auth

**Endpoint REST**:

| Metodo | Path | Descrizione |
|---|---|---|
| POST | `/auth/register` | Registrazione (email + password hash bcrypt) |
| POST | `/auth/login` | Login → restituisce `access_token` (JWT 15min) + `refresh_token` (Redis, 30gg) |
| POST | `/auth/refresh` | Rinnova access token |
| POST | `/auth/logout` | Invalida refresh token (blacklist Redis) |
| POST | `/auth/forgot-password` | Avvia flusso reset password via email |
| POST | `/auth/reset-password` | Applica nuova password con token OTP |

**Note di sicurezza**:
- Password hashata con `bcrypt` (cost factor 12).
- JWT firmato con `RS256` (chiave asimmetrica).
- Rate limiting su `/auth/login` (max 5 tentativi/15min per IP) tramite `@nestjs/throttler`.
- Refresh token ruotante: ogni uso genera un nuovo token e invalida il precedente.

#### 1.3 Modulo Users & Profiles

**Schema PostgreSQL — tabella `users`**:
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
email         VARCHAR(255) UNIQUE NOT NULL
password_hash VARCHAR(255) NOT NULL
role          ENUM('user', 'admin') DEFAULT 'user'
is_active     BOOLEAN DEFAULT true
is_verified   BOOLEAN DEFAULT false  -- badge Jumio/Onfido
created_at    TIMESTAMPTZ DEFAULT NOW()
```

**Schema PostgreSQL — tabella `profiles`**:
```sql
user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE
display_name      VARCHAR(50) NOT NULL
birth_date        DATE NOT NULL
gender            ENUM('man', 'woman', 'other')
seeking           ENUM('man', 'woman', 'any')
bio               TEXT
city              VARCHAR(100)
latitude          DECIMAL(9,6)
longitude         DECIMAL(9,6)
-- Campi per Affinity Score
intent            ENUM('convivenza','relazione_stabile','amicizia','vediamo')
smokes            BOOLEAN
has_cohabiting_kids BOOLEAN
political_lean    ENUM('left','center','right','apolitical','prefer_not')
religion          ENUM('christian','jewish','muslim','buddhist','atheist','other','prefer_not')
-- Interessi (array PostgreSQL)
interests         TEXT[]
avatar_url        VARCHAR(500)
subscription_tier ENUM('free','gold') DEFAULT 'free'
updated_at        TIMESTAMPTZ DEFAULT NOW()
```

**Endpoint REST**:

| Metodo | Path | Descrizione |
|---|---|---|
| GET | `/users/me` | Profilo dell'utente autenticato |
| PATCH | `/users/me` | Aggiorna dati profilo |
| POST | `/users/me/avatar` | Upload foto profilo (multipart → S3) |
| DELETE | `/users/me` | Soft-delete account |

---

### FASE 2 — Motore di Matching (Settimane 4–6)

**Obiettivo**: Implementare l'Affinity Score e la logica di distribuzione match.

#### 2.1 Formula Affinity Score

Implementazione della formula:

$$S = (0.4 \cdot O) + (0.3 \cdot V) + (0.2 \cdot I) - \log_{10}(D+1)$$

| Componente | Variabile | Calcolo |
|---|---|---|
| Intenzionalità | $O$ | `1.0` se intent identico, `0.5` se compatibile, `0.0` altrimenti |
| Valori & Stile di vita | $V$ | Media pesata dei sottocampi (fumo, figli, politica, religione) normalizzata in `[0,1]` |
| Interessi comuni | $I$ | Indice di Jaccard: `|A ∩ B| / |A ∪ B|` sugli array `interests` |
| Prossimità | $D$ | Distanza in km (formula Haversine tra lat/lon), penalità logaritmica |

#### 2.2 Pipeline di Calcolo

```
[Job schedulato ogni notte / on-demand]
  └─ Per ogni utente attivo:
       1. Recupera candidati dalla DB (filtri hard: età, genere ricercato, max 200km)
       2. Calcola S per ogni candidato
       3. Ordina per S decrescente
       4. Salva top-50 in Redis con TTL 24h   ← CACHE MATCH
       5. Preleva i risultati già visti (SET Redis "seen:{userId}")
          per escluderli dalla coda giornaliera
```

**Schema Redis**:
- `match:queue:{userId}` — Sorted Set (score = S), TTL 24h
- `match:seen:{userId}` — Set di UUID già mostrati, TTL 30gg

#### 2.3 Modulo Matching

**Schema PostgreSQL — tabella `swipes`**:
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
actor_id    UUID REFERENCES users(id)
target_id   UUID REFERENCES users(id)
action      ENUM('yes','pass')
created_at  TIMESTAMPTZ DEFAULT NOW()
UNIQUE(actor_id, target_id)
```

**Schema PostgreSQL — tabella `matches`**:
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_a_id   UUID REFERENCES users(id)
user_b_id   UUID REFERENCES users(id)
matched_at  TIMESTAMPTZ DEFAULT NOW()
is_active   BOOLEAN DEFAULT true
```

**Endpoint REST**:

| Metodo | Path | Descrizione |
|---|---|---|
| GET | `/matching/discover` | Restituisce il prossimo profilo da valutare (da cache Redis) |
| POST | `/matching/swipe` | Body: `{ targetId, action: 'yes'|'pass' }`. Registra swipe, controlla match reciproco |
| POST | `/matching/undo` | Annulla l'ultimo swipe (tasto "Annulla Errore") |
| GET | `/matching/matches` | Lista dei match attivi dell'utente |

**Logica "Annulla Errore"**:
- Conservare in Redis (`undo:{userId}`) l'ID dell'ultimo swipe per max 1 annullamento.
- L'undo elimina il record `swipes` e de-incrementa il contatore giornaliero.

**Limite Free Tier**: interceptor che verifica `swipes_today` (Redis counter, TTL a mezzanotte) e blocca con `HTTP 429` dopo 5 "Sì" giornalieri.

---

### FASE 3 — Chat & Real-time (Settimane 7–9)

**Obiettivo**: Messaggistica istantanea sicura via Socket.io.

#### 3.1 Schema Database Chat

**tabella `conversations`**:
```sql
id        UUID PRIMARY KEY DEFAULT gen_random_uuid()
match_id  UUID REFERENCES matches(id) UNIQUE
created_at TIMESTAMPTZ DEFAULT NOW()
```

**tabella `messages`**:
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
conversation_id UUID REFERENCES conversations(id)
sender_id       UUID REFERENCES users(id)
content         TEXT NOT NULL
type            ENUM('text','icebreaker','system') DEFAULT 'text'
is_read         BOOLEAN DEFAULT false
created_at      TIMESTAMPTZ DEFAULT NOW()
```

#### 3.2 Gateway Socket.io (NestJS `@WebSocketGateway`)

**Namespace**: `/chat`

**Events emessi dal client**:
| Evento | Payload | Descrizione |
|---|---|---|
| `join_conversation` | `{ conversationId }` | Entra nella stanza della conversazione |
| `send_message` | `{ conversationId, content, type }` | Invia un messaggio |
| `typing` | `{ conversationId }` | Indicatore di digitazione |
| `read_message` | `{ messageId }` | Segna come letto |

**Events emessi dal server**:
| Evento | Payload | Descrizione |
|---|---|---|
| `new_message` | Oggetto messaggio completo | Nuovo messaggio ricevuto |
| `user_typing` | `{ userId }` | L'altro sta scrivendo |
| `match_created` | Oggetto match | Notifica nuovo match |
| `message_read` | `{ messageId }` | Conferma lettura |

**Sicurezza WebSocket**:
- Autenticazione tramite JWT nel handshake (`auth.token`).
- Guard NestJS applicato sul gateway prima di qualsiasi evento.
- Un utente può accedere solo alle conversazioni legate ai propri match.

#### 3.3 Suggeritori Icebreaker

- Al primo messaggio in una conversazione, il server analizza gli interessi condivisi e inietta un messaggio di tipo `system` con un suggerimento pre-generato.
- Template: `"Entrambi amate [hobby]. Perché non chiedi a [Nome] [domanda_contestuale]?"` — gestiti da una tabella `icebreaker_templates` con categorie per hobby.

---

### FASE 4 — Verifica Identità & Moderazione AI (Settimane 10–11)

**Obiettivo**: Implementare il trust system e il badge "Profilo Verificato".

#### 4.1 Verifica Biometrica (Jumio / Onfido)

**Flusso**:
1. `POST /verification/start` → Il backend crea una sessione di verifica tramite API Jumio/Onfido e restituisce l'URL/token al client Flutter.
2. Il client completa il KYC direttamente sull'SDK del provider.
3. Il provider invia un **webhook** a `POST /verification/webhook`.
4. Il backend aggiorna `users.is_verified = true` e invia notifica push/socket all'utente.

**Schema tabella `verifications`**:
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id       UUID REFERENCES users(id)
provider      ENUM('jumio','onfido')
session_id    VARCHAR(255)
status        ENUM('pending','approved','rejected')
completed_at  TIMESTAMPTZ
```

**Sicurezza Webhook**:
- Validare la firma HMAC (`X-Signature` header) del provider prima di processare.
- Idempotenza: ignorare webhook duplicati con lo stesso `session_id`.

#### 4.2 Moderazione AI (AWS Rekognition)

**Trigger**: ogni upload di foto profilo.

**Flusso**:
1. Immagine caricata su S3 in cartella `pending/`.
2. Job asincrono (AWS Lambda o worker NestJS) invoca `DetectModerationLabels`.
3. Se la confidenza su label offensive supera il threshold (es. 80%): immagine eliminata da S3, utente notificato, account flaggato.
4. Se approvata: immagine spostata in `public/`, `profiles.avatar_url` aggiornato.

---

### FASE 5 — Safe-Call & Family Button (Settimana 12)

**Obiettivo**: Funzionalità di sicurezza distintive del prodotto.

#### 5.1 Safe-Call (Chiamata Vocale/Video In-App)

Integrazione con **Twilio Programmable Video** o **Agora.io**:

| Metodo | Path | Descrizione |
|---|---|---|
| POST | `/safe-call/token` | Genera un token lato server per la stanza di chiamata (room = match ID). Verificare che entrambi gli utenti abbiano un match attivo. |
| DELETE | `/safe-call/end` | Termina la sessione di chiamata e registra il log. |

**tabella `call_logs`**:
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
match_id    UUID REFERENCES matches(id)
initiated_by UUID REFERENCES users(id)
started_at  TIMESTAMPTZ
ended_at    TIMESTAMPTZ
duration_s  INTEGER
```

#### 5.2 Family Button (Condivisione sicura)

| Metodo | Path | Descrizione |
|---|---|---|
| POST | `/family-button/share` | Body: `{ matchId, trustedContactEmail }`. Invia email (via SendGrid/SES) con scheda profilo del match (nome visualizzato, età, città, link a profilo verificato). |

- L'email non include dati sensibili (no email/telefono del match).
- Rate limit: max 3 invii al giorno per utente.

---

### FASE 6 — Monetizzazione (Settimana 13)

**Obiettivo**: Abbonamento Gold e micro-transazioni Boost.

#### 6.1 Abbonamenti

Integrazione con **Stripe** (web) + **Apple/Google In-App Purchase** (mobile):

| Metodo | Path | Descrizione |
|---|---|---|
| POST | `/subscriptions/checkout` | Crea sessione Stripe Checkout o valida receipt IAP |
| POST | `/subscriptions/webhook` | Webhook Stripe per aggiornamenti stato abbonamento |
| GET | `/subscriptions/status` | Ritorna tier attivo e data di scadenza |
| DELETE | `/subscriptions/cancel` | Avvia cancellazione (fine periodo già pagato) |

**Funzionalità Gold sbloccate lato backend**:
- Rimozione limite 5 match/giorno.
- Endpoint `GET /matching/who-liked-me` (ritorna lista utenti che hanno messo "Sì").
- Possibilità di attivare modalità "Invisibile" (`PATCH /users/me/visibility`).

#### 6.2 Boost

**tabella `boosts`**:
```sql
id         UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id    UUID REFERENCES users(id)
started_at TIMESTAMPTZ DEFAULT NOW()
expires_at TIMESTAMPTZ  -- started_at + 24h
payment_ref VARCHAR(255)
```

| Metodo | Path | Descrizione |
|---|---|---|
| POST | `/boosts/activate` | Acquista e attiva boost. Registra su Stripe. Imposta TTL in Redis: `boost:{userId}` con TTL 86400s |

L'algoritmo di matching legge la chiave Redis e moltiplica lo score S del profilo boostato per un coefficiente `k = 1.5`.

---

### FASE 7 — Notifiche & Onboarding Bot (Settimana 14)

#### 7.1 Notifiche Push

- Integrazione **Firebase Cloud Messaging (FCM)** per Android e iOS.
- Tabella `device_tokens` per associare `user_id` ai token FCM.
- Servizio `NotificationsService` centralizzato invocato da tutti i moduli (nuovo match, nuovo messaggio, match che ha visto il profilo, scadenza boost).

#### 7.2 Assistente Onboarding

- Sequenza di passi guidati memorizzata in una tabella `onboarding_steps`.
- `GET /onboarding/status` → restituisce il passo corrente e il % di completamento profilo.
- `POST /onboarding/complete-step` → marca il passo come completato.
- Il profilo incompleto (< 80%) viene penalizzato nell'algoritmo di matching (moltiplicatore 0.7 su S).

---

## Riepilogo Roadmap

| Fase | Contenuto | Durata |
|---|---|---|
| 1 | Setup, Auth, Profili | Settimane 1–3 |
| 2 | Affinity Score & Matching Engine | Settimane 4–6 |
| 3 | Chat Real-time & Icebreaker | Settimane 7–9 |
| 4 | Verifica Identità & Moderazione AI | Settimane 10–11 |
| 5 | Safe-Call & Family Button | Settimana 12 |
| 6 | Monetizzazione (Gold + Boost) | Settimana 13 |
| 7 | Notifiche Push & Onboarding Bot | Settimana 14 |

---

## Principi Trasversali

- **Sicurezza OWASP**: validazione input con `class-validator` su ogni DTO, nessuna query raw non parametrizzata, header di sicurezza via `helmet`.
- **Testing**: unit test (Jest) per ogni service; e2e test per i flussi critici (auth, matching, pagamento).
- **Logging**: `Winston` + correlazione per request ID; log di sicurezza separati (tentativi login falliti, flag moderation).
- **Scalabilità**: i worker di calcolo match e moderazione AI sono isolati in code (Bull + Redis) per non bloccare il thread HTTP principale.
- **GDPR**: endpoint `DELETE /users/me` esegue hard-delete o anonimizzazione entro 30gg; esportazione dati via `GET /users/me/export`.
