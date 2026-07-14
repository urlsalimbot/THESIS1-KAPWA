# KAPWA System Architecture Diagram

```mermaid
graph TB
    subgraph Client["Client (PWA React)"]
        UI[React Components + Tailwind CSS]
        Router[React Router v6]
        AuthCtx[Auth Context / JWT Storage]
        API[Fetch API / Axios]
        UI --> Router
        UI --> AuthCtx
        AuthCtx --> API
    end

    subgraph Server["Server (NestJS + TypeORM)"]
        Controllers[Controllers<br/>Auth / Cases / Interventions<br/>Beneficiaries / Programs<br/>Dashboard / IRF / Sync]
        Services[Services<br/>Business Logic + FSM]
        Guards[Guards<br/>RBAC + ABAC + Consent]
        Strategies[Passport Strategies<br/>JWT + Local]
        Entities[TypeORM Entities<br/>User / Case / Intervention<br/>Beneficiary / Program]
        Controllers --> Services
        Controllers --> Guards
        Guards --> Strategies
        Services --> Entities
    end

    subgraph Database["PostgreSQL 16"]
        Tables[Users<br/>Cases<br/>Interventions<br/>Beneficiaries<br/>Households<br/>Family Members<br/>Programs<br/>Consent Ledger<br/>Case Tracker Log<br/>IRF<br/>Notifications<br/>Sync Queue]
    end

    subgraph External["External Services"]
        Swagger[Swagger UI<br/>/api/docs]
        Supabase[Supabase<br/>Optional Auth]
    end

    API -->|HTTPS / JSON| Controllers
    Entities -->|TypeORM| Tables
    Server --> Swagger
    Server -.->|Optional| Supabase

    style Client fill:#E3F2FD,stroke:#1565C0
    style Server fill:#FFF3E0,stroke:#E65100
    style Database fill:#E8F5E9,stroke:#2E7D32
    style External fill:#F3E5F5,stroke:#7B1FA2
```

## Component Details

### Client Layer
- **React 18** with Vite bundler
- **Tailwind CSS** with Figma-matched design tokens
- **lucide-react** icons
- **React Router v6** for SPA routing
- **localStorage** for offline token storage (replaces SQLCipher)

### Server Layer
- **NestJS 10** with modular architecture
- **Passport** JWT + Local strategies for auth
- **Guards**: RBAC (role-based), ABAC (barangay scoping), Consent-gated access
- **Case FSM**: `pending_assessment → in_review → approved → disbursed → closed`
- **Interventions** only allowed after `disbursed` status
- **Swagger** OpenAPI at `/api/docs`

### Data Layer
- **PostgreSQL 16** with extensions: `pgcrypto`, `pg_trgm`, `pgaudit`
- **TypeORM** with entities matching KAPWA-PROJECT.md spec
- **Row-Level Security** (RLS) enabled on sensitive tables
- **Consent Ledger** for RA 10173 compliance

### Compliance & Security
- **RA 10173** (Data Privacy Act) compliance via consent_ledger
- **Hash-chain** integrity for audit trail
- **Audit logging** via pgAudit extension
- **Input validation** with class-validator DTOs
- **Helmet** security headers

### Sprint 1 Modules
| Module | Endpoint Prefix | Status |
|--------|-----------------|--------|
| Auth | `/auth` | ✅ JWT + bcrypt |
| Cases | `/cases` | ✅ FSM implemented |
| Interventions | `/interventions` | ✅ Gated by case status |
| Beneficiaries | `/beneficiaries` | ✅ With consent ledger |
| Programs | `/programs` | ✅ Dynamic JSON Schema |
| Dashboard | `/dashboard` | ✅ Metrics + SLA |
| IRF | `/irf` | ✅ Encryption stubs |
| Sync | `/sync` | ✅ Delta sync stubs |
| Notifications | `/notifications` | ✅ Real-time ready |

## Deployment Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   MSWDO Staff   │      │   Field Worker  │      │   Barangay      │
│   (Browser)     │      │   (Mobile PWA)  │      │   Coordinators  │
└────────┬────────┘      └────────┬─────────┘      └────────┬────────┘
         │ HTTPS                  │ HTTPS                  │ HTTPS
         └────────────────────────┼────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Nginx / Reverse  │
                    │  Proxy (optional)  │
                    └─────────┬─────────┘
                              │
         ┌────────────────────▼────────────────────┐
          │     KAPWA Server (NestJS + Podman)      │
         │  - Auth Module (JWT)                    │
         │  - Case FSM Engine                      │
         │  - Consent & RBAC Guards                │
         │  - Swagger at /api/docs                 │
         └────────────────────┬────────────────────┘
                              │
         ┌────────────────────▼────────────────────┐
          │  PostgreSQL 16 + pgAudit (Podman)       │
         │  - RLS enabled                         │
         │  - Consent ledger                      │
         │  - Hash-chain audit                    │
         └─────────────────────────────────────────┘
```

## Sequence Diagram: Login Flow

```mermaid
sequenceDiagram
    participant C as Client (PWA)
    participant S as Server (NestJS)
    participant DB as PostgreSQL

    C->>S: POST /auth/login {email, password}
    S->>DB: SELECT * FROM users WHERE email = ?
    DB-->>S: User record (hashed password)
    S->>S: bcrypt.compare(password, hashed)
    alt Invalid credentials
        S-->>C: 401 Unauthorized
    else Valid credentials
        S->>S: JWT sign({sub: userId, role, email})
        S-->>C: {accessToken, refreshToken, user}
        C->>C: Store JWT in localStorage
        C->>S: GET /dashboard (Authorization: Bearer <token>)
        S->>S: JwtStrategy.validate(payload)
        S-->>C: Dashboard data
    end
```

## Sequence Diagram: Case FSM Flow

```mermaid
sequenceDiagram
    participant W as Social Worker
    participant S as Server (NestJS)
    participant DB as PostgreSQL

    W->>S: POST /cases {beneficiaryId, serviceRequested}
    S->>S: Validate + Generate control_no
    S->>DB: INSERT INTO cases (status: pending_assessment)
    S-->>W: Case created (pending_assessment)

    W->>S: PATCH /cases/:id/status → in_review
    S->>DB: UPDATE cases SET status = in_review
    S-->>W: Case updated

    W->>S: PATCH /cases/:id/status → approved
    S->>DB: UPDATE cases SET status = approved
    S-->>W: Case approved

    W->>S: PATCH /cases/:id/status → disbursed
    S->>DB: UPDATE cases SET status = disbursed
    S-->>W: Case disbursed

    Note over W,S: Now interventions can be logged

    W->>S: POST /interventions {caseId, amount, type}
    S->>DB: Verify case status = disbursed
    S->>DB: INSERT INTO interventions
    S-->>W: Intervention logged
```
