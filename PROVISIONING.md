# Open Brain — GCP Cloud SQL Provisioning Spec

> **Project**: botridge  
> **Region**: us-central1  
> **Purpose**: Relational shadow store for biometric signals; feeds the MCP server's analytical tools without touching the primary Firebase stack.

---

## 1. Cloud SQL Instance

```bash
# One-time instance creation — ~$15/month at sustained use
gcloud sql instances create openbrain \
  --project=botridge \
  --database-version=POSTGRES_16 \
  --tier=db-custom-1-3840 \
  --region=us-central1 \
  --storage-size=10GB \
  --storage-type=SSD \
  --storage-auto-increase \
  --no-assign-ip \
  --enable-google-private-path
```

| Parameter | Value | Rationale |
|---|---|---|
| `tier` | `db-custom-1-3840` | 1 vCPU / 3.75 GB RAM — cheapest custom tier |
| `storage-size` | 10 GB SSD | Enough for ~5M signal rows |
| `storage-auto-increase` | enabled | Avoids manual headroom ops |
| `no-assign-ip` | true | No public endpoint — internal only |
| `enable-google-private-path` | true | Cloud Run → Cloud SQL via private IP |

---

## 2. Database & User

```bash
# Create the database
gcloud sql databases create biofeedback \
  --instance=openbrain \
  --project=botridge

# Create app user
gcloud sql users create biofeedback_app \
  --instance=openbrain \
  --project=botridge \
  --password="$(openssl rand -base64 32)"
```

Store the generated password in Secret Manager:

```bash
echo -n "<generated-password>" | \
  gcloud secrets create OPENBRAIN_DB_PASSWORD \
    --project=botridge \
    --data-file=-
```

---

## 3. IAM — Cloud SQL Auth Proxy (Cloud Run → Cloud SQL)

The Functions runtime connects via the Cloud SQL Auth Proxy socket path. No passwords needed for the function runtime — IAM handles authentication.

```bash
# Grant the default Cloud Functions service account Cloud SQL Client role
gcloud projects add-iam-policy-binding botridge \
  --member="serviceAccount:botridge@appspot.gserviceaccount.com" \
  --role="roles/cloudsql.client"
```

Connection string inside Cloud Run / Cloud Functions (set as env var `DATABASE_URL`):

```
postgresql://biofeedback_app:<PASSWORD>@/biofeedback?host=/cloudsql/botridge:us-central1:openbrain
```

Set this as a Firebase Function secret:

```bash
firebase functions:secrets:set OPENBRAIN_DATABASE_URL --project botridge
# Paste: postgresql://biofeedback_app:<PASSWORD>@/biofeedback?host=/cloudsql/botridge:us-central1:openbrain
```

Then reference it in `functions/src/index.ts`:

```typescript
const OPENBRAIN_DATABASE_URL = defineSecret("OPENBRAIN_DATABASE_URL");
```

And add `cloudSqlInstances: "botridge:us-central1:openbrain"` to any function that needs DB access.

---

## 4. Schema

Run this against the `biofeedback` database after instance creation:

```bash
gcloud sql connect openbrain --user=biofeedback_app --database=biofeedback --project=botridge
```

Then paste `packages/mcp-server/schema.sql` — or pipe it:

```bash
gcloud sql connect openbrain --user=biofeedback_app --database=biofeedback --project=botridge \
  < packages/mcp-server/schema.sql
```

---

## 5. MCP Server Local Development

The MCP server connects to Cloud SQL via the Auth Proxy running locally:

```bash
# Download and run the proxy
./cloud-sql-proxy botridge:us-central1:openbrain --port=5432

# Set env var for local dev
export DATABASE_URL="postgresql://biofeedback_app:<PASSWORD>@localhost/biofeedback"

# Run the MCP server
cd packages/mcp-server && npm run dev
```

---

## 6. Cost Estimate

| Resource | Monthly |
|---|---|
| Cloud SQL `db-custom-1-3840` (730 hrs) | ~$28 |
| 10 GB SSD storage | ~$1.70 |
| Cloud SQL Auth Proxy egress (negligible) | ~$0 |
| **Total** | **~$30/month** |

> Stop the instance when not actively developing: `gcloud sql instances patch openbrain --activation-policy=NEVER --project=botridge`

---

## 7. Teardown

```bash
gcloud sql instances delete openbrain --project=botridge
gcloud secrets delete OPENBRAIN_DATABASE_URL --project=botridge
```
