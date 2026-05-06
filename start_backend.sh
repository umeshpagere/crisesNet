#!/bin/bash
# CrisisNet Backend — starts Flask with the venv Python and correct env vars
set -e
cd "$(dirname "$0")"

export GOOGLE_CLOUD_PROJECT=crisisnet-2026
export GRPC_DNS_RESOLVER=native          # fix: gRPC native DNS resolver

echo "Starting CrisisNet backend on http://0.0.0.0:8080 ..."
venv/bin/python3 -m flask --app backend.main run --host=0.0.0.0 --port=8080
