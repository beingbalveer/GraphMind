from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set

import structlog
from models.workspace import ConceptModel, Workspace
from schemas.curator import (
    GapAnalysisResponse,
    KnowledgeGap,
    KnowledgeGapSeverity,
    KnowledgeGapStatus,
)
from schemas.mastery import ConceptCreate, ConceptResponse
from services.mastery_service import DEFAULT_STALENESS_DAYS, MasteryService
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

logger = structlog.get_logger()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class DomainConcept:
    id: str
    name: str
    domain: str
    prerequisites: List[str] = field(default_factory=list)
    aliases: List[str] = field(default_factory=list)
    importance: str = "core"  # foundational, core, specialized
    description: str = ""
    rationale_template: Optional[str] = None


# Canonical Domain Dependency Graph (Ontology DAG)
DOMAIN_CONCEPTS_CATALOG: List[DomainConcept] = [
    # ─── Python & Concurrency ───────────────────────────────────────────
    DomainConcept(
        id="python:iterators_generators",
        name="Generators & Iterators",
        domain="Python Concurrency",
        prerequisites=[],
        aliases=["generator", "iterators", "yield", "generator function", "iter"],
        importance="foundational",
        description="Lazy evaluation, iterator protocol, and stateful iteration with yield.",
    ),
    DomainConcept(
        id="python:coroutines",
        name="Coroutines & Tasks",
        domain="Python Concurrency",
        prerequisites=["python:iterators_generators"],
        aliases=["coroutine", "async def", "awaitable", "coroutines", "task"],
        importance="foundational",
        description="Cooperative multitasking primitives and suspendable execution frames using async/await.",
    ),
    DomainConcept(
        id="python:event_loop",
        name="Event Loops & Task Schedulers",
        domain="Python Concurrency",
        prerequisites=["python:coroutines"],
        aliases=["event loop", "eventloop", "uvloop", "asyncio.run", "asyncio loop", "event loops"],
        importance="foundational",
        description="Central single-threaded event loop scheduling non-blocking I/O callbacks and managing task execution.",
        rationale_template="Understanding the Event Loop is essential for managing Asyncio task scheduling, non-blocking I/O, and avoiding event loop starvation.",
    ),
    DomainConcept(
        id="python:asyncio",
        name="Asyncio High-Level APIs",
        domain="Python Concurrency",
        prerequisites=["python:event_loop"],
        aliases=["asyncio", "asyncio.gather", "asyncio.create_task", "asyncio queue", "asyncio tasks"],
        importance="core",
        description="High-level asynchronous concurrency APIs for managing network connections, futures, and queues.",
        rationale_template="Prerequisite for writing resilient non-blocking network code, background tasks, and async web handlers.",
    ),
    DomainConcept(
        id="python:gil_thread_safety",
        name="Global Interpreter Lock (GIL) & Thread Safety",
        domain="Python Concurrency",
        prerequisites=[],
        aliases=["gil", "global interpreter lock", "thread safety", "race condition", "threading lock"],
        importance="core",
        description="CPython mutex mechanism constraining execution to one native thread per process at a time.",
    ),
    DomainConcept(
        id="python:multiprocessing",
        name="Multiprocessing & Process Pools",
        domain="Python Concurrency",
        prerequisites=["python:gil_thread_safety"],
        aliases=["multiprocessing", "processpoolexecutor", "cpu-bound parallelism", "worker processes"],
        importance="core",
        description="Bypassing the GIL for CPU-bound parallelism using isolated worker processes with IPC.",
        rationale_template="Required to understand when to switch from Asyncio (I/O-bound) to Multiprocessing (CPU-bound) execution.",
    ),
    DomainConcept(
        id="python:fastapi_concurrency",
        name="FastAPI Async Handlers & WebSockets",
        domain="Python Concurrency",
        prerequisites=["python:asyncio", "python:event_loop"],
        aliases=["fastapi websocket", "fastapi async", "fastapi background tasks", "async endpoint", "fastapi concurrency"],
        importance="specialized",
        description="Asynchronous route handling, dependency injection lifecycles, and bidirectional WebSocket streams in FastAPI.",
        rationale_template="FastAPI async routes execute directly on the main event loop; understanding non-blocking I/O is crucial to avoid locking the web worker.",
    ),
    # ─── Database Engineering & Persistence ────────────────────────────
    DomainConcept(
        id="db:relational_modeling",
        name="Relational Schemas & Foreign Keys",
        domain="Database Engineering",
        prerequisites=[],
        aliases=["relational schema", "foreign key", "normalization", "erd", "table relations", "primary key"],
        importance="foundational",
        description="Relational data integrity, schema normalization, and primary/foreign key cascading rules.",
    ),
    DomainConcept(
        id="db:acid_transactions",
        name="ACID Transactions & Isolation Levels",
        domain="Database Engineering",
        prerequisites=["db:relational_modeling"],
        aliases=["acid", "transaction", "isolation level", "read committed", "serializable", "mvcc", "transactions"],
        importance="foundational",
        description="Atomicity, Consistency, Isolation, and Durability guarantees and concurrency phenomena (dirty reads, phantom reads).",
        rationale_template="Prerequisite for preventing data corruption, race conditions, and phantom reads in high-concurrency systems.",
    ),
    DomainConcept(
        id="db:connection_pooling",
        name="Connection Pooling & Pool Sizing",
        domain="Database Engineering",
        prerequisites=["db:acid_transactions"],
        aliases=["connection pool", "connection pooling", "pool size", "max overflow", "pgbouncer", "pool_size"],
        importance="core",
        description="Managing reusable database socket pools to prevent connection exhaustion and reduce handshake latency.",
        rationale_template="Crucial for sizing database connections in async services and avoiding connection exhaustion under load spikes.",
    ),
    DomainConcept(
        id="db:sql_indexes_btrees",
        name="B-Tree Indexes & Query Execution Plans",
        domain="Database Engineering",
        prerequisites=["db:relational_modeling"],
        aliases=["b-tree", "sql index", "explain analyze", "index scan", "composite index", "indexes", "btree"],
        importance="core",
        description="Balanced-tree storage layout, index selectivity, and analyzing EXPLAIN plans for fast query lookups.",
        rationale_template="Prerequisite for diagnosing slow queries, avoiding sequential table scans, and optimizing data retrieval.",
    ),
    DomainConcept(
        id="db:sqlalchemy_async",
        name="SQLAlchemy Async Engine & Sessions",
        domain="Database Engineering",
        prerequisites=["db:connection_pooling", "db:acid_transactions", "python:asyncio"],
        aliases=["sqlalchemy async", "asyncpg", "asyncsession", "sqlalchemy orm", "sqlalchemy", "async engine"],
        importance="core",
        description="Asynchronous ORM unit of work, connection lifecycle, and non-blocking query streaming in Python.",
        rationale_template="Combines database connection pooling and asyncio event loops to manage async database transactions cleanly.",
    ),
    DomainConcept(
        id="db:alembic_migrations",
        name="Schema Migrations with Alembic",
        domain="Database Engineering",
        prerequisites=["db:sqlalchemy_async"],
        aliases=["alembic", "migration", "revision", "schema migration", "alembic migrations"],
        importance="core",
        description="Declarative schema version control, automated migration generation, and rolling deployment safety.",
    ),
    # ─── Vector Search & AI Systems ────────────────────────────────────
    DomainConcept(
        id="ai:dense_embeddings",
        name="Vector Embeddings & Dense Representations",
        domain="AI & Vector Systems",
        prerequisites=[],
        aliases=["embeddings", "dense vectors", "text-embedding", "sentence-transformers", "embedding model", "vector embeddings"],
        importance="foundational",
        description="Transforming textual and multimodal semantics into dense numerical coordinates in high-dimensional vector space.",
    ),
    DomainConcept(
        id="ai:distance_metrics",
        name="Vector Distance Metrics (Cosine, Dot Product)",
        domain="AI & Vector Systems",
        prerequisites=["ai:dense_embeddings"],
        aliases=["cosine similarity", "cosine distance", "dot product", "l2 distance", "euclidean distance", "vector distance"],
        importance="foundational",
        description="Mathematical geometric formulations for measuring semantic orientation and proximity between vector vectors.",
        rationale_template="Essential for properly scoring and thresholding semantic relevance in retrieval systems.",
    ),
    DomainConcept(
        id="ai:ann_indexing_hnsw",
        name="Approximate Nearest Neighbors & HNSW Indexing",
        domain="AI & Vector Systems",
        prerequisites=["ai:distance_metrics"],
        aliases=["hnsw", "ivfflat", "ann index", "vector index", "pgvector hnsw", "ann search"],
        importance="core",
        description="Hierarchical Navigable Small World graph indexes for sub-linear time similarity search over large vector databases.",
        rationale_template="Without ANN/HNSW indexing, vector searches degrade into linear $O(N)$ full table scans that choke under large datasets.",
    ),
    DomainConcept(
        id="ai:hybrid_search_rrf",
        name="Hybrid Search & Reciprocal Rank Fusion (RRF)",
        domain="AI & Vector Systems",
        prerequisites=["ai:ann_indexing_hnsw", "db:sql_indexes_btrees"],
        aliases=["hybrid search", "rrf", "reciprocal rank fusion", "full-text search vector", "bm25 vector"],
        importance="core",
        description="Fusing keyword BM25/tsvector exact matching with dense vector semantic search using rank-based weighting.",
        rationale_template="Solves dense embedding blindspots (e.g. acronyms, exact IDs, specific symbols) by combining lexical and semantic signals.",
    ),
    DomainConcept(
        id="ai:rag_pipelines",
        name="Retrieval-Augmented Generation (RAG) Architecture",
        domain="AI & Vector Systems",
        prerequisites=["ai:hybrid_search_rrf", "ai:dense_embeddings"],
        aliases=["rag", "retrieval augmented generation", "context grounding", "chunking", "rag pipeline"],
        importance="specialized",
        description="Grounding LLM inference with dynamic contextual chunk retrieval, citations, and hallucination reduction.",
        rationale_template="Requires solid understanding of chunking strategies, dense embeddings, and retrieval ranking for reliable grounding.",
    ),
    # ─── Distributed Systems & Web Architecture ────────────────────────
    DomainConcept(
        id="web:http_lifecycle",
        name="HTTP Protocol Lifecycle & Status Codes",
        domain="Distributed Systems & Web Architecture",
        prerequisites=[],
        aliases=["http protocol", "http status", "request response cycle", "http/1.1", "http headers", "http"],
        importance="foundational",
        description="Client-server request/response mechanics, stateless headers, caching controls, and status codes.",
    ),
    DomainConcept(
        id="web:websockets_protocol",
        name="WebSockets Protocol & Bidirectional Streaming",
        domain="Distributed Systems & Web Architecture",
        prerequisites=["web:http_lifecycle"],
        aliases=["websocket", "websocket handshake", "bidirectional streaming", "ws protocol", "websockets"],
        importance="core",
        description="Persistent full-duplex TCP connections upgraded from HTTP for real-time messaging and streaming.",
        rationale_template="Prerequisite for building low-latency live streaming, collaborative whiteboards, and instant push notifications.",
    ),
    DomainConcept(
        id="web:asgi_architecture",
        name="ASGI Specification & Lifespan Protocol",
        domain="Distributed Systems & Web Architecture",
        prerequisites=["web:http_lifecycle", "python:asyncio"],
        aliases=["asgi", "uvicorn", "lifespan", "asgi middleware", "asgi server"],
        importance="core",
        description="Standard interface between async Python web servers (Uvicorn) and applications (FastAPI/Starlette).",
        rationale_template="Understanding ASGI is required to write robust server middleware, connection handlers, and startup/shutdown lifespans.",
    ),
    DomainConcept(
        id="web:jwt_stateless_auth",
        name="JWT & Stateless Token Authentication",
        domain="Distributed Systems & Web Architecture",
        prerequisites=["web:http_lifecycle"],
        aliases=["jwt", "json web token", "stateless auth", "bearer token", "jwt auth"],
        importance="core",
        description="Digitally signed claims (HMAC/RSA) for distributed stateless authentication and identity verification.",
    ),
    DomainConcept(
        id="web:oauth2_oidc",
        name="OAuth2 & OpenID Connect (OIDC)",
        domain="Distributed Systems & Web Architecture",
        prerequisites=["web:jwt_stateless_auth"],
        aliases=["oauth2", "oidc", "openid connect", "authorization code", "pkce", "oauth"],
        importance="specialized",
        description="Industry standard authorization protocol and identity layer for delegated third-party access.",
        rationale_template="Prerequisite for secure enterprise single sign-on (SSO) and API delegation without sharing user credentials.",
    ),
    # ─── Modern Frontend & React Architecture ───────────────────────────
    DomainConcept(
        id="frontend:virtual_dom_lifecycle",
        name="Component Lifecycle & Virtual DOM",
        domain="Modern Frontend Architecture",
        prerequisites=[],
        aliases=["virtual dom", "reconciliation", "component lifecycle", "fiber tree", "react dom"],
        importance="foundational",
        description="Declarative virtual node tree diffing, reconciliation algorithms, and browser DOM patch operations.",
    ),
    DomainConcept(
        id="frontend:react_hooks",
        name="React Hooks (State & Effects Lifecycle)",
        domain="Modern Frontend Architecture",
        prerequisites=["frontend:virtual_dom_lifecycle"],
        aliases=["react hooks", "useeffect", "usecallback", "usememo", "usestate", "hooks"],
        importance="core",
        description="Managing reactive component state, side effects, dependency arrays, and closures in modern React.",
        rationale_template="Essential for avoiding stale closures, infinite re-render loops, and memory leaks in React components.",
    ),
    DomainConcept(
        id="frontend:streaming_ssr",
        name="Streaming SSR & React Suspense",
        domain="Modern Frontend Architecture",
        prerequisites=["frontend:react_hooks"],
        aliases=["streaming ssr", "suspense", "server-side rendering", "selective hydration", "ssr"],
        importance="core",
        description="Progressive HTML stream delivery over HTTP and selective client hydration using React Suspense boundaries.",
        rationale_template="Crucial for high performance Web Vitals (LCP, TTFB) and non-blocking initial page renders.",
    ),
    DomainConcept(
        id="frontend:react_server_components",
        name="React Server Components (RSC)",
        domain="Modern Frontend Architecture",
        prerequisites=["frontend:streaming_ssr", "frontend:react_hooks"],
        aliases=["rsc", "react server components", "next.js app router", "server actions", "server component"],
        importance="specialized",
        description="Zero-client-bundle server-only components executing exclusively during build or request time.",
        rationale_template="Understanding the boundary between Client and Server Components is required to architect modern Next.js applications.",
    ),
]


class CuratorService:
    """
    The Knowledge Curator service: analyzes knowledge graph topology,
    traverses domain dependency graphs, detects skipped prerequisites,
    and produces actionable learning recommendations.
    """

    _catalog_by_id: Dict[str, DomainConcept] = {c.id: c for c in DOMAIN_CONCEPTS_CATALOG}

    @classmethod
    def get_domain_graph(cls) -> Dict[str, DomainConcept]:
        return cls._catalog_by_id

    @classmethod
    def find_matching_domain_concept(cls, concept_name: str) -> Optional[DomainConcept]:
        """
        Fuzzy/alias matching of user concept name against canonical domain ontology.
        """
        clean_name = concept_name.strip().lower()
        if not clean_name:
            return None

        # 1. Exact canonical name match
        for dc in cls._catalog_by_id.values():
            if dc.name.lower() == clean_name:
                return dc

        # 2. Exact alias match
        for dc in cls._catalog_by_id.values():
            for alias in dc.aliases:
                if alias.lower() == clean_name:
                    return dc

        # 3. Substring alias match (e.g. "python asyncio tasks" contains "asyncio")
        for dc in cls._catalog_by_id.values():
            for alias in dc.aliases:
                if len(alias) >= 4 and (alias in clean_name or clean_name in alias):
                    return dc

        return None

    @classmethod
    async def analyze_workspace_gaps(
        cls,
        db: AsyncSession,
        workspace_id: str,
        staleness_days: int = DEFAULT_STALENESS_DAYS,
    ) -> GapAnalysisResponse:
        """
        Compares explored concepts in a workspace against domain dependency graphs.
        Identifies missing, unexplored, stale, or weak prerequisites, computes
        impact severity, and formulates educational rationales.
        """
        # Verify workspace exists
        ws_stmt = select(Workspace).where(Workspace.id == workspace_id)
        ws_res = await db.execute(ws_stmt)
        if not ws_res.scalar_one_or_none():
            raise ValueError(f"Workspace '{workspace_id}' not found")

        # Load all workspace concepts
        concepts_stmt = (
            select(ConceptModel)
            .options(selectinload(ConceptModel.nodes))
            .where(ConceptModel.workspace_id == workspace_id)
        )
        concepts_res = await db.execute(concepts_stmt)
        workspace_concepts = list(concepts_res.scalars().all())

        now = _utc_now()

        # Map workspace concepts by matched domain concept ID
        user_domain_matches: Dict[str, List[ConceptModel]] = {}
        for c in workspace_concepts:
            dc = cls.find_matching_domain_concept(c.name)
            if dc:
                user_domain_matches.setdefault(dc.id, []).append(c)

        # Identify Active / Explored domain concepts
        active_domain_ids: Set[str] = set()
        explored_domains: Set[str] = set()

        for dc_id, matching_concepts in user_domain_matches.items():
            # A domain concept is considered explored/active if user has marked it
            # explored/quizzed/mastered or interacted with confidence/quizzes
            for c in matching_concepts:
                if c.mastery_level in ("explored", "quizzed", "mastered") or c.confidence_score > 0.0 or c.times_quizzed > 0:
                    active_domain_ids.add(dc_id)
                    dc = cls._catalog_by_id.get(dc_id)
                    if dc:
                        explored_domains.add(dc.domain)
                    break

        # Traversal: For each active concept, check its upstream prerequisites
        # gap_id -> dict with gap metadata and set of dependent user concepts
        gaps_map: Dict[str, Dict] = {}

        for active_id in active_domain_ids:
            active_dc = cls._catalog_by_id.get(active_id)
            if not active_dc:
                continue

            for prereq_id in active_dc.prerequisites:
                prereq_dc = cls._catalog_by_id.get(prereq_id)
                if not prereq_dc:
                    continue

                # Inspect if user has covered the prerequisite
                matching_prereq_concepts = user_domain_matches.get(prereq_id, [])

                gap_status: Optional[KnowledgeGapStatus] = None
                severity: KnowledgeGapSeverity = "medium"

                if not matching_prereq_concepts:
                    # Prerequisite completely missing from workspace
                    gap_status = "missing"
                    severity = "high"
                else:
                    # Check mastery states across matching concepts
                    best_concept = max(matching_prereq_concepts, key=lambda x: x.confidence_score)
                    is_stale = (
                        best_concept.last_reviewed_at is not None
                        and (now - best_concept.last_reviewed_at).days >= staleness_days
                        and best_concept.mastery_level in ("mastered", "quizzed", "explored")
                    )

                    if best_concept.mastery_level == "unexplored":
                        gap_status = "unexplored"
                        severity = "high"
                    elif is_stale:
                        gap_status = "stale"
                        severity = "medium"
                    elif best_concept.confidence_score < 0.4:
                        gap_status = "weak_retention"
                        severity = "medium"

                if gap_status:
                    if prereq_id not in gaps_map:
                        gaps_map[prereq_id] = {
                            "dc": prereq_dc,
                            "status": gap_status,
                            "severity": severity,
                            "dependents": set(),
                        }
                    else:
                        # Upgrade severity if missing
                        if severity == "high":
                            gaps_map[prereq_id]["severity"] = "high"
                            gaps_map[prereq_id]["status"] = gap_status

                    gaps_map[prereq_id]["dependents"].add(active_dc.name)

        # Build KnowledgeGap schema instances
        gap_items: List[KnowledgeGap] = []
        for gap_id, gap_data in gaps_map.items():
            dc: DomainConcept = gap_data["dc"]
            dependents: List[str] = sorted(list(gap_data["dependents"]))
            status: KnowledgeGapStatus = gap_data["status"]
            severity: KnowledgeGapSeverity = gap_data["severity"]

            # Formulate clear rationale
            dep_str = ", ".join(f"'{d}'" for d in dependents)
            if dc.rationale_template:
                rationale = dc.rationale_template
            else:
                rationale = (
                    f"You have explored {dep_str}, but have not yet mastered the prerequisite "
                    f"'{dc.name}'. This concept provides foundational knowledge: {dc.description}"
                )

            # Formulate suggested action
            if status == "missing":
                suggested_action = f"Explore fundamentals of {dc.name} to ground downstream concepts."
            elif status == "unexplored":
                suggested_action = f"Study {dc.name} in your workspace branch to bridge this gap."
            elif status == "stale":
                suggested_action = f"Review and refresh retention of {dc.name}."
            else:
                suggested_action = f"Take a practice quiz on {dc.name} to boost confidence score."

            gap_items.append(
                KnowledgeGap(
                    id=dc.id,
                    concept_name=dc.name,
                    domain=dc.domain,
                    severity=severity,
                    status=status,
                    dependent_concepts=dependents,
                    rationale=rationale,
                    suggested_action=suggested_action,
                    foundational_importance=dc.importance,
                    prerequisite_ids=dc.prerequisites,
                )
            )

        # Sort gaps: High severity first, then by number of dependent concepts descending, then name
        severity_weight = {"high": 0, "medium": 1, "low": 2}
        gap_items.sort(
            key=lambda g: (
                severity_weight.get(g.severity, 3),
                -len(g.dependent_concepts),
                0 if g.foundational_importance == "foundational" else 1,
                g.concept_name,
            )
        )

        high_count = sum(1 for g in gap_items if g.severity == "high")
        med_count = sum(1 for g in gap_items if g.severity == "medium")

        logger.info(
            "Analyzed workspace knowledge gaps",
            workspace_id=workspace_id,
            total_gaps=len(gap_items),
            high_severity=high_count,
        )

        return GapAnalysisResponse(
            workspace_id=workspace_id,
            analyzed_at=_utc_now(),
            total_gaps=len(gap_items),
            high_severity_count=high_count,
            medium_severity_count=med_count,
            gaps=gap_items,
            explored_domains=sorted(list(explored_domains)),
        )

    @classmethod
    async def adopt_gap_concept(
        cls,
        db: AsyncSession,
        workspace_id: str,
        gap_id: str,
        initial_mastery_level: str = "unexplored",
    ) -> ConceptResponse:
        """
        Instantiates a recommended knowledge gap directly as a tracked concept in the workspace.
        """
        dc = cls._catalog_by_id.get(gap_id)
        if not dc:
            raise ValueError(f"Unknown domain concept '{gap_id}'")

        create_data = ConceptCreate(
            name=dc.name,
            description=dc.description,
            mastery_level=initial_mastery_level,
            confidence_score=0.0,
            metadata={
                "domain": dc.domain,
                "domain_concept_id": dc.id,
                "importance": dc.importance,
                "prerequisites": dc.prerequisites,
                "source": "knowledge_curator",
            },
        )

        return await MasteryService.create_or_get_concept(db, workspace_id=workspace_id, data=create_data)
