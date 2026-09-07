import uuid
from typing import Optional, Tuple

import structlog
from schemas.mastery import ConceptCreate
from schemas.workspace import NodeCreate, WorkspaceCreate
from services.mastery_service import MasteryService
from services.workspace_service import WorkspaceService
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()


async def seed_demo_workspace(session: AsyncSession) -> Tuple[str, str]:
    """
    Creates the 'GraphMind Workspace' demo workspace with pre-populated multi-agent
    conversations, spatial branches, technical concepts, and mastery states.
    Returns (workspace_id, chat1_root_node_id).
    """
    logger.info("Seeding comprehensive multi-agent demo workspace...")

    # 1. Create the Workspace
    ws_data = WorkspaceCreate(
        name="GraphMind Workspace",
        description="Interactive showcase of Multi-Agent Workflows, Spatial Mind Maps, and Knowledge Evolution.",
    )
    workspace = await WorkspaceService.create_workspace(session, ws_data)
    ws_id = workspace.id

    # 2. Define Node Data Generator Helpers
    def gen_id() -> str:
        return str(uuid.uuid4())

    def create_node(
        id_val: str,
        parent_id: Optional[str],
        role: str,
        content: str,
        highlighted_context: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> NodeCreate:
        return NodeCreate(
            id=id_val,
            parent_id=parent_id,
            role=role,
            content=content,
            highlighted_context=highlighted_context,
            provider="system" if role == "assistant" else None,
            model="gemini-2.5-flash" if role == "assistant" else None,
            metadata=metadata or {},
        )

    # ---------------------------------------------------------
    # CHAT 1: Asynchronous Architecture & Concurrency
    # ---------------------------------------------------------
    c1_n1_id = gen_id()
    c1_n2_id = gen_id()
    c1_n3_id = gen_id()
    c1_n4_id = gen_id()
    c1_n5_id = gen_id()
    c1_n6_id = gen_id()

    # Root user message
    await WorkspaceService.add_node_and_edge(
        session,
        ws_id,
        create_node(
            c1_n1_id,
            None,
            "user",
            "How does asynchronous concurrency work in Python, and when should we use an Event Loop versus Thread Pools?",
        ),
    )

    # Assistant reply: Code Architect Skill Persona
    architect_reply = (
        "### Production Architecture: Python Concurrency Models\n\n"
        "Python offers two primary concurrency paradigms for network and compute operations:\n\n"
        "1. **Single-Threaded Cooperative Event Loop (`asyncio`)**:\n"
        "   - **Mechanism**: Non-blocking multiplexed I/O utilizing OS primitives (`epoll` on Linux, `kqueue` on macOS).\n"
        "   - **Memory Overhead**: Extremely lightweight (~2KB per coroutine stack frame).\n"
        "   - **Best For**: High-concurrency network services, database gateways, and real-time streaming.\n\n"
        "2. **Preemptive Thread Pool (`ThreadPoolExecutor`)**:\n"
        "   - **Mechanism**: Dedicated OS worker threads preemptively scheduled by the kernel.\n"
        "   - **Constraint**: Constrained by CPython's Global Interpreter Lock (GIL) for CPU-bound bytecodes.\n"
        "   - **Best For**: Wrapping legacy blocking SDKs, disk file operations, or cryptographic computations.\n\n"
        "```python\n"
        "import asyncio\n"
        "from typing import List\n\n"
        "async def fetch_knowledge_node(node_id: str, sem: asyncio.Semaphore) -> str:\n"
        "    async with sem:\n"
        "        await asyncio.sleep(0.05)  # Non-blocking async I/O\n"
        "        return f'Node {node_id} loaded'\n\n"
        "async def gather_nodes(node_ids: List[str]) -> List[str]:\n"
        "    sem = asyncio.Semaphore(10)  # Bound concurrency limit\n"
        "    tasks = [fetch_knowledge_node(nid, sem) for nid in node_ids]\n"
        "    return await asyncio.gather(*tasks)\n"
        "```\n\n"
        "**Architectural Recommendation**: Use `asyncio` across the main API edge, and offload CPU-heavy vector operations or blocking filesystem writes to an executor."
    )
    await WorkspaceService.add_node_and_edge(
        session,
        ws_id,
        create_node(
            c1_n2_id,
            c1_n1_id,
            "assistant",
            architect_reply,
            metadata={"skill": "code_architect", "agent_role": "Code Architect"},
        ),
    )

    # Branch A: Deep Research on Event Loops vs Thread Pools
    await WorkspaceService.add_node_and_edge(
        session,
        ws_id,
        create_node(
            c1_n3_id,
            c1_n2_id,
            "user",
            "What does the empirical benchmark research say regarding memory and context switching overhead?",
            highlighted_context="Event Loop versus Thread Pools",
        ),
    )

    research_reply = (
        "### Deep Research Synthesis: Event Loop vs Thread Pool Benchmarks\n\n"
        "Synthesizing recent benchmark literature and operating system metrics:\n\n"
        "| Metric | Coroutine Event Loop (`asyncio`) | OS Thread Pool (`ThreadPoolExecutor`) |\n"
        "| :--- | :--- | :--- |\n"
        "| **Memory per Unit** | ~2 KB – 4 KB (Coroutine frame) | 1 MB – 8 MB (Thread stack reserved) |\n"
        "| **Context Switch Time** | ~20 ns – 50 ns (User-space jump) | ~1.2 µs – 2.5 µs (Kernel context switch) |\n"
        "| **Throughput (10k Conns)** | ~45,000 req/sec | OOM or severe kernel thrashing |\n"
        "| **Failure Isolation** | Exception in task cancels subtree | Uncaught fatal thread error crashes process |\n\n"
        "**Key Findings & Citations**:\n"
        "1. *Memory Footprint*: Allocating 10,000 active concurrent connections requires **~40 MB** using asyncio vs **~10 GB** using native threads.\n"
        "2. *Cache Locality*: Single-threaded coroutine switches preserve L1/L2 CPU cache lines, avoiding costly TLB flushes.\n"
        "3. *Reference*: *High-Performance Python Concurrency & Asyncio Internals (PEP 3156, PEP 492).*"
    )
    await WorkspaceService.add_node_and_edge(
        session,
        ws_id,
        create_node(
            c1_n4_id,
            c1_n3_id,
            "assistant",
            research_reply,
            metadata={"skill": "deep_research", "agent_role": "Deep Research"},
        ),
    )

    # Branch B: Asyncio Tasks Semaphore Patterns
    await WorkspaceService.add_node_and_edge(
        session,
        ws_id,
        create_node(
            c1_n5_id,
            c1_n2_id,
            "user",
            "Can we explore Semaphore limits and exception handling in asyncio tasks?",
            highlighted_context="Asyncio Tasks",
        ),
    )
    await WorkspaceService.add_node_and_edge(
        session,
        ws_id,
        create_node(
            c1_n6_id,
            c1_n5_id,
            "assistant",
            "Using `asyncio.Semaphore` bounds concurrent resource consumption (e.g. database connection pools). "
            "Pairing with `asyncio.as_completed` or `return_exceptions=True` in `asyncio.gather` ensures a single failed request "
            "does not abort sibling concurrent coroutines.",
        ),
    )

    # ---------------------------------------------------------
    # CHAT 2: Quiz Master Evaluation & Mastery Feedback
    # ---------------------------------------------------------
    c2_n1_id = gen_id()
    c2_n2_id = gen_id()
    c2_n3_id = gen_id()
    c2_n4_id = gen_id()

    # Root user message
    await WorkspaceService.add_node_and_edge(
        session,
        ws_id,
        create_node(
            c2_n1_id,
            None,
            "user",
            "Quiz me on Python concurrency, event loops, and asynchronous task scheduling.",
        ),
    )

    # Assistant reply: Quiz Master Skill Persona
    quiz_reply = (
        "### Quiz Master Knowledge Check: Python Asynchronous Systems\n\n"
        "Let's evaluate your understanding of the concurrency concepts explored in this workspace.\n\n"
        "#### Question 1\n"
        "What happens if you execute a blocking synchronous function (like `time.sleep(5)`) inside a Python coroutine?\n"
        "- **A)** Only that specific coroutine pauses; other coroutines continue uninterrupted.\n"
        "- **B)** The entire OS process event loop blocks for 5 seconds, freezing all concurrent tasks.\n"
        "- **C)** Python automatically spawns a background thread to handle the blocking call.\n"
        "- **D)** An `AsyncioBlockException` is thrown by the runtime.\n\n"
        "#### Question 2\n"
        "Why is `asyncio.Semaphore(10)` preferred over launching unbounded `asyncio.create_task` calls against a downstream database?\n"
        "- **A)** It prevents connection exhaustion and server-side socket starvation.\n"
        "- **B)** It executes the coroutines in strict priority order.\n"
        "- **C)** It bypasses CPython's Global Interpreter Lock.\n\n"
        "*Type your answers below to verify your mastery and update your knowledge profile!*"
    )
    await WorkspaceService.add_node_and_edge(
        session,
        ws_id,
        create_node(
            c2_n2_id,
            c2_n1_id,
            "assistant",
            quiz_reply,
            metadata={"skill": "quiz_master", "agent_role": "Quiz Master"},
        ),
    )

    # User response to quiz
    await WorkspaceService.add_node_and_edge(
        session,
        ws_id,
        create_node(
            c2_n3_id,
            c2_n2_id,
            "user",
            "1: B (The entire event loop blocks because it's single-threaded)\n2: A (Prevents connection exhaustion)",
        ),
    )

    # Quiz Master evaluation and mastery confirmation
    quiz_eval = (
        "### Perfect Score! 100% Mastery Confirmed 🎯\n\n"
        "- **Q1: Correct (B)** — Because `asyncio` runs cooperatively in a single thread, any un-yielded CPU-blocking operation freezes the entire loop.\n"
        "- **Q2: Correct (A)** — Semaphores enforce backpressure, protecting backend connection pools.\n\n"
        "**Mastery State Updated**: `Event Loops` and `Asyncio Tasks` have reached **Mastered (≥80%)** status in your knowledge profile! Check the Heatmap overlay to view your progress."
    )
    await WorkspaceService.add_node_and_edge(
        session,
        ws_id,
        create_node(
            c2_n4_id,
            c2_n3_id,
            "assistant",
            quiz_eval,
            metadata={"skill": "quiz_master", "agent_role": "Quiz Master"},
        ),
    )

    # ---------------------------------------------------------
    # 3. Pre-Populate Technical Concepts & Mastery Profiles
    # ---------------------------------------------------------
    demo_concepts = [
        ConceptCreate(
            name="Event Loops",
            description="Core asynchronous concurrency primitive dispatching coroutines and polling non-blocking I/O.",
            mastery_level="mastered",
            confidence_score=0.95,
            times_quizzed=3,
            times_correct=3,
            node_ids=[c1_n2_id, c1_n4_id, c2_n2_id],
        ),
        ConceptCreate(
            name="Asyncio Tasks",
            description="Schedules coroutines concurrently on the event loop with cancellation and exception handling.",
            mastery_level="mastered",
            confidence_score=0.90,
            times_quizzed=2,
            times_correct=2,
            node_ids=[c1_n4_id, c1_n6_id, c2_n4_id],
        ),
        ConceptCreate(
            name="Thread Pools",
            description="Executes blocking synchronous operations in a dedicated pool of OS worker threads.",
            mastery_level="quizzed",
            confidence_score=0.72,
            times_quizzed=2,
            times_correct=1,
            node_ids=[c1_n6_id],
        ),
        ConceptCreate(
            name="Vector Embeddings",
            description="High-dimensional dense mathematical representations of text capturing semantic similarity.",
            mastery_level="explored",
            confidence_score=0.45,
            times_quizzed=0,
            times_correct=0,
            node_ids=[c1_n2_id],
        ),
        ConceptCreate(
            name="HNSW Graphs",
            description="Hierarchical Navigable Small World graphs for sub-linear approximate nearest neighbor vector search.",
            mastery_level="explored",
            confidence_score=0.35,
            times_quizzed=0,
            times_correct=0,
            node_ids=[c1_n4_id],
        ),
        ConceptCreate(
            name="GIL (Global Interpreter Lock)",
            description="CPython mutex ensuring thread-safe bytecode execution across OS threads.",
            mastery_level="stale",
            confidence_score=0.55,
            times_quizzed=1,
            times_correct=1,
            node_ids=[c1_n2_id],
        ),
    ]

    for concept in demo_concepts:
        await MasteryService.create_or_get_concept(session, ws_id, concept)

    logger.info(f"Demo workspace seeded successfully with Phase 6 multi-agent knowledge state. ID: {ws_id}")
    return str(ws_id), str(c1_n1_id)
