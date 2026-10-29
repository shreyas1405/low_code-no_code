import json
import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from .models import WorkflowDefinition, WorkflowInstance, Task, Claim


class WorkflowEngine:
    def __init__(self, db: Session):
        self.db = db

    def get_workflow(self, workflow_id: str) -> dict:
        wf = self.db.query(WorkflowDefinition).filter(
            WorkflowDefinition.id == workflow_id
        ).first()
        if not wf:
            return None
        return wf.definition | {"id": wf.id, "name": wf.name, "description": wf.description}

    def save_workflow(self, workflow_id: str, name: str, description: str, definition: dict) -> WorkflowDefinition:
        wf = self.db.query(WorkflowDefinition).filter(
            WorkflowDefinition.id == workflow_id
        ).first()
        if wf:
            wf.name = name
            wf.description = description
            wf.definition = definition
            wf.updated_at = datetime.utcnow()
        else:
            wf = WorkflowDefinition(
                id=workflow_id,
                name=name,
                description=description,
                definition=definition,
            )
            self.db.add(wf)
        self.db.commit()
        self.db.refresh(wf)
        return wf

    def start_workflow(self, claim_id: str, workflow_id: str) -> WorkflowInstance:
        wf_def = self.get_workflow(workflow_id)
        if not wf_def:
            raise ValueError(f"Workflow {workflow_id} not found")

        instance = WorkflowInstance(
            id=str(uuid.uuid4()),
            claim_id=claim_id,
            workflow_id=workflow_id,
            status="running",
            current_node="",
            variables={},
            history=[],
        )
        self.db.add(instance)
        self.db.commit()
        self.db.refresh(instance)

        start_nodes = [n for n in wf_def["nodes"] if n["type"] == "start"]
        if not start_nodes:
            raise ValueError("Workflow has no start node")

        self._execute_node(instance, start_nodes[0], wf_def)
        self.db.commit()
        return instance

    def _get_node(self, definition: dict, node_id: str) -> dict:
        for n in definition["nodes"]:
            if n["id"] == node_id:
                return n
        return None

    def _get_outgoing_edges(self, definition: dict, node_id: str) -> list:
        return [e for e in definition.get("edges", []) if e["source"] == node_id]

    def _record_history(self, instance: WorkflowInstance, node_id: str, node_name: str, action: str, result: str = ""):
        history = instance.history or []
        history.append({
            "timestamp": datetime.utcnow().isoformat(),
            "node_id": node_id,
            "node_name": node_name,
            "action": action,
            "result": result,
        })
        instance.history = history
        flag_modified(instance, "history")

    def _evaluate_condition(self, condition: str, instance: WorkflowInstance) -> bool:
        if not condition:
            return True
        variables = instance.variables or {}
        expr = condition
        for key, val in variables.items():
            if isinstance(val, str):
                expr = expr.replace(f"{{{key}}}", f"'{val}'")
            else:
                expr = expr.replace(f"{{{key}}}", str(val))
        try:
            return bool(eval(expr, {"__builtins__": {}}, {}))
        except Exception:
            return True

    def _run_service_task(self, task_type: str, instance: WorkflowInstance, node: dict) -> dict:
        if task_type == "validate_claim":
            return self._validate_claim(instance)
        elif task_type == "fraud_check":
            return self._fraud_check(instance)
        elif task_type == "calculate_payout":
            return self._calculate_payout(instance)
        elif task_type == "generate_payout":
            return self._generate_payout(instance)
        return {}

    def _validate_claim(self, instance: WorkflowInstance) -> dict:
        claim = self.db.query(Claim).filter(Claim.id == instance.claim_id).first()
        required = ["insured_name", "claim_type", "description", "amount", "policy_number"]
        missing = [f for f in required if not getattr(claim, f, "") or getattr(claim, f) == 0]
        is_valid = len(missing) == 0
        return {"valid": is_valid, "missing_fields": missing}

    def _fraud_check(self, instance: WorkflowInstance) -> dict:
        claim = self.db.query(Claim).filter(Claim.id == instance.claim_id).first()
        high_risk_types = ["fire", "flood", "theft", "accident"]
        high_risk = claim.claim_type.lower() in high_risk_types and claim.amount > 50000
        risk = "high" if high_risk else "low"
        return {"risk": risk}

    def _calculate_payout(self, instance: WorkflowInstance) -> dict:
        claim = self.db.query(Claim).filter(Claim.id == instance.claim_id).first()
        payout = claim.amount
        return {"payout_amount": payout}

    def _generate_payout(self, instance: WorkflowInstance) -> dict:
        return {"payout_reference": f"PAY-{uuid.uuid4().hex[:8].upper()}"}

    def _execute_node(self, instance: WorkflowInstance, node: dict, definition: dict):
        node_id = node["id"]
        node_name = node.get("name", node_id)
        node_type = node["type"]

        instance.current_node = node_id
        self._record_history(instance, node_id, node_name, f"entered_{node_type}")

        if node_type == "start":
            self._follow_edge(instance, definition, node)

        elif node_type == "service_task":
            result = self._run_service_task(node.get("task_type", ""), instance, node)
            if result:
                instance.variables = instance.variables or {}
                instance.variables.update(result)
                instance.variables[f"_{node_id}_result"] = result
                flag_modified(instance, "variables")
            self._record_history(instance, node_id, node_name, "executed", json.dumps(result))
            self._follow_edge(instance, definition, node)

        elif node_type == "user_task":
            task = Task(
                id=str(uuid.uuid4()),
                instance_id=instance.id,
                node_id=node_id,
                node_name=node_name,
                task_type=node.get("task_type", "approval"),
                assignee=node.get("assignee", "unassigned"),
                status="pending",
                variables=instance.variables or {},
            )
            self.db.add(task)
            self._record_history(instance, node_id, node_name, "task_created", task.id)
            self.db.commit()
            return

        elif node_type == "gateway":
            self._evaluate_gateway(instance, definition, node)

        elif node_type == "end":
            instance.status = "completed"
            instance.current_node = ""
            self._record_history(instance, node_id, node_name, "completed")
            claim = self.db.query(Claim).filter(Claim.id == instance.claim_id).first()
            if claim:
                claim.status = node_name
                claim.updated_at = datetime.utcnow()
            self.db.commit()

    def _follow_edge(self, instance: WorkflowInstance, definition: dict, node: dict):
        edges = self._get_outgoing_edges(definition, node["id"])
        for edge in edges:
            if self._evaluate_condition(edge.get("condition", ""), instance):
                next_node = self._get_node(definition, edge["target"])
                if next_node:
                    self._execute_node(instance, next_node, definition)
                return

    def _evaluate_gateway(self, instance: WorkflowInstance, definition: dict, gateway: dict):
        edges = self._get_outgoing_edges(definition, gateway["id"])
        for edge in edges:
            if self._evaluate_condition(edge.get("condition", ""), instance):
                next_node = self._get_node(definition, edge["target"])
                if next_node:
                    self._execute_node(instance, next_node, definition)
                return

    def handle_task_action(self, task_id: str, action: str, user: str) -> dict:
        task = self.db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise ValueError(f"Task {task_id} not found")

        task.status = "completed"
        task.assignee = user
        task.updated_at = datetime.utcnow()

        instance = task.instance
        definition = self.get_workflow(instance.workflow_id)
        if not definition:
            raise ValueError("Workflow definition not found")

        node = self._get_node(definition, task.node_id)
        if node:
            instance.variables = instance.variables or {}
            instance.variables["approved"] = action == "approve"
            instance.variables[f"_{task.node_id}_action"] = action
            flag_modified(instance, "variables")
            task.variables = dict(instance.variables)
            self._record_history(instance, task.node_id, task.node_name, "task_completed", f"action={action}")
            self._follow_edge(instance, definition, node)

        self.db.commit()
        self.db.refresh(instance)
        return {"task": task.id, "action": action, "status": instance.status}

    def get_instance_state(self, instance_id: str) -> dict:
        instance = self.db.query(WorkflowInstance).filter(
            WorkflowInstance.id == instance_id
        ).first()
        if not instance:
            return None

        tasks = self.db.query(Task).filter(Task.instance_id == instance_id).all()
        nodes = self.get_workflow(instance.workflow_id)["nodes"] if self.get_workflow(instance.workflow_id) else []

        return {
            "id": instance.id,
            "claim_id": instance.claim_id,
            "workflow_id": instance.workflow_id,
            "status": instance.status,
            "current_node": instance.current_node,
            "variables": instance.variables,
            "history": instance.history,
            "tasks": [
                {
                    "id": t.id,
                    "node_id": t.node_id,
                    "node_name": t.node_name,
                    "task_type": t.task_type,
                    "assignee": t.assignee,
                    "status": t.status,
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                    "updated_at": t.updated_at.isoformat() if t.updated_at else None,
                    "variables": t.variables,
                }
                for t in tasks
            ],
            "nodes": nodes,
        }


def seed_zurich_workflow(db: Session) -> str:
    workflow_id = "zurich-claims-v1"
    existing = db.query(WorkflowDefinition).filter(
        WorkflowDefinition.id == workflow_id
    ).first()
    if existing:
        return workflow_id

    definition = {
        "name": "Zurich Claims Processing",
        "description": "Insurance claims processing workflow with automated validation, fraud check, and human approval.",
        "nodes": [
            {"id": "start", "type": "start", "name": "Business Request", "x": 100, "y": 300, "width": 120, "height": 60},
            {"id": "validate", "type": "service_task", "name": "Automated Validation", "task_type": "validate_claim", "x": 300, "y": 300, "width": 140, "height": 60},
            {"id": "validation_gateway", "type": "gateway", "name": "Is Valid?", "x": 500, "y": 300, "width": 100, "height": 60},
            {"id": "fraud_check", "type": "service_task", "name": "Fraud Check", "task_type": "fraud_check", "x": 500, "y": 120, "width": 140, "height": 60},
            {"id": "fraud_gateway", "type": "gateway", "name": "Fraud Risk?", "x": 700, "y": 120, "width": 100, "height": 60},
            {"id": "review", "type": "user_task", "name": "Human Review", "task_type": "approve_claim", "assignee": "claims.analyst", "x": 700, "y": 360, "width": 140, "height": 60},
            {"id": "rejected_fraud", "type": "end", "name": "Rejected - Fraud", "x": 900, "y": 60, "width": 140, "height": 60},
            {"id": "rejected_invalid", "type": "end", "name": "Rejected - Incomplete", "x": 700, "y": 480, "width": 170, "height": 60},
            {"id": "payout_calc", "type": "service_task", "name": "Payout Calculation", "task_type": "calculate_payout", "x": 900, "y": 360, "width": 160, "height": 60},
            {"id": "approval_gateway", "type": "gateway", "name": "Approved?", "x": 900, "y": 360, "width": 100, "height": 60},
            {"id": "generate_payout", "type": "service_task", "name": "Generate Payout", "task_type": "generate_payout", "x": 1100, "y": 240, "width": 150, "height": 60},
            {"id": "closed_paid", "type": "end", "name": "Closed - Paid", "x": 1300, "y": 240, "width": 120, "height": 60},
            {"id": "closed_rejected", "type": "end", "name": "Rejected - Not Approved", "x": 1100, "y": 480, "width": 180, "height": 60},
        ],
        "edges": [
            {"id": "e1", "source": "start", "target": "validate", "condition": ""},
            {"id": "e2", "source": "validate", "target": "validation_gateway", "condition": ""},
            {"id": "e3", "source": "validation_gateway", "target": "fraud_check", "condition": "{valid} == True"},
            {"id": "e4", "source": "validation_gateway", "target": "rejected_invalid", "condition": "{valid} == False"},
            {"id": "e5", "source": "fraud_check", "target": "fraud_gateway", "condition": ""},
            {"id": "e6", "source": "fraud_gateway", "target": "review", "condition": "{risk} == 'low'"},
            {"id": "e7", "source": "fraud_gateway", "target": "rejected_fraud", "condition": "{risk} == 'high'"},
            {"id": "e8", "source": "review", "target": "approval_gateway", "condition": ""},
            {"id": "e9", "source": "approval_gateway", "target": "payout_calc", "condition": "{approved} == True"},
            {"id": "e10", "source": "approval_gateway", "target": "closed_rejected", "condition": "{approved} == False"},
            {"id": "e11", "source": "payout_calc", "target": "generate_payout", "condition": ""},
            {"id": "e12", "source": "generate_payout", "target": "closed_paid", "condition": ""},
        ],
        "properties": {
            "wf_name": "Zurich Claims Processing",
            "wf_version": "1.0",
            "wf_category": "Insurance",
        },
    }

    wf = WorkflowDefinition(
        id=workflow_id,
        name=definition["name"],
        description=definition["description"],
        definition=definition,
    )
    db.add(wf)
    db.commit()
    return workflow_id
