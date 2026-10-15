from dataclasses import dataclass
from typing import Literal

from schemas.curriculum import PracticeActivityData


@dataclass(frozen=True)
class CatalogActivity:
    prompt: str
    kind: Literal["choice", "short_answer", "reflection"]
    choices: list[str] | None = None
    correct_choice: str | None = None
    explanation: str = ""
    hint: str = ""
    version: str = "1.0"


SEEDED_ACTIVITIES: dict[str, CatalogActivity] = {
    "py-01": CatalogActivity(
        kind="choice",
        prompt='What does normalize_email("  Ada@Example.com ") return?',
        choices=["Ada@Example.com", "ada@example.com", "An error because spaces are present"],
        correct_choice="ada@example.com",
        explanation="strip() removes the surrounding spaces, then lower() converts the address to lowercase.",
        hint="Apply strip before lower.",
    ),
    "py-02": CatalogActivity(
        kind="choice",
        prompt="Which layer should reject a request payload whose email is malformed?",
        choices=[
            "The runtime type hint alone",
            "The request validation boundary",
            "A database log statement",
        ],
        correct_choice="The request validation boundary",
        explanation="Type hints aid static analysis, while a Pydantic model validates untrusted runtime input at the boundary.",
        hint="Ask which part runs when incoming JSON is parsed.",
    ),
    "py-03": CatalogActivity(
        kind="choice",
        prompt="A GET /items/42 lookup finds no item. Which response best communicates the result?",
        choices=["200 with an empty success object", "404 Not Found", "500 Internal Server Error"],
        correct_choice="404 Not Found",
        explanation="A missing requested resource is a not-found result. A server error should describe an unexpected failure.",
        hint="Separate a missing resource from a server defect.",
    ),
    "py-04": CatalogActivity(
        kind="short_answer",
        prompt="Give one normal input/output assertion and one edge case for normalize_email. Include the expected output for each.",
        explanation="A useful test names an expected behavior and an edge case. For example, assert normalization of a mixed-case address and assert whitespace-only input becomes an empty string.",
        hint="Include an assertion for a normal address and mention the whitespace-only result.",
    ),
    "py-05": CatalogActivity(
        kind="choice",
        prompt="You need to test membership among many unique IDs. Which collection most directly expresses that intent?",
        choices=["A list", "A set", "A tuple"],
        correct_choice="A set",
        explanation="A set represents unique members and is designed for membership checks.",
        hint="Which collection guarantees unique members?",
    ),
    "py-06": CatalogActivity(
        kind="choice",
        prompt="When is a comprehension a good choice?",
        choices=[
            "A short, clear transformation with simple filtering",
            "A transformation with nested side effects",
            "Any time a loop exists",
        ],
        correct_choice="A short, clear transformation with simple filtering",
        explanation="Comprehensions are clearest for compact transformations. Complex branching and side effects are easier to follow in a loop.",
        hint="Prefer the option that makes the output easy to scan.",
    ),
    "py-07": CatalogActivity(
        kind="choice",
        prompt="A string-to-integer conversion can raise ValueError. What is the safest handling?",
        choices=[
            "Catch ValueError around the conversion and translate it clearly",
            "Catch every exception and return 0",
            "Ignore all errors",
        ],
        correct_choice="Catch ValueError around the conversion and translate it clearly",
        explanation="Catch the expected exception in a narrow block and preserve a useful, stable message. Broad suppression can hide defects.",
        hint="Keep the catch narrow and specific.",
    ),
    "py-08": CatalogActivity(
        kind="short_answer",
        prompt="Name one check for decoded JSON application data and one reason decoding alone is insufficient.",
        explanation="Decoded JSON can be syntactically valid while having the wrong field types or missing required values. Validate the domain shape before use.",
        hint="Mention a field type and the difference between valid syntax and valid application data.",
    ),
    "py-09": CatalogActivity(
        kind="choice",
        prompt="Two independent network requests populate a dashboard. What can asyncio.gather do?",
        choices=[
            "Run both while they wait and return both results",
            "Make CPU-heavy work faster automatically",
            "Guarantee that either request cannot fail",
        ],
        correct_choice="Run both while they wait and return both results",
        explanation="Concurrent I/O can overlap waiting time. It does not speed CPU work or eliminate failure handling.",
        hint="Think about what async code does while an operation waits.",
    ),
    "py-10": CatalogActivity(
        kind="short_answer",
        prompt="Give one input and expected output pair for a parameterized test of normalize_name, and say what boundary it covers.",
        explanation="A parameterized case maps a concrete input to an expected result and should represent a meaningful boundary such as empty or whitespace-only input.",
        hint="Include an input, its expected result, and name the edge it covers.",
    ),
    "py-11": CatalogActivity(
        kind="choice",
        prompt="Where should a shared parsing helper live when routes call it but it should not depend on the web app?",
        choices=[
            "A focused lower-level module imported by routes",
            "Inside the application entrypoint only",
            "In a module named json.py",
        ],
        correct_choice="A focused lower-level module imported by routes",
        explanation="A focused helper module keeps dependencies flowing toward reusable behavior and avoids shadowing standard-library modules.",
        hint="Keep reusable logic below the route layer in the dependency direction.",
    ),
    "py-12": CatalogActivity(
        kind="choice",
        prompt="Which log detail is appropriate for diagnosing a profile lookup failure?",
        choices=["A stable user identifier", "The user's password", "An access token"],
        correct_choice="A stable user identifier",
        explanation="A minimal stable identifier can support correlation. Passwords and tokens are secrets and must not be logged.",
        hint="Choose context that helps correlate without exposing a secret.",
    ),
    "a11y-01": CatalogActivity(
        kind="choice",
        prompt="Which element should identify the central content of a page?",
        choices=["<main>", "<div>", "<span>"],
        correct_choice="<main>",
        explanation="The main landmark identifies the central content and gives assistive technology a direct navigation target.",
        hint="Choose the semantic landmark for primary page content.",
    ),
    "a11y-02": CatalogActivity(
        kind="choice",
        prompt="What gives an email field a persistent accessible name?",
        choices=[
            "Placeholder text only",
            "A visible label associated with the input",
            "A color change on focus",
        ],
        correct_choice="A visible label associated with the input",
        explanation="An associated label remains available while typing and provides the control's accessible name.",
        hint="The name should remain visible after entry starts.",
    ),
    "a11y-03": CatalogActivity(
        kind="choice",
        prompt="What should a keyboard check confirm?",
        choices=[
            "Every control is reachable and focus remains visible",
            "Only the page title can receive focus",
            "Tab order follows DOM-independent animation timing",
        ],
        correct_choice="Every control is reachable and focus remains visible",
        explanation="Keyboard users need to reach and operate controls and see where focus is positioned.",
        hint="Check both reachability and a visible focus indicator.",
    ),
    "sql-01": CatalogActivity(
        kind="choice",
        prompt="What does a primary key do?",
        choices=[
            "Uniquely identifies a row",
            "Sorts every query automatically",
            "Joins every table by column name",
        ],
        correct_choice="Uniquely identifies a row",
        explanation="A primary key provides a stable unique identity for a record.",
        hint="Think about what makes a record addressable.",
    ),
    "sql-02": CatalogActivity(
        kind="choice",
        prompt="Which clause controls the returned row order?",
        choices=["WHERE", "ORDER BY", "JOIN"],
        correct_choice="ORDER BY",
        explanation="WHERE filters rows; ORDER BY explicitly arranges the selected result.",
        hint="Filtering and arranging are separate operations.",
    ),
    "sql-03": CatalogActivity(
        kind="choice",
        prompt="Which join keeps every row from the left table when no match exists?",
        choices=["INNER JOIN", "LEFT JOIN", "CROSS JOIN"],
        correct_choice="LEFT JOIN",
        explanation="A left join retains left-side rows and fills unmatched right-side columns with null.",
        hint="The preserved table is named in the join type.",
    ),
}


def get_topic_activity(
    topic_id: str, item_title: str | None = None, exercise: str | None = None
) -> PracticeActivityData:
    seeded = SEEDED_ACTIVITIES.get(topic_id)
    if seeded is not None:
        return PracticeActivityData(
            id=f"act_{topic_id}_v1",
            version=seeded.version,
            topic_id=topic_id,
            kind=seeded.kind,
            prompt=seeded.prompt,
            choices=seeded.choices,
            hint=seeded.hint,
            explanation=seeded.explanation,
        )

    if exercise and exercise.strip():
        return PracticeActivityData(
            id=f"act_{topic_id}_v1",
            version="1.0",
            topic_id=topic_id,
            kind="short_answer",
            prompt=exercise.strip(),
            choices=None,
            hint="Refer to the lesson explanation and objectives.",
            explanation="Your answer is saved with your learning progress.",
        )

    prompt = (
        f"In one sentence, explain the core concept or decision in {item_title}."
        if item_title
        else "In one sentence, describe the key concept in this lesson."
    )
    return PracticeActivityData(
        id=f"act_{topic_id}_v1",
        version="1.0",
        topic_id=topic_id,
        kind="reflection",
        prompt=prompt,
        choices=None,
        hint="Use the lesson objective as a guide.",
        explanation="Your reflection is saved as a private draft. It is not graded.",
    )
