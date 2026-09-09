import json
import re
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

import structlog
from ai_core import ChatMessage, ChatRole, ModelConfig, get_provider
from config import get_settings
from models.workspace import ConceptModel, EdgeModel, NodeModel, node_concepts
from schemas.roadmap import (
    RoadmapGenerateRequest,
    RoadmapGenerateResponse,
    RoadmapPlan,
    RoadmapTopic,
)
from schemas.workspace import WorkspaceCreate
from services.workspace_service import WorkspaceService
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()
settings = get_settings()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class RoadmapService:
    @staticmethod
    def _build_prompt(goal: str, level: str, focus: str) -> str:
        return f"""You are an elite educator and curriculum engineer.
Generate a comprehensive, step-by-step learning roadmap for the following:
Goal: "{goal}"
Target Level: "{level}" (beginner, intermediate, or advanced)
Emphasis/Focus: "{focus}" (concepts, projects, or interview)

Return ONLY a valid JSON object matching this exact schema:
{{
  "title": "Roadmap Title",
  "description": "2-3 sentence overview of this curriculum.",
  "topics": [
    {{
      "id": "t1",
      "title": "Foundational Concept 1",
      "description": "Clear explanation of what this topic covers and why it matters.",
      "depth": 1,
      "prerequisites": [],
      "keyConcepts": ["Concept A", "Concept B", "Concept C"],
      "estimatedHours": 2
    }},
    {{
      "id": "t2",
      "title": "Subsequent Concept",
      "description": "Explanation of this topic.",
      "depth": 2,
      "prerequisites": ["t1"],
      "keyConcepts": ["Concept D", "Concept E"],
      "estimatedHours": 3
    }}
  ]
}}

Requirements:
1. Output between 6 and 10 topics.
2. Root topics have depth=1 and prerequisites=[].
3. Sub-topics specify previous topic IDs in prerequisites.
4. Output strictly valid JSON. Do not include markdown or trailing commentary.
"""

    @staticmethod
    def _parse_plan_json(raw_text: str) -> Optional[RoadmapPlan]:
        clean = raw_text.strip()
        if clean.startswith("```"):
            clean = re.sub(r"^```(?:json)?", "", clean, flags=re.IGNORECASE)
            clean = re.sub(r"```$", "", clean).strip()

        match = re.search(r"\{.*\}", clean, re.DOTALL)
        if match:
            clean = match.group(0)

        try:
            data = json.loads(clean)
            title = data.get("title", "Custom Learning Roadmap")
            desc = data.get("description", "Structured learning progression.")
            raw_topics = data.get("topics", [])
            topics: List[RoadmapTopic] = []

            for idx, item in enumerate(raw_topics):
                tid = str(item.get("id") or f"t{idx+1}")
                ttitle = str(item.get("title") or f"Topic {idx+1}")
                tdesc = str(item.get("description") or "Core technical concept.")
                depth = int(item.get("depth") or 1)
                prereqs = [str(p) for p in item.get("prerequisites", [])]
                key_c = [str(k) for k in (item.get("keyConcepts") or item.get("key_concepts") or [])]
                hours = int(item.get("estimatedHours") or item.get("estimated_hours") or 2)
                topics.append(
                    RoadmapTopic(
                        id=tid,
                        title=ttitle,
                        description=tdesc,
                        depth=depth,
                        prerequisites=prereqs,
                        key_concepts=key_c,
                        estimated_hours=hours,
                    )
                )

            if len(topics) >= 1:
                return RoadmapPlan(title=title, description=desc, topics=topics)
        except Exception as e:
            logger.warning("Failed to parse LLM roadmap JSON", error=str(e), raw_snippet=raw_text[:200])

        return None

    @staticmethod
    def _generate_fallback_plan(goal: str, level: str, focus: str) -> RoadmapPlan:
        title = f"Roadmap: {goal.strip().title()}"
        desc = (
            f"A structured, step-by-step learning journey for {goal} tailored for "
            f"{level} learners with a focus on {focus}."
        )

        topics = [
            RoadmapTopic(
                id="t1",
                title="Foundations & Core Mental Models",
                description=f"Essential vocabulary, environment setup, and bedrock concepts of {goal}.",
                depth=1,
                prerequisites=[],
                key_concepts=["Syntax & Semantics", "Architecture Principles", "Development Setup"],
                estimated_hours=3,
            ),
            RoadmapTopic(
                id="t2",
                title="Data Structures & Flow of Control",
                description="Handling data representation, control structures, and standard idioms.",
                depth=2,
                prerequisites=["t1"],
                key_concepts=["Primitive Types", "Collections", "Branching & Loops"],
                estimated_hours=4,
            ),
            RoadmapTopic(
                id="t3",
                title="Core Modularity & Abstractions",
                description="Creating reusable components, interfaces, and modular software designs.",
                depth=2,
                prerequisites=["t1"],
                key_concepts=["Functions & Methods", "Composition", "Error Handling"],
                estimated_hours=4,
            ),
            RoadmapTopic(
                id="t4",
                title="State Management & Concurrency",
                description="Working with shared state, asynchronous operations, and lifecycle events.",
                depth=3,
                prerequisites=["t2", "t3"],
                key_concepts=["Async/Await", "Event Loops", "Resource Management"],
                estimated_hours=5,
            ),
            RoadmapTopic(
                id="t5",
                title="Testing, Debugging & Profiling",
                description="Verifying reliability, building automated test suites, and performance profiling.",
                depth=3,
                prerequisites=["t3"],
                key_concepts=["Unit Testing", "Observability", "Benchmarking"],
                estimated_hours=3,
            ),
            RoadmapTopic(
                id="t6",
                title="Real-World Projects & Architecture",
                description="Synthesizing concepts into production-grade applications and systems.",
                depth=4,
                prerequisites=["t4", "t5"],
                key_concepts=["System Design", "Production Readiness", "Integration Patterns"],
                estimated_hours=6,
            ),
        ]
        return RoadmapPlan(title=title, description=desc, topics=topics)

    @classmethod
    async def generate_roadmap(
        cls,
        session: AsyncSession,
        request: RoadmapGenerateRequest,
        owner_id: str = "usr_default_admin",
    ) -> RoadmapGenerateResponse:
        logger.info(
            "Generating learning roadmap",
            goal=request.goal,
            level=request.level,
            focus=request.focus,
            owner_id=owner_id,
        )

        resolved_provider = request.provider or settings.DEFAULT_PROVIDER
        resolved_model = request.model or settings.DEFAULT_MODEL
        plan: Optional[RoadmapPlan] = None

        # 1. Attempt LLM generation
        try:
            api_key = None
            if resolved_provider == "gemini":
                api_key = settings.GEMINI_API_KEY or settings.GOOGLE_API_KEY
            elif resolved_provider == "openai":
                api_key = settings.OPENAI_API_KEY
            elif resolved_provider == "anthropic":
                api_key = settings.ANTHROPIC_API_KEY

            base_url = settings.OLLAMA_BASE_URL if resolved_provider == "ollama" else None
            provider = get_provider(resolved_provider, api_key=api_key, base_url=base_url)

            prompt_text = cls._build_prompt(request.goal, request.level, request.focus)
            messages = [ChatMessage(role=ChatRole.USER, content=prompt_text)]
            config = ModelConfig(
                model_name=resolved_model,
                temperature=0.2,
                max_tokens=3500,
            )

            result = await provider.generate(messages=messages, config=config)
            plan = cls._parse_plan_json(result.content)
        except Exception as e:
            logger.warning(
                "LLM provider generation failed or unavailable; using fallback curriculum",
                provider=resolved_provider,
                error=str(e),
            )

        if not plan or not plan.topics:
            plan = cls._generate_fallback_plan(request.goal, request.level, request.focus)

        # 2. Persist Workspace
        ws_data = WorkspaceCreate(name=plan.title, description=plan.description)
        workspace = await WorkspaceService.create_workspace(session, ws_data, owner_id=owner_id)

        # 3. Create Root Node
        root_node_id = f"node_{uuid.uuid4().hex[:12]}"
        root_markdown = (
            f"# {plan.title}\n\n"
            f"{plan.description}\n\n"
            f"---\n\n"
            f"**Target Level:** `{request.level.capitalize()}` • "
            f"**Curriculum Focus:** `{request.focus.capitalize()}` • "
            f"**Total Modules:** `{len(plan.topics)} topics`\n\n"
            f"> 💡 **How to use this roadmap:** Click any topic node on the canvas to explore, "
            f"ask clarifying questions, take quick quizzes, or branch into deeper sub-topics."
        )

        root_node = NodeModel(
            id=root_node_id,
            workspace_id=workspace.id,
            parent_id=None,
            role="assistant",
            content=root_markdown,
            provider=resolved_provider,
            model=resolved_model,
            position_x=0.0,
            position_y=0.0,
            metadata_payload={
                "node_type": "roadmap_root",
                "title": plan.title,
                "goal": request.goal,
                "level": request.level,
                "focus": request.focus,
                "topic_count": len(plan.topics),
            },
        )
        session.add(root_node)
        await session.flush()

        # 4. Phase A: Materialize ALL Topic Nodes & Concepts first
        topic_to_node_id: Dict[str, str] = {}
        depth_counters: Dict[int, int] = {}
        topic_nodes: List[NodeModel] = []
        created_concepts: List[tuple[str, ConceptModel]] = []

        for topic in plan.topics:
            node_id = f"node_{uuid.uuid4().hex[:12]}"
            topic_to_node_id[topic.id] = node_id

        for topic in plan.topics:
            node_id = topic_to_node_id[topic.id]
            depth = max(1, topic.depth)
            y_idx = depth_counters.get(depth, 0)
            depth_counters[depth] = y_idx + 1

            pos_x = depth * 380.0
            pos_y = (y_idx - 1) * 220.0

            primary_parent_id: str = root_node_id
            if topic.prerequisites:
                for prereq_id in reversed(topic.prerequisites):
                    if prereq_id in topic_to_node_id:
                        primary_parent_id = topic_to_node_id[prereq_id]
                        break

            key_concepts_list = "\n".join([f"- **{kc}**" for kc in topic.key_concepts]) or "- Core principles"
            topic_markdown = (
                f"### {topic.title}\n\n"
                f"{topic.description}\n\n"
                f"#### Key Concepts\n"
                f"{key_concepts_list}\n\n"
                f"⏱️ **Estimated Effort:** ~{topic.estimated_hours or 2} hours"
            )

            topic_node = NodeModel(
                id=node_id,
                workspace_id=workspace.id,
                parent_id=primary_parent_id,
                role="assistant",
                content=topic_markdown,
                provider=resolved_provider,
                model=resolved_model,
                position_x=pos_x,
                position_y=pos_y,
                metadata_payload={
                    "node_type": "roadmap_topic",
                    "topic_id": topic.id,
                    "title": topic.title,
                    "depth": depth,
                    "prerequisites": topic.prerequisites,
                    "key_concepts": topic.key_concepts,
                    "estimated_hours": topic.estimated_hours,
                },
            )
            session.add(topic_node)
            topic_nodes.append(topic_node)

            concept = ConceptModel(
                workspace_id=workspace.id,
                name=topic.title,
                description=topic.description,
                mastery_level="unexplored",
                confidence_score=0.0,
                metadata_payload={
                    "depth": depth,
                    "key_concepts": topic.key_concepts,
                    "estimated_hours": topic.estimated_hours,
                },
            )
            session.add(concept)
            created_concepts.append((node_id, concept))

        # Flush all nodes and concepts so foreign key constraints on edges and node_concepts succeed
        await session.flush()

        # Link concepts to nodes
        for node_id, concept in created_concepts:
            await session.execute(
                node_concepts.insert().values(
                    node_id=node_id,
                    concept_id=concept.id,
                    created_at=_utc_now(),
                )
            )

        # 5. Phase B: Materialize Edges (Nodes are guaranteed to exist in DB)
        for topic in plan.topics:
            node_id = topic_to_node_id[topic.id]

            primary_parent_id = root_node_id
            if topic.prerequisites:
                for prereq_id in reversed(topic.prerequisites):
                    if prereq_id in topic_to_node_id:
                        primary_parent_id = topic_to_node_id[prereq_id]
                        break

            primary_edge = EdgeModel(
                id=f"{primary_parent_id}->{node_id}",
                workspace_id=workspace.id,
                source_id=primary_parent_id,
                target_id=node_id,
                relation_type="prerequisite",
            )
            session.add(primary_edge)

            if topic.prerequisites:
                for prereq_id in topic.prerequisites:
                    prereq_node_id = topic_to_node_id.get(prereq_id)
                    if prereq_node_id and prereq_node_id != primary_parent_id:
                        sec_edge_id = f"{prereq_node_id}->{node_id}"
                        sec_edge = EdgeModel(
                            id=sec_edge_id,
                            workspace_id=workspace.id,
                            source_id=prereq_node_id,
                            target_id=node_id,
                            relation_type="prerequisite",
                        )
                        session.add(sec_edge)

        await session.flush()
        logger.info(
            "Roadmap successfully materialized",
            workspace_id=workspace.id,
            root_node_id=root_node_id,
            topics_created=len(plan.topics),
        )

        return RoadmapGenerateResponse(
            workspace_id=workspace.id,
            root_node_id=root_node_id,
            topic_count=len(plan.topics),
            title=workspace.name,
            description=workspace.description,
        )
