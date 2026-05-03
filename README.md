# CrisisNet API

Production-ready crisis response platform: Flask backend, OR-Tools optimizer, React Native mobile app.

## Repository Layout

```
crisisnet-api/
├── backend/              # Flask API + Python packages
│   ├── main.py           # Flask entry point (app = Flask(__name__))
│   ├── services/         # allocation_optimizer, gps_service, heatmap_service, pubsub_bridge
│   └── agents/           # 5-agent decision hub (verification, assessment, allocation, ...)
├── app/                  # React Native mobile app
│   └── CrisisNetMobile/
├── dashboard/            # (reserved for web dashboard)
├── tests/                # Pytest suite
│   ├── test_allocation_optimizer.py
│   ├── test_e2e_integration.py
│   ├── test_phase0_infrastructure.py
│   └── test_phase2_agents.py
├── benchmarks/           # Performance benchmarks
│   ├── benchmark_allocation.py
│   ├── benchmark_full_suite.py
│   ├── benchmark_hub.py
│   ├── run_benchmarks.py
│   └── results/          # JSON benchmark outputs
├── scripts/              # Operational scripts
│   ├── deploy_cloud_run.sh
│   ├── smoke_tests.py
│   ├── demo_seeder.py
│   ├── demo_dry_run.py
│   ├── phase5_gate.py
│   ├── run_all_tests.py
│   └── validate_prompts.py
├── demo-data/            # Generated demo scenario JSON
├── docs/
│   ├── phases/           # PHASE_*.md progress reports
│   ├── operations/       # Deployment / iteration docs
│   ├── agent_prompts.yaml
│   └── ...
├── config/               # firestore.indexes.json
├── Dockerfile
├── requirements.txt
└── README.md
```

## Quick Commands

```bash
# Run backend locally
python3 -m backend.main

# Run all tests
python3 -m pytest tests/ -v

# Run full Phase 5 gate (6 checks, starts Flask automatically)
python3 scripts/phase5_gate.py

# Deploy to Cloud Run
bash scripts/deploy_cloud_run.sh --project YOUR_PROJECT_ID

# Smoke-test a deployed service
python3 scripts/smoke_tests.py --url https://your-service-xxx.run.app

# Seed demo data
python3 scripts/demo_seeder.py --scenario multi_crisis

# Run allocation benchmark
python3 benchmarks/benchmark_allocation.py
```

## Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service + Firestore health |
| POST | `/api/allocate` | OR-Tools TSP responder allocation |
| POST | `/api/benchmark` | Write benchmark result |
| GET | `/api/benchmark/:phase` | Read benchmark result |
