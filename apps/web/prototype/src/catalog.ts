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
    duration: "About 60 minutes",
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
