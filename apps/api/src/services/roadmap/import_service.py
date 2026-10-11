"""Deterministic import of roadmap.sh curricula.

Fetches the public developer-roadmap repository tarball (no GitHub API, no
rate limits), parses the per-topic markdown, groups topics into phases using
curated keyword rules, synthesizes the fields GraphMind's curriculum validator
requires, and persists through the same repository/validation pipeline the AI
generator uses. No model call happens anywhere in this module.
"""

import asyncio
import hashlib
import io
import re
import tarfile
import urllib.request
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable, Literal

import structlog
from models.roadmap import new_id
from models.workspace import NodeModel
from schemas.curriculum import (
    CurriculumCandidate,
    CurriculumItemData,
    CurriculumRelationData,
    CurriculumView,
    LearningProfile,
    ResourceData,
    SourceData,
)
from schemas.roadmap_job import MAX_COVERAGE_TOPICS
from schemas.workspace import WorkspaceCreate
from services.roadmap.curriculum_repository import CurriculumRepository
from services.roadmap.validation import validate_curriculum
from services.workspace_service import WorkspaceService
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()

ROADMAP_SH_REPO = "https://github.com/kamranahmedse/developer-roadmap"
ROADMAP_SH_TARBALL = f"{ROADMAP_SH_REPO}/archive/refs/heads/master.tar.gz"
ROADMAP_SH_SITE = "https://roadmap.sh"
USER_AGENT = "graphmind-roadmap-import/1.0"

RESOURCE_KIND: dict[str, str] = {
    "official": "official_docs",
    "article": "article",
    "video": "video",
    "course": "course",
    "book": "book",
    "roadmap": "roadmap",
}

CURATED_FIELDS: dict[str, dict[str, str]] = {
    slug: {"title": title, "url": f"{ROADMAP_SH_SITE}/{slug}"}
    for slug, title in {
        "devops": "DevOps Roadmap",
        "ai-engineer": "AI Engineer Roadmap",
        "frontend": "Frontend Roadmap",
        "backend": "Backend Roadmap",
        "full-stack": "Full Stack Roadmap",
        "data-engineer": "Data Engineer Roadmap",
        "data-analyst": "Data Analyst Roadmap",
        "machine-learning": "Machine Learning Roadmap",
        "mlops": "MLOps Roadmap",
        "cyber-security": "Cyber Security Roadmap",
    }.items()
}

# Topic counts in the master tarball at authoring time (cosmetic UI metadata).
CURATED_TOPIC_COUNTS: dict[str, int] = {
    "devops": 140,
    "ai-engineer": 194,
    "frontend": 121,
    "backend": 156,
    "full-stack": 37,
    "data-engineer": 190,
    "data-analyst": 102,
    "machine-learning": 150,
    "mlops": 62,
    "cyber-security": 302,
}

# Ordered phase buckets per slug. Each entry is (phase title, [keywords]).
# A topic is placed in the first phase whose keyword matches its lowercased
# title; unmatched topics fall into the trailing "Additional Topics" phase.
PHASE_RULES: dict[str, list[tuple[str, list[str]]]] = {
    "devops": [
        (
            "Fundamentals",
            [
                "learn a language",
                "terminal",
                "text manipulation",
                "vim",
                "operating system",
                "windows",
                "ubuntu",
                "debian",
                "rhel",
                "opensuse",
                "freebsd",
                "openbsd",
                "netbsd",
                "bash",
                "powershell",
                "javascript",
                "go",
                "python",
                "ruby",
                "rust",
                "networking",
                "osi model",
                "dns",
                "http",
                "https",
                "ssh",
                "ssl/tls",
                "load balancer",
                "reverse proxy",
                "forward proxy",
                "ftp",
                "smtp",
                "imap",
                "pop3s",
                "dmarc",
                "domain keys",
                "spf",
                "firewall",
            ],
        ),
        (
            "Version Control & Collaboration",
            ["git", "version control", "github", "gitlab", "bitbucket"],
        ),
        (
            "Containers & Orchestration",
            [
                "containers",
                "docker",
                "lxc",
                "kubernetes",
                "orchestration",
                "gke",
                "eks",
                "aks",
                "openshift",
                "service mesh",
                "istio",
                "linkerd",
                "envoy",
                "consul",
                "fluxcd",
                "argocd",
                "gitops",
            ],
        ),
        (
            "CI/CD & Automation",
            [
                "ci/cd",
                "jenkins",
                "github actions",
                "gitlab ci",
                "circle ci",
                "buildkite",
                "teamcity",
                "octopus",
                "provisioning",
                "configuration management",
                "ansible",
                "puppet",
                "chef",
                "salt",
                "terraform",
                "pulumi",
                "cloudformation",
                "aws cdk",
                "eso",
                "sops",
                "vault",
                "sealed secrets",
                "secret management",
            ],
        ),
        (
            "Cloud & Web Servers",
            [
                "cloud",
                "aws",
                "azure",
                "google cloud",
                "gcp",
                "alibaba",
                "cloudflare",
                "digitalocean",
                "hetzner",
                "contabo",
                "heroku",
                "railway",
                "render",
                "vercel",
                "netlify",
                "serverless",
                "lambda",
                "functions",
                "availability",
                "design patterns",
                "apache",
                "nginx",
                "caddy",
                "tomcat",
                "iis",
                "artifact",
                "nexus",
                "artifactory",
            ],
        ),
        (
            "Observability & Monitoring",
            [
                "observability",
                "monitoring",
                "management and monitoring",
                "logs",
                "performance monitoring",
                "process monitoring",
                "datadog",
                "grafana",
                "prometheus",
                "loki",
                "elastic stack",
                "splunk",
                "graylog",
                "papertrail",
                "new relic",
                "dynatrace",
                "zabbix",
                "jaeger",
                "opentelemetry",
            ],
        ),
        ("Additional Topics", []),
    ],
    "ai-engineer": [
        (
            "AI Engineer Foundations",
            [
                "what is an ai engineer",
                "roles and responsibilities",
                "introduction",
                "ai engineer vs ml engineer",
                "ai vs agi",
                "how llms work",
                "types of ai models",
                "llms",
                "pre-trained models",
                "choosing the right model",
                "tokens",
                "temperature",
                "sampling",
                "top-k",
                "top-p",
                "repetition",
                "context window",
                "inference",
                "generation",
                "training",
                "fine-tuning",
                "open vs closed",
                "self-hosted",
                "purpose and functionality",
            ],
        ),
        (
            "Prompt & Context Engineering",
            [
                "prompt",
                "context",
                "role & behavior",
                "input format",
                "structured output",
                "streaming",
                "function calling",
                "content moderation",
                "end-user id",
                "data classification",
                "state & historical",
            ],
        ),
        (
            "Models & APIs",
            [
                "gemini",
                "anthropic",
                "claude",
                "openai",
                "deepseek",
                "mistral",
                "llama",
                "qwen",
                "gemma",
                "cohere",
                "openrouter",
                "lm studio",
                "ollama",
                "hugging face",
                "embedding",
                "sentence transformers",
                "what are embeddings",
            ],
        ),
        (
            "RAG & Vector Databases",
            [
                "rag",
                "retrieval",
                "semantic search",
                "similarity search",
                "indexing",
                "chunking",
                "vector database",
                "chroma",
                "pinecone",
                "qdrant",
                "weaviate",
                "faiss",
                "lancedb",
                "external memory",
                "memory systems",
            ],
        ),
        (
            "AI Agents & MCP",
            [
                "agent",
                "multi-agent",
                "tools & function calling",
                "mcp",
                "model context protocol",
                "agent sdk",
                "adk",
                "modus",
            ],
        ),
        (
            "LLM Development & Observability",
            [
                "development tools",
                "cursor",
                "codex",
                "replit",
                "windsurf",
                "langchain",
                "llama index",
                "haystack",
                "using sdks",
                "tracing",
                "observability",
                "langfuse",
                "langsmith",
                "helicone",
                "posthog",
                "arize",
                "production monitoring",
                "cost",
                "latency",
                "evaluat",
                "deepeval",
                "ragas",
                "regression testing",
            ],
        ),
        (
            "Multimodal AI",
            [
                "multimodal",
                "image",
                "video",
                "audio",
                "speech",
                "whisper",
                "text-to-speech",
                "dall-e",
                "vision",
                "transformers.js",
                "nanobanana",
            ],
        ),
        (
            "Safety, Ethics & Security",
            [
                "safety",
                "ethics",
                "bias",
                "fairness",
                "injection",
                "security",
                "privacy",
                "adversarial",
            ],
        ),
        ("Additional Topics", []),
    ],
    "frontend": [
        (
            "Web Fundamentals",
            [
                "internet",
                "http",
                "https",
                "dns",
                "domain",
                "hosting",
                "browsers",
                "web apis",
                "html",
                "css",
                "javascript",
                "version control",
                "git",
                "github",
                "gitlab",
            ],
        ),
        (
            "Core Tooling & Engineering",
            [
                "package manager",
                "npm",
                "pnpm",
                "yarn",
                "lint",
                "eslint",
                "prettier",
                "biome",
                "module bundler",
                "vite",
                "rollup",
                "rolldown",
                "esbuild",
                "swc",
                "type checker",
                "devtools",
                "cache-control",
                "cors",
                "content security",
                "owasp",
                "web security",
            ],
        ),
        (
            "Frameworks & Rendering",
            [
                "pick a framework",
                "react",
                "next.js",
                "nuxt",
                "vue",
                "svelte",
                "angular",
                "solidjs",
                "astro",
                "static site",
                "vuepress",
                "eleventy",
                "server-side rendering",
                "streamed response",
            ],
        ),
        (
            "State, Data & APIs",
            ["graphql", "apollo", "relay", "react-router", "tanstack"],
        ),
        (
            "Mobile & Desktop",
            ["mobile", "flutter", "react native", "tauri", "electron", "ionic", "desktop"],
        ),
        (
            "Design, Performance & Delivery",
            [
                "design system",
                "tailwind",
                "accessibility",
                "performance",
                "lighthouse",
                "progressive web",
                "service worker",
                "deployment",
                "pages",
                "vercel",
                "netlify",
                "render",
                "railway",
                "web components",
                "shadow dom",
                "custom elements",
            ],
        ),
        (
            "Testing & Quality",
            ["testing", "cypress", "playwright", "jest", "vitest", "code review"],
        ),
        (
            "AI in Frontend",
            [
                "ai-assisted",
                "ai vs",
                "generative ai",
                "implementing ai",
                "llms",
                "prompt engineering",
                "model context protocol",
                "agents",
                "claude code",
                "cursor",
                "openai",
                "gemini",
                "anthropic",
                "copilot",
                "refactoring with ai",
                "documentation generation",
            ],
        ),
        ("Additional Topics", []),
    ],
    "backend": [
        (
            "Programming & Foundations",
            [
                "learn a language",
                "python",
                "java",
                "javascript",
                "go",
                "rust",
                "ruby",
                "php",
                "c#",
                "backend development",
                "frontend basics",
                "skills",
                "version control",
                "git",
                "github",
                "gitlab",
                "browsers",
                "css",
                "html",
                "internet",
                "http",
                "https",
                "domain name",
                "hosting",
                "dns",
                "lxc",
            ],
        ),
        (
            "Databases & Storage",
            [
                "database",
                "relational",
                "sqlite",
                "postgresql",
                "mysql",
                "mariadb",
                "ms sql",
                "oracle",
                "mongodb",
                "cassandra",
                "couchdb",
                "dynamodb",
                "influxdb",
                "clickhouse",
                "timescale",
                "scylladb",
                "rethinkdb",
                "neo4j",
                "dgraph",
                "neptune",
                "elasticsearch",
                "solr",
                "redis",
                "memcached",
                "indexes",
                "normalization",
                "migrations",
                "transactions",
                "acid",
                "cap theorem",
                "scaling database",
                "sharding",
                "replication",
                "vectors",
            ],
        ),
        (
            "APIs, Auth & Integration",
            [
                "rest",
                "graphql",
                "grpc",
                "soap",
                "json apis",
                "open api",
                "web sockets",
                "server sent events",
                "long polling",
                "message broker",
                "kafka",
                "rabbitmq",
                "real time",
                "backpressure",
                "throttling",
                "authentication",
                "auth",
                "jwt",
                "oauth",
                "openid",
                "saml",
                "bcrypt",
                "md5",
                "scrypt",
                "sha",
                "server security",
                "web security",
                "owasp",
                "cors",
                "ssl/tls",
            ],
        ),
        (
            "Architecture & Scale",
            [
                "architectural patterns",
                "monolithic",
                "microservices",
                "service mesh",
                "serverless",
                "integration patterns",
                "building for scale",
                "twelve-factor",
                "failure modes",
                "graceful degradation",
                "circuit breaker",
                "caching",
                "load shifting",
                "soa",
            ],
        ),
        (
            "Testing, Observability & Ops",
            [
                "testing",
                "ci/cd",
                "code review",
                "monitoring",
                "observability",
                "telemetry",
                "instrumentation",
                "profiling",
                "web server",
                "nginx",
                "apache",
                "caddy",
                "ms iis",
            ],
        ),
        (
            "AI in Backend Development",
            [
                "ai agent",
                "ai-assisted",
                "ai vs",
                "ai in backend",
                "ai applications",
                "llms",
                "model context protocol",
                "embeddings",
                "function calling",
                "structured output",
                "prompt engineering",
                "streamed response",
                "copilot",
                "cursor",
                "claude code",
                "openai",
                "anthropic",
                "gemini",
                "rags",
                "refactoring with ai",
                "documentation generation",
                "skills",
            ],
        ),
        ("Additional Topics", []),
    ],
    "full-stack": [
        (
            "Foundations",
            ["git", "github", "linux", "unix", "html", "css", "javascript"],
        ),
        (
            "Frontend",
            ["react", "tailwind", "npm"],
        ),
        (
            "Backend & APIs",
            ["node.js", "node", "rest", "jwt", "postgresql", "redis", "api"],
        ),
        (
            "DevOps & Deployment",
            [
                "terraform",
                "ansible",
                "monit",
                "route53",
                "s3",
                "ses",
                "ec2",
                "vpc",
                "aws",
                "deployment",
            ],
        ),
        ("Projects & Checkpoints", ["checkpoint"]),
        ("Additional Topics", []),
    ],
    "data-engineer": [
        (
            "Data Engineering Foundations",
            [
                "what is data engineering",
                "introduction",
                "lifecycle",
                "data engineering vs data science",
                "skills and responsibilities",
                "data structures",
                "programming skills",
                "python",
                "go",
                "scala",
                "java",
                "linux basics",
                "git and github",
                "environmental management",
                "learn sql",
            ],
        ),
        (
            "Databases & Storage",
            [
                "database",
                "relational",
                "sql concepts",
                "postgresql",
                "mysql",
                "mariadb",
                "ms sql",
                "oracle",
                "nosql",
                "mongodb",
                "cassandra",
                "couchdb",
                "dynamodb",
                "hbase",
                "neo4j",
                "neptune",
                "redis",
                "memcached",
                "elasticsearch",
                "snowflake",
                "bigquery",
                "redshift",
                "data lake",
                "data warehouse",
                "warehousing",
                "data mart",
                "data fabric",
                "data mesh",
                "delta lake",
                "onehouse",
                "azure blob",
                "google cloud storage",
                "s3",
                "data storage",
                "cloud sql",
                "compute engine",
                "azure sql",
                "oltp",
                "olap",
                "indexing",
                "transactions",
                "cap theorem",
                "horizontal",
                "vertical scaling",
                "star vs snowflake",
                "slowly changing",
            ],
        ),
        (
            "Data Processing & Pipelines",
            [
                "extract data",
                "load data",
                "transform data",
                "ingestion",
                "batch",
                "streaming",
                "realtime",
                "data pipelines",
                "etl",
                "reverse etl",
                "dataflow",
                "glue",
                "data factory",
                "prefect",
                "luigi",
                "airflow",
                "dbt",
                "spark",
                "mapreduce",
                "hadoop",
                "hdfs",
                "distributed file",
                "cluster computing",
                "cluster management",
                "job scheduling",
                "messages vs streams",
                "messaging",
                "kafka",
                "rabbitmq",
                "async vs sync",
            ],
        ),
        (
            "Cloud & Infrastructure",
            [
                "cloud computing",
                "cloud architectures",
                "aws cdk",
                "terraform",
                "opentofu",
                "infrastructure as code",
                "kubernetes",
                "docker",
                "containers",
                "ci/cd",
                "github actions",
                "gitlab ci",
                "circleci",
                "argocd",
                "monitoring",
                "datadog",
                "prometheus",
                "new relic",
                "sentry",
                "serverless",
                "gke",
                "eks",
                "azure virtual",
                "aws sns",
                "aws sqs",
                "deployment",
                "big data tools",
            ],
        ),
        (
            "Data Quality, Governance & Security",
            [
                "data quality",
                "data masking",
                "data obfuscation",
                "data lineage",
                "metadata",
                "gdpr",
                "eu ai act",
                "encryption",
                "tokenization",
                "best practices",
                "reusability",
                "idempotency",
                "interoperability",
            ],
        ),
        (
            "Analytics & BI",
            [
                "data analytics",
                "business intelligence",
                "tableau",
                "looker",
                "power bi",
                "streamlit",
                "data serving",
                "a/b testing",
                "machine learning - a key concept",
                "ab-testing",
            ],
        ),
        (
            "Testing & Engineering Practices",
            [
                "testing",
                "choosing the right",
                "declarative vs imperative",
            ],
        ),
        ("Additional Topics", []),
    ],
    "data-analyst": [
        (
            "Analytics Foundations",
            [
                "what is data analytics",
                "introduction",
                "types of data analytics",
                "descriptive",
                "diagnostic",
                "predictive",
                "prescriptive",
                "learn a programming language",
                "key concepts for data analysts",
            ],
        ),
        (
            "Excel & Spreadsheets",
            [
                "excel",
                "pivot",
                "vlookup",
                "functions",
                "sum",
                "average",
                "count",
                "min",
                "max",
                "concat",
                "datedif",
                "if",
                "trim",
                "upper",
                "lower",
                "proper",
                "replace",
                "substitute",
            ],
        ),
        (
            "Statistics & Probability",
            [
                "statistical analysis",
                "central tendency",
                "mean",
                "median",
                "mode",
                "variance",
                "standard deviation",
                "dispersion",
                "skewness",
                "kurtosis",
                "range",
                "distribution",
                "hypothesis testing",
                "correlation",
                "outliers",
            ],
        ),
        (
            "Data Collection & Preparation",
            [
                "data collection",
                "apis",
                "web scraping",
                "csv",
                "databases",
                "storage",
                "cleanup",
                "handling missing",
                "removing duplicates",
                "transformation",
                "manipulation",
                "exploration",
            ],
        ),
        (
            "Data Visualization",
            [
                "visualis",
                "chart",
                "line chart",
                "scatter",
                "pie",
                "histogram",
                "heatmap",
                "funnel",
                "stacked",
                "matplotlib",
                "seaborn",
                "ggplot2",
                "power bi",
                "tableau",
            ],
        ),
        (
            "Big Data & SQL",
            [
                "big data",
                "hadoop",
                "mapreduce",
                "spark",
                "mpi",
                "parallel processing",
                "sql",
            ],
        ),
        (
            "Programming & Libraries",
            ["pandas", "dplyr", "python"],
        ),
        (
            "Machine Learning & Advanced Topics",
            [
                "machine learning",
                "deep learning",
                "supervised",
                "unsupervised",
                "regression",
                "decision tree",
                "knn",
                "k-means",
                "naive",
                "model evaluation",
                "cnn",
                "rnn",
                "natural language",
                "image recognition",
                "tensor",
                "pytorch",
                "reinforcement",
            ],
        ),
        ("Additional Topics", []),
    ],
    "machine-learning": [
        (
            "Math Foundations",
            [
                "statistics",
                "statistical concepts",
                "probability",
                "random variables",
                "bayes",
                "linear algebra",
                "scalars",
                "matrix",
                "determinants",
                "eigenvalues",
                "singular value",
                "calculus",
                "derivatives",
                "chain rule",
                "gradient, jacobian",
                "discrete mathematics",
            ],
        ),
        (
            "Python & Data Tooling",
            [
                "python",
                "data structures",
                "functions",
                "loops",
                "conditionals",
                "exceptions",
                "object oriented",
                "variables",
                "numpy",
                "pandas",
                "matplotlib",
                "seaborn",
                "scikit-learn",
                "essential python",
                "csv",
                "json",
                "excel files",
                "parquet",
                "data formats",
                "databases",
                "data sources",
                "data loading",
                "data preparation",
                "model selection",
                "hyperparameter",
                "model prediction",
                "graphs & charts",
            ],
        ),
        (
            "Machine Learning Core",
            [
                "introduction to machine learning",
                "types of machine learning",
                "supervised",
                "unsupervised",
                "semi-supervised",
                "self-supervised",
                "what is supervised",
                "what is unsupervised",
                "what is reinforcement",
                "regression",
                "linear regression",
                "polynomial regression",
                "logistic regression",
                "ridge",
                "lasso",
                "elastic net",
                "classification",
                "clustering",
                "k-nearest",
                "support vector",
                "decision trees",
                "random forests",
                "gradient boosting",
                "feature engineering",
                "feature selection",
                "feature scaling",
                "train-test",
                "k-fold",
                "loocv",
                "validation techniques",
                "model evaluation",
                "accuracy",
                "precision",
                "recall",
                "f1-score",
                "roc-auc",
                "log loss",
                "confusion matrix",
                "dimensionality",
                "principal component",
            ],
        ),
        (
            "Neural Networks & Deep Learning",
            [
                "neural network",
                "perceptron",
                "backpropagation",
                "activation",
                "loss functions",
                "deep learning",
                "convolutional",
                "cnn",
                "convolution",
                "pooling",
                "padding",
                "strides",
                "applications of cnns",
                "image classification",
                "image segmentation",
                "image and video",
                "recurrent",
                "lstm",
                "gru",
                "attention",
                "transformers",
                "autoencoders",
                "embeddings",
                "generative adversarial",
                "deep q-network",
                "q-learning",
                "policy gradient",
                "actor-critic",
                "reinforcement learning",
                "tensorflow",
                "keras",
                "pytorch",
                "deep learning libraries",
            ],
        ),
        (
            "NLP & Applied Topics",
            [
                "natural language",
                "tokenization",
                "stemming",
                "lemmatization",
                "explainable ai",
                "recommendation systems",
            ],
        ),
        ("Additional Topics", []),
    ],
    "mlops": [
        (
            "MLOps Foundations",
            [
                "what is mlops",
                "mlops principles",
                "mlops components",
                "machine learning fundamentals",
                "machine learning",
                "maths & statistics",
                "programming fundamentals",
                "python",
                "go",
                "sql",
                "bash",
                "git",
                "version control",
                "github",
                "gitlab",
            ],
        ),
        (
            "Data & Experimentation",
            [
                "data engineering fundamentals",
                "data ingestion",
                "data pipelines",
                "data lineage",
                "data lakes",
                "warehouses",
                "experiment tracking",
                "dvc",
                "kafka",
                "flink",
                "spark",
            ],
        ),
        (
            "Model Training & Serving",
            [
                "model training",
                "serving",
                "model evaluation",
                "deep learning",
                "tensorflow",
                "pytorch",
                "tflite",
                "scikit-learn",
                "edge ai",
                "jetson",
                "orchestration",
                "cloud-native ml",
                "mlflow",
                "kubeflow",
            ],
        ),
        (
            "CI/CD & Infrastructure",
            [
                "ci/cd",
                "github actions",
                "jenkins",
                "containerization",
                "docker",
                "kubernetes",
                "infrastructure as code",
                "terraform",
                "ansible",
                "cloud computing",
                "aws / azure / gcp",
                "continuous machine learning",
            ],
        ),
        (
            "Monitoring & Observability",
            [
                "monitoring",
                "observability",
                "prometheus",
                "grafana",
                "explainable ai",
                "shap",
                "lime",
            ],
        ),
        ("Additional Topics", []),
    ],
    "cyber-security": [
        (
            "Security Fundamentals & Mindset",
            [
                "fundamental it skills",
                "security skills",
                "understanding risk",
                "cia triad",
                "defense in depth",
                "zero trust",
                "known vs unknown",
                "blue / red / purple",
                "kill chain",
                "diamond model",
                "mitre att&ck",
                "risk management",
                "compliance",
                "iso",
                "nist",
                "cis",
                "csf",
                "legal departments",
                "stakeholders",
                "human resources",
                "management",
                "auditors",
                "roles of compliance",
                "threat intelligence",
                "osint",
            ],
        ),
        (
            "IT & Networking",
            [
                "computer hardware",
                "operating systems",
                "operating system",
                "os versions",
                "installation and configuration",
                "installing software",
                "gui vs. cli",
                "troubleshooting",
                "file crud",
                "basics of computer networking",
                "networking knowledge",
                "subnet",
                "cidr",
                "ip",
                "localhost",
                "loopback",
                "common ports",
                "common protocols",
                "osi model",
                "lan",
                "wan",
                "man",
                "mesh topology",
                "router",
                "switch",
                "default gateway",
                "nat",
                "dhcp",
                "dns",
                "dnssec",
                "arp",
                "ipsec",
                "vpn",
                "wifi",
                "wlan",
                "bluetooth",
                "nfc",
                "handshakes",
                "ssl",
                "tls",
                "key exchange",
                "certificates",
                "pki",
                "network time",
                "netflow",
                "syslogs",
                "netstat",
                "tcpdump",
                "ping",
                "tracert",
                "nslookup",
                "dig",
                "ipconfig",
                "whois",
                "route",
                "hping",
                "nmap",
                "port scanner",
                "protocol analyzer",
                "packet capture",
                "sniffer",
            ],
        ),
        (
            "Linux, Windows & Virtualization",
            [
                "linux",
                "kali linux",
                "parrotos",
                "linux+",
                "bash",
                "command",
                "grep",
                "head",
                "tail",
                "cat",
                "gtfobins",
                "lolbas",
                "iptables",
                "windows",
                "macos",
                "powershell",
                "group policy",
                "event logs",
                "hypervisor",
                "virtual",
                "vmware",
                "virtualbox",
                "esxi",
                "vm",
            ],
        ),
        (
            "Core Security Domains",
            [
                "endpoint security",
                "antivirus",
                "antimalware",
                "edr",
                "hips",
                "host-based firewall",
                "sandboxing",
                "patching",
                "dlp",
                "siem",
                "soar",
                "honeypot",
                "nac",
                "mfa",
                "2fa",
                "single sign-on",
                "ldap",
                "kerberos",
                "radius",
                "authentication",
                "authorization",
                "local authentication",
                "hashing",
                "salting",
                "brute force",
                "password spraying",
                "pass the hash",
            ],
        ),
        (
            "Network, Cloud & Perimeter Security",
            [
                "firewall",
                "ids",
                "ips",
                "nids",
                "nips",
                "dmz",
                "perimeter",
                "segmentation",
                "vlan",
                "port blocking",
                "aws",
                "azure",
                "gcp",
                "cloud skills",
                "cloud security",
                "iaas",
                "paas",
                "saas",
                "public cloud",
                "hybrid cloud",
                "cloud vs",
                "cloud deployment",
                "infrastructure as code",
                "serverless",
            ],
        ),
        (
            "Web & Application Security",
            [
                "owasp",
                "sql injection",
                "xss",
                "csrf",
                "directory traversal",
                "web-based",
                "http",
                "https",
            ],
        ),
        (
            "Offensive Security & Pentesting",
            [
                "penetration testing",
                "rules of engagement",
                "reconnaissance",
                "privilege escalation",
                "buffer overflow",
                "vulnerability management",
                "exploit",
                "hacking tools",
                "hackthebox",
                "tryhackme",
                "pwn.college",
                "picoctf",
                "vulnhub",
                "oscp",
                "ceh",
                "cissp",
                "security+",
                "network+",
                "a+",
                "ccna",
                "gpen",
                "gwapt",
                "gsec",
                "giac",
                "crest",
                "cism",
                "cisa",
            ],
        ),
        (
            "Malware, Forensics & Incident Response",
            [
                "malware",
                "reverse engineering",
                "obfuscation",
                "memory leak",
                "memdump",
                "winhex",
                "autopsy",
                "incident response",
                "preparation",
                "identification",
                "containment",
                "eradication",
                "recovery",
                "lessons learned",
                "digital forensics",
                "ftk imager",
                "dd for incident",
                "runbooks",
                "false negative",
                "true positive",
                "threat hunting",
                "joe sandbox",
                "any.run",
            ],
        ),
        (
            "Social Engineering & Human Security",
            [
                "social engineering",
                "phishing",
                "smishing",
                "whaling",
                "whishing",
                "watering hole",
                "typosquatting",
                "impersonation",
                "shoulder surfing",
                "tailgating",
                "dumpster diving",
                "spam vs spim",
            ],
        ),
        ("Additional Topics", []),
    ],
}


@dataclass(frozen=True)
class MarkdownFile:
    """One topic markdown file from the roadmap.sh repo."""

    name: str
    text: str


@dataclass
class ParsedTopic:
    """Deterministic parse of one topic markdown file."""

    title: str
    brief: str
    links: list[tuple[str, str, str]] = field(default_factory=list)  # (kind, label, url)
    source_file: str = ""


@dataclass(frozen=True)
class RoadmapShSnapshot:
    """In-memory snapshot of the roadmap.sh repository (content dirs only)."""

    files: dict[str, list[MarkdownFile]]
    repository: str = ROADMAP_SH_REPO
    ref: str = "master"
    tarball_url: str = ROADMAP_SH_TARBALL


def _clean_heading(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"#+", "", text)).strip()


def _collapse_repeated_title(title: str) -> str:
    """Collapse accidental doubled words (e.g. 'Evaluation MetricsEvaluation Metrics')."""
    for split in range(len(title) // 2, 0, -1):
        if len(title) % split == 0 and title[:split] == title[split:]:
            return title[:split]
        lower = title.lower()
        if len(lower) % split == 0 and lower[:split] == lower[split:]:
            return title[:split]
    return title


def _derive_title_from_filename(fname: str) -> str:
    stem = fname.split("@", 1)[0]
    words = [w for w in re.split(r"[-_]+", stem) if w]
    return " ".join(words).title() if words else stem


def _clean_title(heading: str, fname: str) -> str:
    title = _collapse_repeated_title(_clean_heading(heading))
    lower = title.lower()
    if (
        not title
        or lower in {"undefined", "none", "n/a", "setting up ________"}
        or "___" in title
    ):
        return _derive_title_from_filename(fname)
    # full-stack 'Checkpoint' placeholders carry real scope in the filename.
    if lower == "checkpoint":
        derived = _derive_title_from_filename(fname)
        if derived.lower() != "checkpoint":
            # The filename itself begins with "checkpoint--"; strip the redundant word.
            words = derived.split()
            if words and words[0].lower() == "checkpoint":
                words = words[1:]
            scope = " ".join(words).strip()
            return f"Checkpoint: {scope}" if scope else "Checkpoint"
        return "Checkpoint"
    return title


def _content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


LINK_LINE = re.compile(r"-\s*\[@(\w+)@(.+?)\]\((https?://[^)\s]+)\)")


def parse_markdown(file: MarkdownFile) -> ParsedTopic | None:
    """Parse one roadmap.sh topic file into title, brief and resource links."""
    lines = file.text.splitlines()
    heading = ""
    body: list[str] = []
    links: list[tuple[str, str, str]] = []
    in_links = False
    for line in lines:
        if line.startswith("#") and not heading:
            heading = line
            continue
        if heading and not in_links:
            stripped = line.strip()
            if not stripped or stripped.lower().startswith("visit the following"):
                continue
            if stripped.startswith("- [@"):
                in_links = True
            else:
                body.append(stripped)
        if in_links:
            match = LINK_LINE.match(line.strip())
            if match:
                links.append((match.group(1), match.group(2).strip(), match.group(3)))
    title = _clean_title(heading, file.name)
    brief = " ".join(body).strip()
    return ParsedTopic(title=title, brief=brief, links=links, source_file=file.name)


def load_snapshot(archive: bytes) -> RoadmapShSnapshot:
    """Extract roadmaps/*/content/*.md from the repository tarball."""
    files: dict[str, list[MarkdownFile]] = {}
    try:
        tar = tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz")
    except tarfile.TarError as exc:  # pragma: no cover - defensive
        raise ValueError(f"ROADMAP_SH_INVALID_ARCHIVE: {exc}") from None
    pattern = re.compile(r"^[^/]+/roadmaps/([^/]+)/content/([^/]+\.md)$")
    with tar:
        for member in tar.getmembers():
            if not member.isfile():
                continue
            match = pattern.match(member.name)
            if not match:
                continue
            slug, fname = match.group(1), match.group(2)
            extracted = tar.extractfile(member)
            if extracted is None:
                continue
            files.setdefault(slug, []).append(
                MarkdownFile(name=fname, text=extracted.read().decode("utf-8", "replace"))
            )
    for entries in files.values():
        entries.sort(key=lambda f: f.name)
    return RoadmapShSnapshot(files=files)


def download_tarball(url: str = ROADMAP_SH_TARBALL, timeout: int = 120) -> bytes:
    """Download the roadmap.sh repository tarball (no GitHub API involved)."""
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read()
    assert isinstance(body, bytes)
    return body


async def fetch_snapshot(
    *,
    tarball_url: str = ROADMAP_SH_TARBALL,
    downloader: Callable[[str], bytes] = download_tarball,
) -> RoadmapShSnapshot:
    """Fetch + extract in a worker thread (network/CPU heavy)."""
    archive = await asyncio.to_thread(downloader, tarball_url)
    return await asyncio.to_thread(load_snapshot, archive)


def _topic_identity(owner_id: str, slug: str, fname: str) -> str:
    digest = uuid.uuid5(
        uuid.NAMESPACE_URL, f"graphmind:roadmapsh:{owner_id}:{slug}:{fname}"
    ).hex
    return f"item_{digest}"


def _source_identity(owner_id: str, slug: str, topic_id: str, url: str) -> str:
    digest = uuid.uuid5(
        uuid.NAMESPACE_URL, f"graphmind:roadmapsh:{owner_id}:{slug}:{topic_id}:{url}"
    ).hex
    return f"src_{digest}"


def deduce_format(title: str) -> Literal["concepts", "practice", "project"]:
    lower = title.lower()
    if any(
        word in lower
        for word in (
            "project",
            "build",
            "create",
            "setup",
            "set up",
            "deploy",
            "implement",
            "tutorial",
            "lab",
            "tool",
            "hands-on",
        )
    ):
        return "project"
    if any(
        word in lower
        for word in ("practice", "exercise", "testing", "quiz", "workshop", "configure")
    ):
        return "practice"
    return "concepts"


def estimate_minutes(title: str) -> int:
    return 270 if deduce_format(title) == "project" else 180


def objectives_from_brief(brief: str, title: str) -> list[str]:
    sentences = [re.sub(r"\s+", " ", s).strip() for s in re.split(r"(?<=[.!?])\s+", brief)]
    objectives = [s for s in sentences if len(s) >= 30][:3]
    cleaned = [s[:470] for s in objectives]
    if not cleaned:
        cleaned = [f"Understand the core concepts of {title}."]
    return cleaned


def exercise_for(title: str, brief: str, format_: str) -> str:
    del brief  # unused; kept for a stable signature
    resources_hint = "Work through the linked resources for this topic"
    if format_ == "project":
        return (
            f"{resources_hint} and then build a small project that applies {title}. "
            "Document the outcome and note what you learned."
        )
    if format_ == "practice":
        return (
            f"{resources_hint} and practice the techniques until they feel routine. "
            "Write down one worked example from memory."
        )
    return (
        f"{resources_hint}, then summarise in your own words what {title} is and when "
        "it is used. Explain it to someone else to confirm your understanding."
    )


def group_into_phases(
    slug: str, topics: list[ParsedTopic]
) -> list[tuple[str, list[ParsedTopic]]]:
    """Deterministically bucket topics into ordered phases using curated keywords."""
    rules = PHASE_RULES.get(slug, [])
    buckets: list[tuple[str, list[ParsedTopic]]] = [(title, []) for title, _ in rules]
    for topic in topics:
        lowered = topic.title.lower()
        placed = False
        for index, (_, keywords) in enumerate(rules):
            if keywords and any(keyword in lowered for keyword in keywords):
                buckets[index][1].append(topic)
                placed = True
                break
        if not placed:
            buckets[-1][1].append(topic)
    return [(title, entries) for title, entries in buckets if entries]


def _phase_brief(slug: str, title: str, count: int) -> str:
    field = CURATED_FIELDS[slug]["title"]
    return f"{count} topics grouped under {title} from the roadmap.sh {field}."


def build_candidate(
    *,
    owner_id: str,
    slug: str,
    topics_by_phase: list[tuple[str, list[ParsedTopic]]],
    snapshot: RoadmapShSnapshot,
) -> tuple[CurriculumCandidate, list[SourceData], LearningProfile]:
    """Synthesize a fully validated candidate, sources and profile (no AI)."""
    field_title = CURATED_FIELDS[slug]["title"]
    items: list[CurriculumItemData] = []
    relations: list[CurriculumRelationData] = []
    resources: list[ResourceData] = []
    sources: list[SourceData] = []
    now = datetime.now(timezone.utc)

    root_id = _topic_identity(owner_id, slug, "_root")
    items.append(
        CurriculumItemData(
            id=root_id,
            kind="root",
            title=field_title,
            brief=field_title,
            objectives=[f"Follow the {field_title} to become proficient."],
            exercise=None,
            format=None,
            order=0,
            path="core",
            estimate_minutes=None,
            participation="active",
        )
    )

    order = 1
    total_topics = 0
    active_topics = 0

    for phase_index, (phase_title, phase_topics) in enumerate(topics_by_phase, start=1):
        phase_id = _topic_identity(owner_id, slug, f"_phase_{phase_index}")
        items.append(
            CurriculumItemData(
                id=phase_id,
                kind="phase",
                title=phase_title,
                brief=_phase_brief(slug, phase_title, len(phase_topics)),
                objectives=[f"Complete the {phase_title} topics."],
                exercise=None,
                format=None,
                order=order,
                path="core",
                estimate_minutes=None,
                participation="active",
            )
        )
        relations.append(
            CurriculumRelationData(source_id=root_id, target_id=phase_id, kind="contains")
        )
        order += 1

        for topic in phase_topics:
            topic_id = _topic_identity(owner_id, slug, topic.source_file)
            allowed = active_topics < MAX_COVERAGE_TOPICS
            participation: Literal["active", "archived"] = "active" if allowed else "archived"
            if allowed:
                active_topics += 1
            total_topics += 1
            format_ = deduce_format(topic.title) if allowed else None
            items.append(
                CurriculumItemData(
                    id=topic_id,
                    kind="topic",
                    title=topic.title,
                    brief=topic.brief[:4000] or f"Learn the fundamentals of {topic.title}.",
                    objectives=objectives_from_brief(topic.brief, topic.title),
                    exercise=exercise_for(topic.title, topic.brief, format_) if format_ else None,
                    format=format_,
                    order=order,
                    path="core",
                    estimate_minutes=estimate_minutes(topic.title) if allowed else None,
                    participation=participation,
                )
            )
            relations.append(
                CurriculumRelationData(source_id=phase_id, target_id=topic_id, kind="contains")
            )
            order += 1
            if not allowed:
                continue

            # Resource links unique by URL within a topic (dedupe source rows).
            seen_urls: set[str] = set()
            curated_links: list[tuple[str, str, str]] = []
            for kind, label, url in topic.links:
                if url not in seen_urls:
                    seen_urls.add(url)
                    curated_links.append((kind, label, url))
                if len(curated_links) >= 2:
                    break
            if not curated_links:
                curated_links = [("official", field_title, f"{ROADMAP_SH_SITE}/{slug}")]
            for position, (kind, label, url) in enumerate(curated_links):
                source_id = _source_identity(owner_id, slug, topic_id, url)
                sources.append(
                    SourceData(
                        id=source_id,
                        title=label[:1000],
                        url=url[:2048],
                        reference_id=None,
                        locator=topic.source_file,
                        verified_at=now,
                        status="grounded",
                        access="free",
                        kind=RESOURCE_KIND.get(kind, "reference"),
                        evidence=topic.brief[:32768] or f"Curated resource for {topic.title}.",
                        provenance={
                            "source": "roadmap.sh",
                            "repository": snapshot.repository,
                            "ref": snapshot.ref,
                            "topicFile": topic.source_file,
                        },
                    )
                )
                resources.append(
                    ResourceData(
                        topic_id=topic_id,
                        source_id=source_id,
                        order=position,
                        rationale=(
                            f"roadmap.sh links this resource for learning {topic.title}."
                            if len(curated_links) > 1
                            else f"Primary roadmap.sh resource for learning {topic.title}."
                        ),
                    )
                )

    profile = LearningProfile(
        title=field_title,
        prompt=f"Follow the roadmap.sh {field_title} to become an expert in {field_title}.",
        level="beginner",
        background=None,
        duration=None,
        hours_per_week=None,
        study_weeks=None,
        weekly_minutes=None,
        outcome=(
            f"Become an expert in {field_title} by following the curated roadmap.sh "
            f"syllabus, covering {total_topics} topics."
        ),
        assumptions=[
            f"Content imported from the roadmap.sh {field_title} "
            f"({snapshot.repository}, ref {snapshot.ref}).",
            "This is a self-paced syllabus; time estimates are approximate.",
            "Generated deterministically without an AI model.",
        ],
        known_skills=[],
    )

    candidate = CurriculumCandidate(
        title=field_title,
        outcome=profile.outcome,
        assumptions=profile.assumptions,
        items=items,
        relations=relations,
        choices=[],
        sessions=[],
        resources=resources,
    )
    return candidate, sources, profile


def _validation_errors(
    candidate: CurriculumCandidate, profile: LearningProfile, sources: list[SourceData]
) -> list[str]:
    report = validate_curriculum(candidate, profile, sources)
    return [issue.message for issue in report.issues if issue.severity == "error"]


async def find_existing_import(session: AsyncSession, owner_id: str, slug: str) -> str | None:
    """Return the workspace id of a prior import of this slug for this owner, if any."""
    from models.roadmap import Roadmap
    from models.workspace import Workspace

    anchors = (
        await session.scalars(
            select(NodeModel)
            .join(Workspace, Workspace.id == NodeModel.workspace_id)
            .where(
                Workspace.owner_id == owner_id,
                NodeModel.role == "system",
            )
            .limit(200)
        )
    ).all()
    for anchor in anchors:
        metadata = anchor.metadata_payload or {}
        if (
            metadata.get("kind") == "roadmap_anchor"
            and metadata.get("importSource") == "roadmap.sh"
            and metadata.get("importSlug") == slug
        ):
            roadmap = await session.scalar(
                select(Roadmap).where(Roadmap.workspace_id == anchor.workspace_id)
            )
            if roadmap is not None:
                workspace_id: str | None = anchor.workspace_id
                return workspace_id
    return None


async def import_slug(
    session: AsyncSession,
    *,
    owner_id: str,
    slug: str,
    snapshot: RoadmapShSnapshot,
) -> tuple[CurriculumView, Literal["created", "existing"]]:
    """Import one roadmap.sh field into a fresh workspace (caller owns commit)."""
    existing_workspace = await find_existing_import(session, owner_id, slug)
    if existing_workspace is not None:
        repository = CurriculumRepository(session, reader_id=owner_id)
        view = await repository.read(existing_workspace)
        if view is not None:
            return view, "existing"

    files = snapshot.files.get(slug)
    if not files:
        raise ValueError(f"ROADMAP_SH_SLUG_UNAVAILABLE: {slug}")

    parsed: list[ParsedTopic] = []
    seen_hashes: set[str] = set()
    for file in files:
        topic = parse_markdown(file)
        if topic is None:
            continue
        digest = _content_hash(file.text)
        if digest in seen_hashes:
            continue
        seen_hashes.add(digest)
        parsed.append(topic)

    topics_by_phase = group_into_phases(slug, parsed)
    if not topics_by_phase:
        raise ValueError(f"ROADMAP_SH_NO_TOPICS: {slug}")

    candidate, sources, profile = build_candidate(
        owner_id=owner_id,
        slug=slug,
        topics_by_phase=topics_by_phase,
        snapshot=snapshot,
    )
    errors = _validation_errors(candidate, profile, sources)
    if errors:
        raise ValueError("ROADMAP_SH_INVALID: " + "; ".join(errors)[:800])

    workspace = await WorkspaceService.create_workspace(
        session,
        WorkspaceCreate(name=candidate.title, description=candidate.outcome),
        owner_id=owner_id,
    )
    anchor = NodeModel(
        id=new_id("node"),
        workspace_id=workspace.id,
        role="system",
        content=candidate.title,
        metadata_payload={
            "kind": "roadmap_anchor",
            "title": candidate.title,
            "importSource": "roadmap.sh",
            "importSlug": slug,
            "repository": snapshot.repository,
            "ref": snapshot.ref,
            "importedAt": datetime.now(timezone.utc).isoformat(),
        },
    )
    session.add(anchor)
    await session.flush()
    view = await CurriculumRepository(session, reader_id=owner_id).create(
        owner_id,
        workspace.id,
        anchor.id,
        profile,
        candidate,
        sources,
        validate_curriculum(candidate, profile, sources),
    )
    logger.info(
        "roadmap.sh curriculum imported",
        slug=slug,
        workspace_id=workspace.id,
        roadmap_id=view.roadmap_id,
        topics=len([i for i in candidate.items if i.kind == "topic"]),
    )
    return view, "created"


async def import_roadmaps(
    session: AsyncSession,
    *,
    owner_id: str,
    slugs: list[str],
    tarball_url: str = ROADMAP_SH_TARBALL,
    downloader: Callable[[str], bytes] | None = None,
) -> tuple[list[dict[str, str | int]], list[dict[str, str]]]:
    """Import several slugs; one transaction per slug, failures isolated."""
    snapshot = await fetch_snapshot(
        tarball_url=tarball_url,
        downloader=downloader or download_tarball,
    )
    results: list[dict[str, str | int]] = []
    errors: list[dict[str, str]] = []
    for slug in slugs:
        if slug not in CURATED_FIELDS:
            errors.append({"slug": slug, "error": "UNKNOWN_FIELD"})
            continue
        try:
            view, status = await import_slug(
                session, owner_id=owner_id, slug=slug, snapshot=snapshot
            )
            await session.commit()
        except Exception as exc:  # noqa: BLE001 - isolate per-slug failures
            await session.rollback()
            errors.append({"slug": slug, "error": str(exc)[:500]})
            continue
        results.append(
            {
                "slug": slug,
                "title": view.candidate.title,
                "status": status,
                "workspace_id": view.workspace_id,
                "roadmap_id": view.roadmap_id,
                "revision_id": view.revision_id,
                "topic_count": len(
                    [
                        i
                        for i in view.candidate.items
                        if i.kind == "topic" and i.participation == "active"
                    ]
                ),
            }
        )
    return results, errors
