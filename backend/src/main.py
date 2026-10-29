import os
import uuid
from datetime import datetime
from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import create_engine, desc
from sqlalchemy.orm import sessionmaker, Session
from .models import Base, WorkflowDefinition, Claim, WorkflowInstance, Task
from .workflow_engine import WorkflowEngine, seed_zurich_workflow

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "data")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend", "static")
DATABASE_URL = f"sqlite:///{os.path.join(DATA_DIR, 'app.db')}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_zurich_workflow(db)
    db.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def serialize_claim(c: Claim) -> dict:
    return {
        "id": c.id,
        "claim_number": c.claim_number,
        "claim_type": c.claim_type,
        "description": c.description,
        "amount": c.amount,
        "status": c.status,
        "priority": c.priority,
        "insured_name": c.insured_name,
        "insured_email": c.insured_email,
        "incident_date": c.incident_date,
        "policy_number": c.policy_number,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


app = FastAPI(title="Zurich Insurance LC/NC Platform", version="1.0.0")
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


class WorkflowSaveRequest(BaseModel):
    name: str
    description: str = ""
    definition: dict


class ClaimCreate(BaseModel):
    claim_type: str
    description: str = ""
    amount: int = 0
    insured_name: str = ""
    insured_email: str = ""
    incident_date: str = ""
    policy_number: str = ""
    priority: str = "normal"


class TaskActionRequest(BaseModel):
    action: str
    user: str = "claims.analyst"


@app.get("/", response_class=HTMLResponse)
async def root():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


@app.get("/api/workflow")
def list_workflows(db: Session = Depends(get_db)):
    wfs = db.query(WorkflowDefinition).all()
    return [{"id": wf.id, "name": wf.name, "description": wf.description,
             "created_at": wf.created_at.isoformat() if wf.created_at else None,
             "updated_at": wf.updated_at.isoformat() if wf.updated_at else None} for wf in wfs]


@app.get("/api/workflow/{workflow_id}")
def get_workflow(workflow_id: str, db: Session = Depends(get_db)):
    engine = WorkflowEngine(db)
    wf = engine.get_workflow(workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return wf


@app.post("/api/workflow/{workflow_id}")
def save_workflow(workflow_id: str, payload: WorkflowSaveRequest, db: Session = Depends(get_db)):
    engine = WorkflowEngine(db)
    wf = engine.save_workflow(workflow_id, payload.name, payload.description, payload.definition)
    return {"id": wf.id, "name": wf.name, "message": "Workflow saved"}


@app.post("/api/workflow/create")
def create_workflow(payload: WorkflowSaveRequest, db: Session = Depends(get_db)):
    workflow_id = payload.definition.get("id") or str(uuid.uuid4())
    engine = WorkflowEngine(db)
    wf = engine.save_workflow(workflow_id, payload.name, payload.description, payload.definition)
    return {"id": wf.id, "name": wf.name, "message": "Workflow created"}


@app.get("/api/claims")
def list_claims(db: Session = Depends(get_db)):
    claims = db.query(Claim).order_by(desc(Claim.created_at)).all()
    return [serialize_claim(c) for c in claims]


@app.post("/api/claims")
def create_claim(payload: ClaimCreate, db: Session = Depends(get_db)):
    claim = Claim(
        id=str(uuid.uuid4()),
        claim_number=f"CLM-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}",
        claim_type=payload.claim_type,
        description=payload.description,
        amount=payload.amount,
        insured_name=payload.insured_name,
        insured_email=payload.insured_email,
        incident_date=payload.incident_date,
        policy_number=payload.policy_number,
        priority=payload.priority,
        status="submitted",
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)

    workflow_engine = WorkflowEngine(db)
    try:
        instance = workflow_engine.start_workflow(claim.id, "zurich-claims-v1")
        return {
            "claim": serialize_claim(claim),
            "instance_id": instance.id,
            "workflow_status": instance.status,
            "current_node": instance.current_node,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/claims/{claim_id}")
def get_claim(claim_id: str, db: Session = Depends(get_db)):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    instance = db.query(WorkflowInstance).filter(WorkflowInstance.claim_id == claim_id).first()
    engine = WorkflowEngine(db)
    instance_state = engine.get_instance_state(instance.id) if instance else None
    return {
        "claim": serialize_claim(claim),
        "workflow": instance_state,
    }


@app.get("/api/tasks")
def list_tasks(db: Session = Depends(get_db)):
    tasks = db.query(Task).filter(Task.status == "pending").order_by(Task.created_at).all()
    return [{
        "id": t.id,
        "instance_id": t.instance_id,
        "claim_id": t.instance.claim_id if t.instance else None,
        "node_id": t.node_id,
        "node_name": t.node_name,
        "task_type": t.task_type,
        "assignee": t.assignee,
        "status": t.status,
        "variables": t.variables,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    } for t in tasks]


@app.get("/api/tasks/{task_id}")
def get_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return {
        "id": task.id,
        "instance_id": task.instance_id,
        "claim_id": task.instance.claim_id if task.instance else None,
        "node_id": task.node_id,
        "node_name": task.node_name,
        "task_type": task.task_type,
        "assignee": task.assignee,
        "status": task.status,
        "variables": task.variables,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "updated_at": task.updated_at.isoformat() if task.updated_at else None,
    }


@app.post("/api/tasks/{task_id}/action")
def handle_task_action(task_id: str, payload: TaskActionRequest, db: Session = Depends(get_db)):
    engine = WorkflowEngine(db)
    result = engine.handle_task_action(task_id, payload.action, payload.user)
    return result


@app.get("/api/dashboard/stats")
def dashboard_stats(db: Session = Depends(get_db)):
    total_claims = db.query(Claim).count()
    by_status = {}
    for c in db.query(Claim).all():
        by_status[c.status] = by_status.get(c.status, 0) + 1
    pending_tasks = db.query(Task).filter(Task.status == "pending").count()
    active_instances = db.query(WorkflowInstance).filter(WorkflowInstance.status == "running").count()
    completed_instances = db.query(WorkflowInstance).filter(WorkflowInstance.status == "completed").count()
    total_workflows = db.query(WorkflowDefinition).count()

    recent_claims = db.query(Claim).order_by(desc(Claim.created_at)).limit(10).all()
    recent = [serialize_claim(c) for c in recent_claims]

    return {
        "total_claims": total_claims,
        "claims_by_status": by_status,
        "pending_tasks": pending_tasks,
        "active_workflows": active_instances,
        "completed_workflows": completed_instances,
        "total_workflows": total_workflows,
        "recent_claims": recent,
    }


@app.get("/api/workflows/{workflow_id}/instances")
def workflow_instances(workflow_id: str, db: Session = Depends(get_db)):
    instances = db.query(WorkflowInstance).filter(WorkflowInstance.workflow_id == workflow_id).all()
    return [{
        "id": i.id,
        "claim_id": i.claim_id,
        "status": i.status,
        "current_node": i.current_node,
        "variables": i.variables,
        "created_at": i.created_at.isoformat() if i.created_at else None,
        "completed_at": i.completed_at.isoformat() if i.completed_at else None,
    } for i in instances]


@app.on_event("startup")
def startup():
    init_db()
