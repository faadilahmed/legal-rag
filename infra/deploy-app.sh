#!/usr/bin/env bash
# Phase 3 — deploy the Container App after the backend image is in ACR.
# Idempotent: creates the app, attaches the file-share volume, configures
# managed identity, and wires the Anthropic key as a Key Vault secret ref.

set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=infra/deploy.env
source "$ENV_FILE"

IMAGE_TAG="${IMAGE_TAG:-latest}"
ACR_LOGIN_SERVER=$(az acr show -n "$ACR" --query loginServer -o tsv)
IMAGE="${ACR_LOGIN_SERVER}/legal-rag-backend:${IMAGE_TAG}"

echo "[app] image: $IMAGE"

# Grant ACA's environment-level identity access to pull from ACR.
# For Container Apps, the cleanest way to pull from ACR is to enable admin
# credentials on the ACR (already done in deploy.sh) and pass the registry
# server + username/password during `containerapp create`.
ACR_USER=$(az acr credential show -n "$ACR" --query username -o tsv)
ACR_PASS=$(az acr credential show -n "$ACR" --query passwords[0].value -o tsv)

# 1. Create the Container App (or update if it already exists)
echo "[app] (1/4) creating container app $ACA_APP..."
if az containerapp show -n "$ACA_APP" -g "$RG" >/dev/null 2>&1; then
  echo "[app]     already exists, updating image..."
  az containerapp update --name "$ACA_APP" --resource-group "$RG" \
    --image "$IMAGE" -o none
else
  az containerapp create \
    --name "$ACA_APP" \
    --resource-group "$RG" \
    --environment "$ACA_ENV" \
    --image "$IMAGE" \
    --target-port 8000 \
    --ingress external \
    --min-replicas 0 \
    --max-replicas 2 \
    --cpu 1.0 --memory 2.0Gi \
    --registry-server "$ACR_LOGIN_SERVER" \
    --registry-username "$ACR_USER" \
    --registry-password "$ACR_PASS" \
    --env-vars \
        AZURE_STORAGE_CONNECTION_STRING="$STG_CONN" \
        LEGAL_RAG_INDEX_DIR=/app/index_cache \
        LEGAL_RAG_DB_PATH=/app/chat-data/chat.db \
        LEGAL_RAG_CORS_ORIGINS="*" \
    -o none
fi

# 2. Mount the chat-data Azure Files volume at /app/chat-data via YAML patch.
# (CLI flags for volume mounts don't fully cover this — we apply a YAML patch.)
echo "[app] (2/4) mounting chat-data volume..."
cat > /tmp/containerapp-patch.yaml <<EOF
properties:
  template:
    volumes:
      - name: chat-data-vol
        storageType: AzureFile
        storageName: chat-data-mount
    containers:
      - name: legal-rag-api
        image: $IMAGE
        volumeMounts:
          - mountPath: /app/chat-data
            volumeName: chat-data-vol
EOF
az containerapp update --name "$ACA_APP" --resource-group "$RG" \
  --yaml /tmp/containerapp-patch.yaml -o none

# 3. Enable system-assigned managed identity + grant Key Vault access
echo "[app] (3/4) managed identity + Key Vault access..."
az containerapp identity assign --name "$ACA_APP" --resource-group "$RG" \
  --system-assigned -o none
PRIN_ID=$(az containerapp show -n "$ACA_APP" -g "$RG" --query identity.principalId -o tsv)
az keyvault set-policy --name "$KV" --object-id "$PRIN_ID" \
  --secret-permissions get list -o none

# 4. Add ANTHROPIC_API_KEY as a Key Vault secret reference
echo "[app] (4/4) wiring ANTHROPIC_API_KEY from Key Vault..."
az containerapp secret set --name "$ACA_APP" --resource-group "$RG" \
  --secrets "anthropic-api-key=keyvaultref:${KV_URI}secrets/anthropic-api-key,identityref:system" \
  -o none
az containerapp update --name "$ACA_APP" --resource-group "$RG" \
  --set-env-vars "ANTHROPIC_API_KEY=secretref:anthropic-api-key" -o none

ACA_URL=$(az containerapp show -n "$ACA_APP" -g "$RG" \
  --query properties.configuration.ingress.fqdn -o tsv)

echo ""
echo "[app] DONE. Backend URL: https://$ACA_URL"
echo "[app] First request will take ~30–60s (cold start downloads 1.1 GB index from Blob)"
echo "[app] Smoke test: curl https://$ACA_URL/api/health"
echo ""
echo "ACA_URL=$ACA_URL" >> "$ENV_FILE"
