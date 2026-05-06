"""
AI Advisor Service — Vertex AI Gemini streaming integration.

Provides:
  - recommend_allocation(resources, gaps)  → streaming SSE recommendation
  - ask_question(question, context)        → streaming SSE answer
  - generate_handover_brief(ngo_id, stats) → streaming SSE handover brief

Falls back to deterministic mock responses when Vertex AI is unavailable
(e.g. no credentials, local dev, unit tests).
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Generator

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Optional Vertex AI import
# ---------------------------------------------------------------------------
try:
    import vertexai
    from vertexai.generative_models import GenerativeModel, GenerationConfig
    _VERTEX_AVAILABLE = True
except ImportError:
    _VERTEX_AVAILABLE = False
    logger.warning("vertexai SDK not installed — running in mock mode")


class AIAdvisorService:
    """
    Thin wrapper around Vertex AI Gemini that exposes streaming generators
    suitable for Flask SSE endpoints (yield "data: …\\n\\n").
    """

    MODEL_ID = "gemini-1.5-pro"
    PROJECT   = os.getenv("GOOGLE_CLOUD_PROJECT", "crisisnet-2026")
    LOCATION  = os.getenv("VERTEX_LOCATION", "us-central1")

    def __init__(self) -> None:
        self._model: Any = None
        if _VERTEX_AVAILABLE:
            try:
                vertexai.init(project=self.PROJECT, location=self.LOCATION)
                self._model = GenerativeModel(self.MODEL_ID)
                logger.info("Vertex AI Gemini initialised (%s)", self.MODEL_ID)
            except Exception as exc:
                logger.warning("Vertex AI init failed: %s — using mock mode", exc)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def recommend_allocation(
        self,
        resources: list[dict],
        gaps: list[dict],
    ) -> Generator[str, None, None]:
        """Yield SSE data lines with allocation recommendations."""
        if self._model:
            yield from self._stream_recommendation_vertex(resources, gaps)
        else:
            yield from self._mock_recommendation(resources, gaps)

    def ask_question(
        self,
        question: str,
        context: dict | None = None,
    ) -> Generator[str, None, None]:
        """Yield SSE data lines with a natural-language answer."""
        if self._model:
            yield from self._stream_ask_vertex(question, context or {})
        else:
            yield from self._mock_ask(question)

    def generate_handover_brief(
        self,
        ngo_id: str,
        stats: dict | None = None,
    ) -> Generator[str, None, None]:
        """Yield SSE data lines with a shift handover briefing."""
        if self._model:
            yield from self._stream_handover_vertex(ngo_id, stats or {})
        else:
            yield from self._mock_handover(ngo_id, stats or {})

    # ------------------------------------------------------------------
    # Vertex AI streaming implementations
    # ------------------------------------------------------------------

    def _stream_recommendation_vertex(
        self, resources: list[dict], gaps: list[dict]
    ) -> Generator[str, None, None]:
        prompt = self._build_recommendation_prompt(resources, gaps)
        try:
            response = self._model.generate_content(
                prompt,
                generation_config=GenerationConfig(
                    max_output_tokens=512,
                    temperature=0.3,
                    response_mime_type="application/json",
                ),
                stream=False,
            )
            raw = response.text.strip()
            # Gemini may wrap in ```json … ```
            if raw.startswith("```"):
                raw = raw.split("```")[1].lstrip("json").strip()
            parsed = json.loads(raw)
            yield f"data: {json.dumps(parsed)}\n\n"
        except Exception as exc:
            logger.error("Vertex recommendation error: %s", exc)
            yield from self._mock_recommendation(resources, gaps)

    def _stream_ask_vertex(
        self, question: str, context: dict
    ) -> Generator[str, None, None]:
        prompt = (
            "You are an expert disaster-response AI advisor for the CrisisNet system.\n"
            f"Context: {json.dumps(context)}\n\n"
            f"Question: {question}\n\n"
            "Answer concisely (≤3 sentences), grounding your answer in the context data."
        )
        try:
            response = self._model.generate_content(
                prompt,
                generation_config=GenerationConfig(max_output_tokens=256, temperature=0.4),
                stream=False,
            )
            result = {"answer": response.text.strip(), "confidence": 0.88}
            yield f"data: {json.dumps(result)}\n\n"
        except Exception as exc:
            logger.error("Vertex ask error: %s", exc)
            yield from self._mock_ask(question)

    def _stream_handover_vertex(
        self, ngo_id: str, stats: dict
    ) -> Generator[str, None, None]:
        prompt = self._build_handover_prompt(ngo_id, stats)
        try:
            response = self._model.generate_content(
                prompt,
                generation_config=GenerationConfig(max_output_tokens=600, temperature=0.35),
                stream=False,
            )
            result = {
                "briefing": response.text.strip(),
                "crises_handled":   stats.get("crises_handled", 0),
                "people_reached":   stats.get("people_reached", 0),
                "open_crises":      stats.get("open_crises", 0),
                "coverage_gaps":    stats.get("coverage_gaps", 0),
            }
            yield f"data: {json.dumps(result)}\n\n"
        except Exception as exc:
            logger.error("Vertex handover error: %s", exc)
            yield from self._mock_handover(ngo_id, stats)

    # ------------------------------------------------------------------
    # Prompt builders
    # ------------------------------------------------------------------

    @staticmethod
    def _build_recommendation_prompt(resources: list[dict], gaps: list[dict]) -> str:
        return (
            "You are a disaster-response resource allocation expert.\n\n"
            f"Available resources ({len(resources)}):\n"
            f"{json.dumps(resources[:10], indent=2)}\n\n"
            f"Unserved crisis gaps ({len(gaps)}):\n"
            f"{json.dumps(gaps[:5], indent=2)}\n\n"
            "Produce a JSON allocation plan with this exact schema:\n"
            "{\n"
            '  "recommendations": [\n'
            '    { "resource_id": str, "lat": float, "lng": float,\n'
            '      "zone_name": str, "reason": str,\n'
            '      "confidence": float 0-1, "people_covered": int }\n'
            "  ],\n"
            '  "summary": str,\n'
            '  "coverage_delta": int\n'
            "}\n"
            "Output ONLY valid JSON, no markdown fences."
        )

    @staticmethod
    def _build_handover_prompt(ngo_id: str, stats: dict) -> str:
        return (
            f"You are writing a shift handover briefing for NGO '{ngo_id}'.\n\n"
            f"Operational stats for the past shift:\n{json.dumps(stats, indent=2)}\n\n"
            "Write a concise (≤200 words) plain-text briefing covering:\n"
            "1. Summary of crises handled and people reached\n"
            "2. Remaining coverage gaps and their priority\n"
            "3. Top 3 recommended actions for the incoming shift\n"
            "Use clear section headers. No bullet points, just short paragraphs."
        )

    # ------------------------------------------------------------------
    # Mock fallbacks (deterministic, no external calls)
    # ------------------------------------------------------------------

    @staticmethod
    def _mock_recommendation(
        resources: list[dict], gaps: list[dict]
    ) -> Generator[str, None, None]:
        """Priority-sorted deterministic mock."""
        sorted_gaps = sorted(
            gaps, key=lambda g: g.get("priority_score", 0), reverse=True
        )
        recs = []
        for i, gap in enumerate(sorted_gaps[:3]):
            res = resources[i] if i < len(resources) else {"resource_id": f"RESOURCE_{i+1}"}
            recs.append({
                "resource_id": res.get("resource_id", f"RES_{i+1}"),
                "lat": gap.get("lat", 19.9975),
                "lng": gap.get("lng", 73.7898),
                "zone_name": gap.get("crisis_type", "Unknown").capitalize() + " Zone",
                "reason": (
                    f"{gap.get('affected_people', 0)} people unserved, "
                    f"severity {gap.get('crisis_severity', 5)}, "
                    f"nearest NGO {gap.get('distance_to_nearest_km', 0):.1f} km away"
                ),
                "confidence": min(0.95, 0.6 + gap.get("priority_score", 5) / 50),
                "people_covered": gap.get("affected_people", 0),
            })

        total_people = sum(r["people_covered"] for r in recs)
        payload = {
            "recommendations": recs,
            "summary": (
                f"Deploy {len(recs)} resource(s) to cover highest-priority gaps — "
                f"+{total_people} people reached"
            ),
            "coverage_delta": total_people,
        }
        yield f"data: {json.dumps(payload)}\n\n"

    @staticmethod
    def _mock_ask(question: str) -> Generator[str, None, None]:
        q_lower = question.lower()
        if "gap" in q_lower or "unserved" in q_lower or "need" in q_lower:
            answer = (
                "The biggest unmet needs are in Sinnar Taluka (47 people, severity 8) "
                "and Nandur Madhmeshwar (23 people, severity 6). "
                "Both areas have no NGO coverage within 8 km."
            )
        elif "boat" in q_lower or "resource" in q_lower:
            answer = (
                "Currently 3 boats are available and 2 are deployed to active crises. "
                "Recommend keeping at least 1 boat on standby at the Nashik River staging area."
            )
        elif "priority" in q_lower or "critical" in q_lower:
            answer = (
                "Critical priorities: (1) Boat rescue in NK-001 area — 8 people stranded. "
                "(2) Medical team to NK-002 cluster — 47 people affected. "
                "(3) Shelter deployment for NK-003 before nightfall."
            )
        else:
            answer = (
                "Based on current operations data, the most pressing action is to "
                "deploy available resources to the highest-severity coverage gaps. "
                "Use the AI Recommendations panel for a detailed allocation plan."
            )
        payload = {"answer": answer, "confidence": 0.82}
        yield f"data: {json.dumps(payload)}\n\n"

    @staticmethod
    def _mock_handover(ngo_id: str, stats: dict) -> Generator[str, None, None]:
        crises   = stats.get("crises_handled", 12)
        people   = stats.get("people_reached", 487)
        gaps     = stats.get("coverage_gaps", 2)
        open_c   = stats.get("open_crises", 3)

        briefing = (
            f"SHIFT HANDOVER — {__import__('datetime').datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}\n"
            f"NGO: {ngo_id}\n\n"
            f"SITREP\n"
            f"This shift handled {crises} crisis events and reached {people} people. "
            f"Operational tempo was high; all responding units performed within SLA.\n\n"
            f"OPEN ITEMS\n"
            f"{open_c} crises remain active. {gaps} coverage gap(s) are unresolved. "
            f"The most critical gap is in Sinnar Taluka (SEV 8, 47 people, 8 km from nearest NGO).\n\n"
            f"RECOMMENDED ACTIONS FOR INCOMING SHIFT\n"
            f"1. Immediately deploy a boat unit to Sinnar Taluka gap (19.847, 73.999).\n"
            f"2. Relieve the medical team at NK-002 cluster — they have been on-site for 6+ hours.\n"
            f"3. Confirm shelter setup for NK-003 before 18:00 local time."
        )
        payload = {
            "briefing": briefing,
            "crises_handled": crises,
            "people_reached": people,
            "open_crises": open_c,
            "coverage_gaps": gaps,
        }
        yield f"data: {json.dumps(payload)}\n\n"
