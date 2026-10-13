export const curriculum = [
  {
    id: "py-01",
    title: "Python foundations for backend work",
    duration: "12 min",
    section: "01 · The building blocks",
    paragraphs: [
      [
        "A useful mental model",
        "A Python program is a sequence of values and decisions. Before reaching for a framework, learn how data moves through a small function: input arrives, the function transforms it, and a result leaves.",
      ],
      [
        "Functions make behavior legible",
        "A function names one transformation. Keep its inputs explicit and its output predictable; callers can then compose it without needing to know its internal steps.",
      ],
    ],
    code: 'def normalize_email(value: str) -> str:\n    return value.strip().lower()\n\naddress = normalize_email("  Ada@Example.com ")',
  },
  {
    id: "py-02",
    title: "Shape data with types and models",
    duration: "16 min",
    section: "02 · Reliable data",
    paragraphs: [
      [
        "Make invalid states harder to express",
        "Type hints describe the shape your code expects. They help editors and reviewers catch mismatches early, while runtime validation belongs at the boundary where untrusted data enters.",
      ],
      [
        "Model the boundary",
        "A request model can validate a payload once, then give the rest of your application a stable, typed object to work with.",
      ],
    ],
    code: "from pydantic import BaseModel, EmailStr\n\nclass Signup(BaseModel):\n    email: EmailStr\n    display_name: str",
  },
  {
    id: "py-03",
    title: "Build a small FastAPI endpoint",
    duration: "18 min",
    section: "03 · HTTP in practice",
    paragraphs: [
      [
        "An endpoint is a contract",
        "A route connects an HTTP method and path to application behavior. Keep transport concerns at the edge, then delegate the actual work to a function that can be tested independently.",
      ],
      [
        "Return useful responses",
        "Choose status codes and response shapes that make success and failure clear to callers. FastAPI uses the declared model to validate and document that contract.",
      ],
    ],
    code: 'from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get("/health")\ndef health() -> dict[str, str]:\n    return {"status": "ok"}',
  },
  {
    id: "py-04",
    title: "Test behavior and handle failures",
    duration: "14 min",
    section: "04 · Confidence",
    paragraphs: [
      [
        "Test the behavior people rely on",
        "A focused test describes an input and the result that matters. Tests are especially useful around boundaries: malformed payloads, missing records, and unexpected downstream failures.",
      ],
      [
        "Keep errors meaningful",
        "Translate lower-level failures into a stable application response, and retain enough context in logs to investigate the cause without exposing internals to a caller.",
      ],
    ],
    code: 'def test_normalize_email() -> None:\n    assert normalize_email(" Ada@Example.com ") == "ada@example.com"',
  },
];
