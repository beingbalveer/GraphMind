export type Lesson = {
  id: string;
  title: string;
  duration: number;
  section: string;
  objective: string;
  paragraphs: [string, string][];
  code: string;
  exercise: string;
  note: string;
  source: { title: string; description: string; url: string };
};

export type Roadmap = {
  id: string;
  slug: string;
  snapshotVersion: string;
  title: string;
  summary: string;
  category: string;
  level: "Beginner" | "Intermediate";
  duration: string;
  outcomes: string[];
  prerequisites: string[];
  phases: { title: string; lessons: Lesson[] }[];
  tags: string[];
};

const lesson = (
  id: string,
  title: string,
  section: string,
  duration: number,
  objective: string,
  paragraphs: [string, string][],
  code: string,
  exercise: string,
  note: string,
  source: Lesson["source"],
): Lesson => ({
  id,
  title,
  section,
  duration,
  objective,
  paragraphs,
  code,
  exercise,
  note,
  source,
});

const python = {
  functions: {
    title: "Python functions",
    description:
      "Official Python tutorial for defining functions and their parameters.",
    url: "https://docs.python.org/3/tutorial/controlflow.html#defining-functions",
  },
  models: {
    title: "Pydantic models",
    description: "Official guide to parsing and validating typed data models.",
    url: "https://docs.pydantic.dev/latest/concepts/models/",
  },
  fastapi: {
    title: "FastAPI path operations",
    description:
      "Official FastAPI tutorial for declaring HTTP path operations.",
    url: "https://fastapi.tiangolo.com/tutorial/first-steps/",
  },
  pytest: {
    title: "pytest getting started",
    description: "Official pytest guide to writing and running tests.",
    url: "https://docs.pytest.org/en/stable/getting-started.html",
  },
};

export const roadmaps: Roadmap[] = [
  {
    id: "roadmap-python-backend",
    slug: "python-backend-foundations",
    snapshotVersion: "2026-10-14.1",
    title: "Python foundations for backend work",
    summary:
      "Move from small Python transformations to typed request boundaries, HTTP endpoints, and focused tests.",
    category: "Backend",
    level: "Beginner",
    duration: "About 3.5 hours",
    tags: ["Python", "APIs", "Testing"],
    outcomes: [
      "Write small functions with explicit inputs and outputs",
      "Validate incoming data at a clear boundary",
      "Describe an endpoint contract and test its behavior",
    ],
    prerequisites: [
      "Basic familiarity with variables and the command line helps; no framework experience is needed.",
    ],
    phases: [
      {
        title: "The building blocks",
        lessons: [
          lesson(
            "py-01",
            "Python foundations for backend work",
            "01 · The building blocks",
            12,
            "Trace a value through a small function and explain its return value.",
            [
              [
                "A useful mental model",
                "A Python program is a sequence of values and decisions. Before reaching for a framework, learn how data moves through a small function: input arrives, the function transforms it, and a result leaves.",
              ],
              [
                "Functions make behavior legible",
                "A function names one transformation. Keep its inputs explicit and its output predictable; callers can then compose it without needing to know its internal steps.",
              ],
              [
                "Trace values in small steps",
                "When reading unfamiliar code, write down the value entering a function, the operations applied to it, and the value returned. For normalize_email, the original string remains unchanged because strip and lower produce new string values. The function returns the transformed value, and the caller assigns that result to address. This distinction matters when a transformation is nested inside a larger expression: the variable holding the original input does not magically change. Following each assignment makes control flow easier to reason about and makes debugging less dependent on guesses.",
              ],
              [
                "Make the input contract explicit",
                "The annotation value: str documents the kind of value the function expects, and -> str documents its intended result. Python does not enforce these annotations when the program runs. They are useful to editors, static type checkers, reviewers, and later maintainers, but untrusted values still need runtime validation at the boundary where they enter. Naming the parameter value also communicates less than a domain-specific name such as email; choose names that help a caller understand the contract without needing to inspect the implementation.",
              ],
              [
                "Keep transformations predictable",
                "A function that only computes and returns a result is easier to reuse than one that also reads a file, changes global state, or sends a network request. Predictable functions are easy to test because a test can provide one input and compare one result. When an operation needs an external resource, pass the required value into the function or keep the external operation in a small boundary function. This separation lets the core transformation remain understandable while a route, command, or scheduled task handles the surrounding work.",
              ],
              [
                "Use decisions to define edge behavior",
                "Real input includes empty strings, extra whitespace, mixed letter case, and values that do not follow the expected format. Decide what the function promises for each case before adding a framework. The sample removes surrounding whitespace and normalizes case, but it does not prove that the result is a valid email address. A normalization function and a validation function answer different questions: one produces a consistent representation, while the other decides whether a value meets a rule. Keeping those responsibilities separate prevents callers from assuming more than the function actually guarantees.",
              ],
              [
                "Build a few precise examples",
                "Concrete examples make a function's contract easier to check. A mixed-case address with surrounding spaces should become lowercase with no extra spaces. A whitespace-only display name may become an empty string if that is the chosen contract. A value containing internal spaces should retain them unless the function explicitly removes them. These examples are not a substitute for documenting the intent; they are small executable reminders of that intent. If a requirement changes, update the function and the example together so the test continues to describe expected behavior rather than old implementation details.",
              ],
              [
                "Compose small operations",
                "A backend request often passes through several transformations: parse a payload, normalize one field, validate domain rules, and call a service. Each step should have a clear input and output so the sequence can be inspected independently. Avoid making a single function responsible for transport parsing, database access, formatting, and error translation. A useful first design is the smallest one that states the contract clearly; additional layers are warranted when they separate responsibilities or make behavior testable, not simply because a larger application might eventually need them.",
              ],
              [
                "Name behavior at the level of intent",
                "A name should help a caller decide whether this function is appropriate. normalize_email says that representation changes; validate_email would imply a check and perhaps an error; save_email would imply a side effect. Accurate names prevent accidental reliance on behavior the function does not provide. Parameters should follow the same rule: a generic value is acceptable in a tiny example, but a production function usually benefits from a name that explains the role of the input. If the name requires a long comment to clarify its promise, simplify the function or make its result more explicit.",
              ],
              [
                "Check assumptions where they enter",
                "An HTTP request, command-line argument, file, or message from another service is outside data. A type annotation cannot make that data trustworthy. Parse and validate it at the boundary, then pass a stable value into application functions. This keeps validation close to the source of uncertainty and allows deeper code to work with clearer assumptions. When an invalid value is rejected, return an error that identifies the field and rule without echoing secrets or exposing implementation details. The exact response format belongs to the caller's interface, while the rule itself can remain a testable function.",
              ],
              [
                "Debug by narrowing the question",
                "If a result is unexpected, reduce the problem to the smallest input that reproduces it. Check the value before the call, inspect the transformation, and compare the returned value to the expected contract. A temporary print can help in a local script, while a service should use its configured logger so context and severity are consistent. Avoid changing several parts of a function at once; a focused change makes it easier to determine which assumption was wrong. Once the behavior is understood, keep a regression test for the edge case if it represents a requirement users depend on.",
              ],
            ],
            'def normalize_email(value: str) -> str:\n    return value.strip().lower()\n\naddress = normalize_email("  Ada@Example.com ")',
            "Write a function that trims a display name and returns an empty string for all-whitespace input.",
            "A function is easiest to test when the same input always produces the same output and side effects stay at the boundary.",
            python.functions,
          ),
        ],
      },
      {
        title: "Reliable data",
        lessons: [
          lesson(
            "py-02",
            "Shape data with types and models",
            "02 · Reliable data",
            16,
            "Recognize where type hints end and runtime validation begins.",
            [
              [
                "Make invalid states harder to express",
                "Type hints describe the shape your code expects. They help editors and reviewers catch mismatches early, while runtime validation belongs at the boundary where untrusted data enters.",
              ],
              [
                "Model the boundary",
                "A request model can validate a payload once, then give the rest of your application a stable, typed object to work with.",
              ],
            ],
            "from pydantic import BaseModel, EmailStr\n\nclass Signup(BaseModel):\n    email: EmailStr\n    display_name: str",
            "Add a non-empty display_name rule to a request model, then list one invalid payload to check.",
            "A parsed model separates untrusted input from application logic. Validation errors should be useful without exposing internals.",
            python.models,
          ),
        ],
      },
      {
        title: "HTTP in practice",
        lessons: [
          lesson(
            "py-03",
            "Build a small FastAPI endpoint",
            "03 · HTTP in practice",
            18,
            "Map a method and path to a response contract.",
            [
              [
                "An endpoint is a contract",
                "A route connects an HTTP method and path to application behavior. Keep transport concerns at the edge, then delegate the actual work to a function that can be tested independently.",
              ],
              [
                "Return useful responses",
                "Choose status codes and response shapes that make success and failure clear to callers. FastAPI uses the declared model to validate and document that contract.",
              ],
            ],
            'from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get("/health")\ndef health() -> dict[str, str]:\n    return {"status": "ok"}',
            "Sketch a GET /items/{item_id} response for an existing item and for a missing one.",
            "The route is an adapter around application behavior. Keep decisions testable without starting a web server where practical.",
            python.fastapi,
          ),
        ],
      },
      {
        title: "Confidence",
        lessons: [
          lesson(
            "py-04",
            "Test behavior and handle failures",
            "04 · Confidence",
            14,
            "Choose a focused test for expected behavior and a boundary failure.",
            [
              [
                "Test the behavior people rely on",
                "A focused test describes an input and the result that matters. Tests are especially useful around boundaries: malformed payloads, missing records, and unexpected downstream failures.",
              ],
              [
                "Keep errors meaningful",
                "Translate lower-level failures into a stable application response, and retain enough context in logs to investigate the cause without exposing internals to a caller.",
              ],
            ],
            'def test_normalize_email() -> None:\n    assert normalize_email(" Ada@Example.com ") == "ada@example.com"',
            "Add one normal case and one edge case to the normalization test; state what each protects.",
            "A test is an executable example of a behavior. Prefer assertions that communicate the contract to future readers.",
            python.pytest,
          ),
        ],
      },
      {
        title: "Working with collections",
        lessons: [
          lesson("py-05", "Choose the right collection", "05 · Working with collections", 18,
            "Select a list, tuple, set, or dictionary based on the operation the code needs.",
            [["Collections encode intent", "A list preserves order and supports repeated values. A tuple is also ordered, but communicates a fixed record-like grouping. A set represents unique members and supports membership checks. A dictionary maps keys to values so callers can retrieve a value by a meaningful identifier."], ["Choose by operation", "If the common operation is looking up a user by ID, a dictionary makes that operation direct. If the common operation is processing each event in sequence, a list communicates that order. The choice affects both clarity and performance: membership checks in a set or dictionary are typically faster than scanning a long list, while ordering and duplicates remain meaningful in a list."]],
            'users_by_id = {user["id"]: user for user in users}\nactive_ids = {"u-12", "u-18"}\nactive_users = [users_by_id[user_id] for user_id in active_ids if user_id in users_by_id]',
            "For a queue of jobs where duplicates and order matter, choose a collection. For checking whether an email has already been seen, choose one. Explain the operations behind each choice.",
            "A collection should describe the invariants the surrounding code relies on. If uniqueness matters, a set makes that rule visible instead of relying on a later cleanup step.",
            { title: "Python data structures", description: "Official Python tutorial covering lists, tuples, sets, and dictionaries.", url: "https://docs.python.org/3/tutorial/datastructures.html" }),
          lesson("py-06", "Transform records with comprehensions", "05 · Working with collections", 20,
            "Use a comprehension for a clear one-pass transformation or filtering step.",
            [["Name the transformation", "A list comprehension combines an expression and an iteration in a compact form. It is most readable when the transformation is short and the filtering condition is easy to see. The reader should be able to identify the output shape without mentally unrolling several nested loops."], ["Keep complex work explicit", "A comprehension is not automatically clearer than a loop. If the expression has multiple branches, side effects, or several nested iterations, an explicit loop gives the reader room to follow each decision. Build intermediate values when they make the transformation easier to name and test."]],
            'normalized = [email.strip().lower() for email in submitted_emails if email.strip()]',
            "Rewrite a short loop that trims non-empty strings as a list comprehension. Then decide whether a nested loop joining customers to orders still reads clearly in comprehension form.",
            "Comprehensions create a new collection. Avoid mutating external state inside them; a loop communicates side effects more clearly.",
            { title: "List comprehensions", description: "Official Python tutorial on list comprehensions and nested comprehensions.", url: "https://docs.python.org/3/tutorial/datastructures.html#list-comprehensions" }),
        ],
      },
      {
        title: "Boundaries and files",
        lessons: [
          lesson("py-07", "Handle expected exceptions", "06 · Boundaries and files", 20,
            "Catch a specific expected failure and let unexpected failures remain visible.",
            [["Exceptions describe exceptional paths", "Operations at a boundary can fail: a record may be missing, a value may not parse, or a remote dependency may be unavailable. Catch a specific exception when the current layer can take a useful action, such as returning a stable not-found result or adding context to an error."], ["Avoid hiding defects", "A broad except clause that returns a default can make a broken program look successful. Keep the protected block narrow, catch the expected exception type, and preserve the original cause when translating an error. A caller should be able to distinguish invalid input from an unexpected service failure."]],
            'def parse_port(value: str) -> int:\n    try:\n        port = int(value)\n    except ValueError as error:\n        raise ValueError("port must be a whole number") from error\n    if not 1 <= port <= 65535:\n        raise ValueError("port must be between 1 and 65535")\n    return port',
            "Name two expected failures when reading an integer from a request. Decide which layer should translate each failure into a response and what information should remain in logs.",
            "Do not catch Exception merely to keep a request alive. Translate known failures deliberately and allow unexpected defects to reach error reporting.",
            { title: "Errors and exceptions", description: "Official Python tutorial on exception handling and raising exceptions.", url: "https://docs.python.org/3/tutorial/errors.html" }),
          lesson("py-08", "Read and write structured JSON", "06 · Boundaries and files", 22,
            "Serialize a Python value to JSON and validate decoded data before using it.",
            [["JSON is a data format", "JSON represents objects, arrays, strings, numbers, booleans, and null. Python's json module converts compatible values to and from these types, but decoding does not establish that a document matches your application's expectations."], ["Validate after decoding", "Treat decoded content as untrusted input. Check required fields and value types before using them. For a small script, explicit checks can be enough; at an API boundary, a model can centralize validation and produce useful errors. When writing files, choose an encoding and use a context manager so the file closes even if serialization fails."]],
            'import json\nfrom pathlib import Path\n\nsettings = {"theme": "dark", "page_size": 20}\nPath("settings.json").write_text(json.dumps(settings, indent=2), encoding="utf-8")\n\nraw = json.loads(Path("settings.json").read_text(encoding="utf-8"))\nif not isinstance(raw.get("page_size"), int):\n    raise ValueError("page_size must be an integer")',
            "Describe the validation needed before using a decoded JSON object's timeout and endpoint fields. Include a case where the document is valid JSON but invalid application data.",
            "Successful JSON decoding only means the syntax is valid. Validate domain rules separately and avoid silently substituting values for malformed configuration.",
            { title: "Python JSON module", description: "Official Python documentation for encoding and decoding JSON.", url: "https://docs.python.org/3/library/json.html" }),
        ],
      },
      {
        title: "Async service work",
        lessons: [
          lesson("py-09", "Run independent I/O concurrently", "07 · Async service work", 24,
            "Use asyncio tasks for independent I/O-bound work and await every task's result.",
            [["Concurrency helps while work waits", "An async function can yield control while a network or file-like operation is waiting. This lets an event loop make progress on other tasks during that wait. Async code does not make CPU-heavy work faster, and adding it to a program with only sequential local calculations creates complexity without a benefit."], ["Manage task results", "When two independent requests do not depend on one another, gather can run them concurrently and return their results in input order. If one result is required before the next request can be made, preserve that dependency. Tasks should have a clear owner that awaits their completion and handles their failures."]],
            'import asyncio\n\nasync def load_dashboard(user_id: str) -> dict[str, object]:\n    profile, alerts = await asyncio.gather(\n        fetch_profile(user_id),\n        fetch_alerts(user_id),\n    )\n    return {"profile": profile, "alerts": alerts}',
            "Two independent HTTP calls populate one dashboard. Explain why gathering them can reduce waiting time, and name one reason the same approach would be wrong for dependent calls.",
            "Use concurrency for independent waits. Keep cancellation, timeouts, and task failures visible at the boundary that owns the work.",
            { title: "asyncio tasks", description: "Official Python documentation for tasks and concurrent coroutines.", url: "https://docs.python.org/3/library/asyncio-task.html" }),
          lesson("py-10", "Test boundaries with parametrized cases", "07 · Async service work", 18,
            "Describe several input and output cases in a compact, readable test table.",
            [["Cases reveal the contract", "A single happy-path test proves only one example. Boundary cases expose the behavior around empty values, limits, malformed input, and missing records. Selecting cases starts with the contract: identify meaningful partitions rather than adding arbitrary values."], ["Parameterize repeated structure", "When multiple cases exercise the same behavior with different data, pytest.mark.parametrize can express them in one test. Keep each case readable and make assertion failures identify the input. Separate tests when setup or expected behavior differs enough that combining them would obscure the purpose."]],
            '@pytest.mark.parametrize(\n    ("raw", "expected"),\n    [(" Ada ", "Ada"), ("", ""), ("   ", "")],\n)\ndef test_normalize_name(raw: str, expected: str) -> None:\n    assert normalize_name(raw) == expected',
            "Add a case for a Unicode name and a whitespace-only value. Explain what the expected result should be from the function's contract.",
            "Parametrization reduces repeated test scaffolding. It should make the input-to-output contract easier to scan, not hide unrelated scenarios in one test.",
            python.pytest),
        ],
      },
      {
        title: "Shape a small service",
        lessons: [
          lesson("py-11", "Split code into focused modules", "08 · Shape a small service", 18,
            "Place related behavior in importable modules with clear responsibilities.",
            [["A module gives code a name", "Every Python file can be imported as a module. Splitting code by responsibility lets callers depend on a small public surface rather than reaching into unrelated implementation details. A module should group behavior that changes together: parsing rules can live near a parser, while HTTP routing can stay at the transport edge."], ["Imports form a dependency direction", "Keep lower-level helpers independent of higher-level application wiring. If a utility imports the web application just to access one constant, the dependency points in the wrong direction. Use package-relative imports consistently and run modules the way the project expects so import paths match deployment. Avoid naming your files after standard-library modules such as json.py or logging.py, because that can shadow the real module."]],
            'project/\n  app/\n    __init__.py\n    routes.py\n    services.py\n    models.py\n\n# routes.py\nfrom .services import find_item\n\ndef get_item(item_id: str):\n    return find_item(item_id)',
            "A route and a data transformation are growing in one file. Name a module for each responsibility and describe which module should import the other.",
            "A module boundary is useful when it clarifies ownership and dependencies. Avoid splitting every function into its own file; the goal is a coherent public interface.",
            { title: "Python modules", description: "Official Python tutorial on modules, imports, and packages.", url: "https://docs.python.org/3/tutorial/modules.html" }),
          lesson("py-12", "Configure logs for useful diagnosis", "08 · Shape a small service", 18,
            "Record structured context at the point where application behavior becomes observable.",
            [["Logs tell an operational story", "A log record should help answer what happened, where it happened, and which request or entity it concerned. Choose a level that reflects the event: debug details help during investigation, informational records describe normal milestones, warnings indicate recoverable problems, and errors mark failures that need attention."], ["Keep sensitive data out", "Context makes a record useful, but request bodies, tokens, passwords, and private customer data do not belong in logs. Prefer stable identifiers and explicit fields. At a service boundary, catch failures only when the service can add meaningful context or translate the result; include the exception information in internal logs while returning a safe message to a caller. Configure logging once in the application entry point so modules share a consistent format."]],
            'import logging\n\nlogger = logging.getLogger(__name__)\n\ndef load_profile(user_id: str):\n    logger.info("Loading profile", extra={"user_id": user_id})\n    try:\n        return repository.get_profile(user_id)\n    except ProfileStoreUnavailable:\n        logger.exception("Profile store unavailable", extra={"user_id": user_id})\n        raise',
            "Choose one useful context field for a profile lookup failure. Name one field that must never be recorded and explain why.",
            "Logs are an internal diagnostic record, not a place to copy the full request. Keep the data minimal and useful for correlating events.",
            { title: "Python logging", description: "Official Python guide to logging from applications and libraries.", url: "https://docs.python.org/3/howto/logging.html" }),
        ],
      },
    ],
  },
  {
    id: "roadmap-web-accessibility",
    slug: "accessible-web-foundations",
    snapshotVersion: "2026-10-14.1",
    title: "Accessible web foundations",
    summary:
      "Practice semantic HTML, keyboard interaction, and clear feedback while building a small interface.",
    category: "Frontend",
    level: "Beginner",
    duration: "About 45 minutes",
    tags: ["HTML", "Accessibility", "UI"],
    outcomes: [
      "Choose semantic elements for common controls",
      "Test a simple flow with a keyboard",
      "Add labels and useful status feedback",
    ],
    prerequisites: [
      "Basic HTML familiarity is helpful; no assistive technology setup is required for the exercises.",
    ],
    phases: [
      {
        title: "A usable interface",
        lessons: [
          lesson(
            "a11y-01",
            "Give content a meaningful structure",
            "01 · Structure",
            13,
            "Organize a page so headings and landmarks explain its layout.",
            [
              [
                "Structure communicates purpose",
                "HTML elements carry meaning. A heading introduces a section, a navigation landmark groups links, and a main landmark identifies the page's central content.",
              ],
              [
                "Use a clear heading outline",
                "Choose headings for their role in the document rather than their default size. CSS can control appearance without changing that structure.",
              ],
            ],
            '<main>\n  <h1>Account settings</h1>\n  <section aria-labelledby="profile-heading">\n    <h2 id="profile-heading">Profile</h2>\n  </section>\n</main>',
            "Outline a settings page with one main heading and two named sections.",
            "A screen reader can navigate by landmarks and headings; meaningful structure helps everyone scan a page.",
            {
              title: "HTML elements reference",
              description:
                "MDN reference describing the meaning and use of HTML elements.",
              url: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element",
            },
          ),
          lesson(
            "a11y-02",
            "Make controls understandable",
            "02 · Controls",
            14,
            "Pair each input with a persistent accessible name.",
            [
              [
                "A control needs a name",
                "A visible label tells people what information belongs in a field. A programmatic association makes that same name available to assistive technology.",
              ],
              [
                "Instructions belong near the control",
                "If a field has a format or requirement, describe it in text and connect it to the input. Placeholder text alone disappears during entry.",
              ],
            ],
            '<label for="email">Email address</label>\n<input id="email" type="email" autocomplete="email">',
            "Add a label and a short hint to a newsletter email field.",
            "Labels should describe the requested value. Error text should name the issue and how to correct it.",
            {
              title: "Labeling controls",
              description:
                "WAI guidance on labels and instructions for form controls.",
              url: "https://www.w3.org/WAI/tutorials/forms/labels/",
            },
          ),
          lesson(
            "a11y-03",
            "Navigate a flow with a keyboard",
            "03 · Keyboard",
            18,
            "Check focus order and operate a small form without a pointer.",
            [
              [
                "Keyboard access is a baseline",
                "Many people use a keyboard directly or through another input device. Every interactive control should be reachable and operable without a mouse.",
              ],
              [
                "Focus should remain visible",
                "A visible focus indicator shows where keyboard actions will go next. Keep the order aligned with the visual reading order and avoid trapping focus.",
              ],
            ],
            "button:focus-visible {\n  outline: 2px solid currentColor;\n  outline-offset: 3px;\n}",
            "Tab through a sign-up form, submit it, and note whether focus and feedback remain clear.",
            "Native controls provide useful keyboard behavior. Custom interactions need equivalent focus and key handling.",
            {
              title: "Keyboard accessibility",
              description:
                "WAI guidance for making web content keyboard operable.",
              url: "https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html",
            },
          ),
        ],
      },
    ],
  },
  {
    id: "roadmap-sql-queries",
    slug: "sql-query-basics",
    snapshotVersion: "2026-10-14.1",
    title: "SQL query basics",
    summary:
      "Learn to read a small relational schema, filter rows, and connect related records with joins.",
    category: "Data",
    level: "Beginner",
    duration: "About 50 minutes",
    tags: ["SQL", "Databases", "Queries"],
    outcomes: [
      "Read a simple table relationship",
      "Filter and sort rows deliberately",
      "Join related records without losing the intended grain",
    ],
    prerequisites: [
      "No database installation is needed; examples use a small imaginary bookstore schema.",
    ],
    phases: [
      {
        title: "Ask the data a clear question",
        lessons: [
          lesson(
            "sql-01",
            "Read a relational table",
            "01 · Tables",
            15,
            "Identify columns, keys, and the meaning of a row.",
            [
              [
                "A row represents one record",
                "A table organizes records that share a shape. Before writing a query, identify what one row means and which column uniquely identifies it.",
              ],
              [
                "Relationships use keys",
                "A foreign key stores a reference to a row in another table. Thinking about that relationship first helps you choose a correct join later.",
              ],
            ],
            "CREATE TABLE books (\n  id INTEGER PRIMARY KEY,\n  title TEXT NOT NULL,\n  author_id INTEGER REFERENCES authors(id)\n);",
            "For an orders table, decide what one row represents and which fields identify it.",
            "A primary key identifies a record. A foreign key connects it to a related table while preserving the relationship explicitly.",
            {
              title: "PostgreSQL table basics",
              description:
                "Official PostgreSQL tutorial introducing tables and relational data.",
              url: "https://www.postgresql.org/docs/current/tutorial-table.html",
            },
          ),
          lesson(
            "sql-02",
            "Filter and sort results",
            "02 · Selection",
            16,
            "Use WHERE and ORDER BY to make a result set precise.",
            [
              [
                "Ask for a subset",
                "A WHERE clause keeps rows that meet a condition. Make the condition match the question, including how null values and boundaries should behave.",
              ],
              [
                "Ordering is explicit",
                "Rows have no guaranteed order unless the query asks for one. ORDER BY makes the display order part of the query contract.",
              ],
            ],
            "SELECT title, published_year\nFROM books\nWHERE published_year >= 2020\nORDER BY title ASC;",
            "Find books published before a chosen year, newest first, and write the ordering explicitly.",
            "Filtering and ordering affect different things: WHERE selects rows; ORDER BY arranges the selected rows.",
            {
              title: "PostgreSQL querying tables",
              description:
                "Official PostgreSQL tutorial on selecting, filtering, and ordering rows.",
              url: "https://www.postgresql.org/docs/current/tutorial-select.html",
            },
          ),
          lesson(
            "sql-03",
            "Join related records",
            "03 · Joins",
            19,
            "Join tables on their relationship and reason about unmatched rows.",
            [
              [
                "Join on a relationship",
                "A join combines rows using a condition, commonly a foreign key and primary key. The condition should describe the relationship, not merely columns that happen to share values.",
              ],
              [
                "Choose how unmatched rows behave",
                "An inner join excludes rows without a match. A left join keeps each row from the left side and fills missing right-side values with null.",
              ],
            ],
            "SELECT books.title, authors.name\nFROM books\nJOIN authors ON authors.id = books.author_id;",
            "Describe when a left join is more appropriate than an inner join for a report.",
            "Check the grain after a join. A one-to-many relationship can produce multiple result rows for one parent record.",
            {
              title: "PostgreSQL table joins",
              description:
                "Official PostgreSQL tutorial on joining related tables.",
              url: "https://www.postgresql.org/docs/current/tutorial-join.html",
            },
          ),
        ],
      },
    ],
  },
];

export const allLessons = (roadmap: Roadmap) =>
  roadmap.phases.flatMap((phase) => phase.lessons);
export const findRoadmap = (id: string) =>
  roadmaps.find((item) => item.id === id);
export const curriculum = allLessons(roadmaps[0]);
