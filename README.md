# Zurich Insurance LC/NC Claims Platform

A **low-code/no-code** prototype application built for the Zurich Insurance Appian case study. This platform demonstrates visual workflow design and automated insurance claims processing — inspired by Zurich Insurance's digital transformation using Appian low-code technology.

![Demo](https://img.shields.io/badge/Status-Running-brightgreen)
![Python](https://img.shields.io/badge/Python-3.11+-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-ff6b2b)
![License](https://img.shields.io/badge/License-Educational-lightgrey)

---

## Table of Contents

1. [Case Study Background](#case-study-background)
2. [Architecture](#architecture)
3. [Features](#features)
4. [Workflow Design](#workflow-design)
5. [Installation](#installation)
6. [Usage](#usage)
7. [API Reference](#api-reference)
8. [Data Model](#data-model)
9. [Business Rules](#business-rules)

---

## Case Study Background

This prototype is based on a student case study analyzing Zurich Insurance's adoption of Appian, a low-code platform, for digital process modernisation.

**Key insights from the case study:**

| Slide | Topic | Insight |
|-------|-------|---------|
| 1 | Case Study | Zurich Insurance — global insurer using Appian low-code platform |
| 2 | Transformation Goal | Low-code/no-code digital transformation of claims processes |
| 3 | Business Challenges | Complex processes, disconnected systems, manual activities, slow change cycles |
| 4 | Pain Points | Process complexity → operational risk; Manual effort → cost/errors; Limited agility → unable to meet market/regulatory needs |
| 5 | Why Low-Code | Faster delivery, business-IT collaboration, adaptability |
| 6 | Why Appian | Low-code development, process automation & orchestration, data & systems integration, case management & rules |
| 7 | Solution | Visual workflow builder, automated tasks, human task routing, integration |
| 8 | Process Flow | Business Request → Workflow → Automated Tasks → Human Approval → Outcome/Close |
| 9 | Impact | Improved efficiency, enhanced UX, greater agility |

---

## Architecture

```
zurich-insurance-lcnc-prototype/
├── run.py                              # Entry point — starts the server
├── seed_data.py                        # Generates 25 synthetic claims
├── requirements.txt                    # Python dependencies
├── backend/
│   ├── requirements.txt
│   └── src/
│       ├── __init__.py
│       ├── main.py                     # FastAPI app + REST API endpoints
│       ├── models.py                   # SQLAlchemy data models
│       └── workflow_engine.py          # BPM-style workflow execution engine
└── frontend/
    └── static/
        ├── index.html                  # SPA shell (navigation + views)
        ├── style.css                   # Dark theme UI (~600 lines)
        └── app.js                      # Interactive UI + visual designer (~1100 lines)
```

### Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.x, SQLite |
| Frontend | Vanilla HTML/CSS/JavaScript (no framework) |
| Template Engine | Jinja2-style inline HTML (via FastAPI) |
| Data Storage | SQLite (file-based, no setup needed) |

### Design Philosophy

- **Single-page application (SPA)** — all frontend logic runs in the browser with no page reloads
- **Self-contained** — no npm install required; the backend serves both the API and static files
- **Low-code/no-code** — the workflow designer lets business users build claims processes visually without writing code

---

## Features

### 1. Workflow Designer (Low-Code Platform)

A visual, drag-and-drop canvas for building business process workflows:

- **Node Library** (left sidebar): Drag nodes onto the canvas
  - 🟢 **Start Event** — workflow trigger (e.g., "Business Request")
  - ⚙️ **Service Task** — automated processing (validation, fraud check, payout)
  - 👤 **User Task** — human work item (review/approval)
  - 🔀 **Gateway** — decision point with conditional routing
  - ⏹ **End Event** — workflow conclusion (e.g., "Closed - Paid")

- **Canvas** (center): Place, drag, and connect nodes
  - Drag nodes to reposition them
  - 🔗 **Connect Mode**: Click a source node, then a target node to draw an edge
  - Edge conditions (e.g., `{risk} == 'high'`) render as labels
  - Selected edges highlight; click to edit conditions
  - Delete nodes (with cascade edge removal) and edges individually

- **Properties Panel** (right sidebar):
  - Edit node name, type, task type, assignee
  - Edit edge conditions
  - Node position tracking

- **Toolbar**: Save workflow, export as JSON, reset to default

### 2. Claims Management Application

An insurance claims processing application built on the workflow engine:

- **Claim Submission**: Form with 6 claim types (fire, flood, theft, accident, windstorm, water damage)
- **Automated Workflow Execution**: Validation → Fraud Check → Human Review → Decision → Payout
- **Human Task Routing**: Claims requiring review appear in the task queue
- **Real-time Visualization**: See workflow progress with node status coloring
- **Full Audit Trail**: Every step recorded with timestamp and result

### 3. Dashboard

- Live statistics: total claims, active/completed workflows, pending tasks
- Claims breakdown by status
- Recent claims table with quick view links

### 4. Task Work Queue

- List of pending human review tasks
- Approve or reject with one click
- View associated claim details
- Task variables displayed for context

---

## Workflow Design

### Pre-loaded Workflow: Zurich Claims Processing

```
                    ┌──────────────────┐
                    │  Business Request │  (Start)
                    │   [Start Event]    │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │ Automated Validation│  (Service Task)
                    │  task_type: validate│
                    └───┬───────────┬─────┘
                        │           │
                  valid=True       valid=False
                        │           │
              ┌─────────▼──────┐   ┌─▼────────────────────┐
              │ Fraud Check    │   │ Rejected - Incomplete  │
              │(Service Task)  │   │       [End Event]      │
              └─────┬──────────┘   └────────────────────────┘
                    │
          ┌─────────▼────────┐
          │ Fraud Risk?       │  (Gateway)
          └────┬──────┬───────┘
               │      │
         risk=low  risk=high
               │      │
    ┌──────────▼───┐  ┌─▼────────────────────────┐
    │ Human Review │  │ Rejected - Fraud         │
    │ (User Task)  │  │   [End Event]            │
    └──────┬───────┘  └──────────────────────────┘
           │
    ┌──────▼────────┐
    │ Approved?      │  (Gateway)
    └┬───────┬───────┘
     │       │
 approved=True  approved=False
     │       │
┌────▼──────┐ ┌─▼───────────────────────────┐
│Payout Calc│ │ Rejected - Not Approved      │
│(Service)  │ │     [End Event]              │
└────┬──────┘ └──────────────────────────────┘
     │
┌────▼──────────────┐
│ Generate Payout   │  (Service Task)
│  (Service Task)   │
└────┬──────────────┘
     │
┌────▼────────────┐
│ Closed - Paid    │  (End Event)
│   [End Event]    │
└─────────────────┘
```

### Workflow Paths (4 possible outcomes)

| # | Trigger | Path | Outcome |
|---|---------|------|---------|
| 1 | Incomplete form (missing fields) | Start → Validation → Gateway (invalid) → End | **Rejected - Incomplete** |
| 2 | High-risk type + amount > $50k | Start → Validation → Gateway → Fraud Check → Gateway (high) → End | **Rejected - Fraud** |
| 3 | Low-risk + analyst approves | Start → Validation → Gateway → Fraud Check → Gateway → Review → Gateway → Payout → Payout Gen → End | **Closed - Paid** |
| 4 | Low-risk + analyst rejects | Start → Validation → Gateway → Fraud Check → Gateway → Review → Gateway (rejected) → End | **Rejected - Not Approved** |

---

## Installation

### Prerequisites
- Python 3.11+
- pip

### Steps

```bash
# 1. Clone or navigate to the project directory
cd zurich-insurance-lcnc-prototype

# 2. Create a virtual environment
python -m venv .venv
source .venv/bin/activate     # Linux/macOS
# .venv\Scripts\activate      # Windows

# 3. Install dependencies
pip install -r backend/requirements.txt

# 4. Run the application
python run.py
```

The server starts on `http://localhost:8000`.

### Alternative (without virtualenv)
```bash
pip install fastapi uvicorn[standard] sqlalchemy pydantic
python run.py
```

---

## Usage

### Starting the Application

```bash
python run.py
```

Open `http://localhost:8000` in a modern browser (Chrome/Firefox/Safari/Edge).

### Generating Test Data

The seed script creates 25 synthetic claims across all workflow paths:

```bash
python seed_data.py
```

Distribution after seeding:
- 5 claims → Closed - Paid (approved)
- 4 claims → Rejected - Fraud (auto-rejected)
- 3 claims → Rejected - Incomplete (auto-rejected)
- 13 claims → submitted (pending human review)

### Navigation

| View | URL Path | Description |
|------|----------|-------------|
| Dashboard | `/` | Overview with statistics and recent claims |
| Claims | Click "Claims" nav | Full claims list with filtering |
| Designer | Click "Workflow Designer" nav | Visual workflow builder |
| Tasks | Click "Task Queue" nav | Pending human review tasks |

### Using the Workflow Designer

1. **Add nodes**: Drag from the palette on the left onto the canvas
2. **Connect nodes**: Click 🔗 to enter connect mode, then click source → target
3. **Move nodes**: Click and drag any node on the canvas
4. **Edit properties**: Click a node or edge to open the properties panel
5. **Save**: Click 💾 to persist the workflow, 📤 to export as JSON, 🔄 to reset

### Processing Claims

1. Click "+ New Claim" on the Dashboard
2. Select claim type, fill in details, and submit
3. If the claim is high-risk (e.g., fire + amount > $50,000), it's auto-rejected
4. If incomplete, it's auto-rejected for missing fields
5. If low-risk, it appears in the Task Queue for review
6. Click ✓ Approve or ✗ Reject to process

---

## API Reference

All endpoints are prefixed with `/api`.

### Workflows

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workflow` | List all workflow definitions |
| GET | `/api/workflow/{id}` | Get a specific workflow definition |
| POST | `/api/workflow/{id}` | Save/update a workflow definition |
| POST | `/api/workflow/create` | Create a new workflow definition |

### Claims

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/claims` | List all claims |
| POST | `/api/claims` | Create a new claim (starts workflow) |
| GET | `/api/claims/{id}` | Get claim details + workflow state |

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List pending tasks |
| GET | `/api/tasks/{id}` | Get task details |
| POST | `/api/tasks/{id}/action` | Execute task action (approve/reject) |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Dashboard statistics |
| GET | `/api/workflows/{id}/instances` | List workflow instances |

---

## Data Model

### WorkflowDefinition
| Field | Type | Description |
|-------|------|-------------|
| id | string | Primary key |
| name | string | Display name |
| description | text | Long description |
| definition | JSON | Full node/edge graph |

### Claim
| Field | Type | Description |
|-------|------|-------------|
| id | string | Primary key (UUID) |
| claim_number | string | Human-readable number (CLM-YYYYMMDD-XXXXXX) |
| claim_type | string | fire, flood, theft, accident, windstorm, water_damage |
| amount | integer | Claim amount in dollars |
| status | string | Current claim status |
| priority | string | low, normal, high, urgent |
| insured_name | string | Policyholder name |
| policy_number | string | Policy reference |

### WorkflowInstance
| Field | Type | Description |
|-------|------|-------------|
| id | string | Primary key (UUID) |
| claim_id | string | FK to Claim |
| workflow_id | string | FK to WorkflowDefinition |
| status | string | running, completed |
| current_node | string | Current executing node |
| variables | JSON | Workflow variables |
| history | JSON | Execution audit trail |

### Task
| Field | Type | Description |
|-------|------|-------------|
| id | string | Primary key (UUID) |
| instance_id | string | FK to WorkflowInstance |
| node_id | string | Workflow node ID |
| assignee | string | Responsible user |
| status | string | pending, completed |
| variables | JSON | Snapshot of workflow variables |

---

## Business Rules

### Validation (Service Task)
A claim is valid if all required fields are present:
- `insured_name` (non-empty string)
- `claim_type` (non-empty string)
- `description` (non-empty string)
- `amount` (greater than 0)
- `policy_number` (non-empty string)

If any field is missing, the claim is rejected as "Incomplete".

### Fraud Check (Service Task)
- **High-risk claim types**: fire, flood, theft, accident
- **High fraud risk**: high-risk type AND amount > $50,000
- High-risk claims are auto-rejected as "Rejected - Fraud"
- Low-risk claims proceed to human review

### Payout Calculation (Service Task)
- Payout amount = claim amount
- References are generated as `PAY-` + 8-character hex

---

## Acknowledgments

This prototype was created as an educational project based on a student case study analyzing Zurich Insurance's use of the Appian low-code platform for digital process modernisation.
