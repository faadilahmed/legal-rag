#!/usr/bin/env bash
#
# Provisions all Azure resources for the legal-rag deployment. Idempotent —
# resources that already exist are left alone. Sources from .env for secrets.
#
# Run: bash infra/deploy.sh
# Requires: az CLI logged in (az login), .env in repo root with ANTHROPIC_API_KEY
#
# Names with a numeric suffix must be globally unique; we derive the suffix from
# epoch seconds and persist it to infra/deploy.env so subsequent runs reuse it.

set -euo pipefail
cd "$(dirname "$0")/.."

# Load ANTHROPIC_API_KEY from .env (gitignored)
[ -f .env ] && export $(grep -v '^#' .env | xargs)

# Persisted resource names — first run creates, subsequent runs read from disk
ENV_FILE=infra/deploy.env
if [ -f "$ENV_FILE" ]; then
  source "$ENV_FILE"
  echo "[deploy] using existing names from $ENV_FILE"
else
  SUFFIX=$(date +%s | tail -c 6)
  RG=legal-rag-rg
  LOCATION=eastus
  ACR=legalragacr${SUFFIX}
  STG=legalragstg${SUFFIX}
  KV=legalragkv${SUFFIX}
  ACA_ENV=legal-rag-env
  ACA_APP=legal-rag-api
  cat > "$ENV_FILE" <<EOF
SUFFIX=$SUFFIX
RG=$RG
LOCATION=$LOCATION
ACR=$ACR
STG=$STG
KV=$KV
ACA_ENV=$ACA_ENV
ACA_APP=$ACA_APP
EOF
  echo "[deploy] generated new names → $ENV_FILE"
fi

echo "[deploy] Names: RG=$RG LOCATION=$LOCATION ACR=$ACR STG=$STG KV=$KV"

# 1. Resource Group
echo "[deploy] (1/7) Resource group..."
az group create --name "$RG" --location "$LOCATION" -o none

# 2. Container Registry (Basic tier; free during free trial)
echo "[deploy] (2/7) Container Registry $ACR..."
az acr create --name "$ACR" --resource-group "$RG" --sku Basic --admin-enabled true -o none

# 3. Storage Account + blob container + file share
echo "[deploy] (3/7) Storage account $STG..."
az storage account create --name "$STG" --resource-group "$RG" --location "$LOCATION" \
  --sku Standard_LRS -o none
STG_KEY=$(az storage account keys list -n "$STG" -g "$RG" --query [0].value -o tsv)
echo "[deploy]     blob container 'rag-index'..."
az storage container create --account-name "$STG" --account-key "$STG_KEY" \
  --name rag-index -o none
echo "[deploy]     file share 'chat-data'..."
az storage share create --account-name "$STG" --account-key "$STG_KEY" \
  --name chat-data --quota 1 -o none

# 4. Key Vault + secret
echo "[deploy] (4/7) Key Vault $KV..."
az keyvault create --name "$KV" --resource-group "$RG" --location "$LOCATION" \
  --enable-rbac-authorization false -o none
echo "[deploy]     ANTHROPIC_API_KEY secret..."
az keyvault secret set --vault-name "$KV" --name anthropic-api-key \
  --value "$ANTHROPIC_API_KEY" -o none

# 5. Container Apps Environment
echo "[deploy] (5/7) Container Apps environment $ACA_ENV..."
az containerapp env create --name "$ACA_ENV" --resource-group "$RG" \
  --location "$LOCATION" -o none

# 6. Mount file share into the ACA environment
echo "[deploy] (6/7) Azure Files storage mount in ACA env..."
az containerapp env storage set --name "$ACA_ENV" --resource-group "$RG" \
  --storage-name chat-data-mount \
  --azure-file-account-name "$STG" \
  --azure-file-account-key "$STG_KEY" \
  --azure-file-share-name chat-data \
  --access-mode ReadWrite -o none

# 7. Persist connection string + KV URI for Phase 3
STG_CONN=$(az storage account show-connection-string -n "$STG" -g "$RG" -o tsv)
KV_URI=$(az keyvault show -n "$KV" -g "$RG" --query properties.vaultUri -o tsv)
cat >> "$ENV_FILE" <<EOF
STG_CONN=$STG_CONN
STG_KEY=$STG_KEY
KV_URI=$KV_URI
EOF
echo "[deploy] (7/7) wrote STG_CONN, STG_KEY, KV_URI → $ENV_FILE"

echo ""
echo "[deploy] DONE. Resources provisioned in resource group '$RG'."
echo "[deploy] Next: upload the index with infra/upload-index.sh"
