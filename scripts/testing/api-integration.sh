#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "$0")/../.." && pwd)
run_id="rush-api-test-$$-${RANDOM}"
container_id=""

cleanup() {
    local status=$?
    # Keep the test result even when container cleanup succeeds or fails.
    if [[ -n "$container_id" ]]; then
        docker rm --force "$container_id" >/dev/null || true
    fi
    exit "$status"
}
trap cleanup EXIT

# The container owns all test data; no host volume or existing database is used.
container_id=$(docker run --detach --rm \
    --label "rush-app.integration-test=$run_id" \
    --publish 127.0.0.1::27017 \
    --tmpfs /data/db \
    --env "RUSH_TEST_RUN_ID=$run_id" \
    mongo:7.0@sha256:9854f7139445d766a9523571d6f047530c45547460ffcf8259eb2bf4264632ca)

ready=false
for attempt in {1..30}; do
    if readiness_output=$(docker exec "$container_id" mongosh --quiet --eval \
        'db.getSiblingDB("rush-app").getCollection("_integration_guard").updateOne({runId: process.env.RUSH_TEST_RUN_ID}, {$set: {isolated: true}}, {upsert: true})' \
        2>&1); then
        ready=true
        break
    fi
    sleep 1
done
if [[ "$ready" != true ]]; then
    printf '%s\n' "$readiness_output" >&2
    docker logs --tail 20 "$container_id"
    exit 1
fi

port=$(docker port "$container_id" 27017/tcp)
export RUSH_TEST_MONGO_URL="mongodb://${port}/?directConnection=true"
export RUSH_TEST_RUN_ID="$run_id"
export RUSH_TIMEZONE=America/New_York
export API_KEY=rush-integration-test-key

if [[ ${RUSH_TEST_CROSS_STORE:-} == 1 ]]; then
    # The separate Redis contract changes ACLs, so run this shared-store test alone.
    cargo test --locked --manifest-path "$repo_root/server/api/Cargo.toml" \
        --features integration-tests,redis-integration-tests database_contracts -- --nocapture
else
    cargo test --locked --manifest-path "$repo_root/server/api/Cargo.toml" \
        --features integration-tests -- --nocapture
fi
