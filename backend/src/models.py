from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime

Base = declarative_base()

class WorkflowDefinition(Base):
    __tablename__ = "workflow_definitions"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    definition = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Claim(Base):
    __tablename__ = "claims"

    id = Column(String, primary_key=True, index=True)
    claim_number = Column(String, unique=True, index=True)
    claim_type = Column(String, nullable=False)
    description = Column(Text, default="")
    amount = Column(Integer, default=0)
    status = Column(String, default="submitted")
    priority = Column(String, default="normal")
    insured_name = Column(String, default="")
    insured_email = Column(String, default="")
    incident_date = Column(String, default="")
    policy_number = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    instance = relationship("WorkflowInstance", back_populates="claim", uselist=False)

class WorkflowInstance(Base):
    __tablename__ = "workflow_instances"

    id = Column(String, primary_key=True, index=True)
    claim_id = Column(String, ForeignKey("claims.id"), unique=True, nullable=False)
    workflow_id = Column(String, ForeignKey("workflow_definitions.id"), nullable=False)
    status = Column(String, default="running")
    current_node = Column(String, default="")
    variables = Column(JSON, default={})
    history = Column(JSON, default=[])
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    claim = relationship("Claim", back_populates="instance")
    tasks = relationship("Task", back_populates="instance")

class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, index=True)
    instance_id = Column(String, ForeignKey("workflow_instances.id"), nullable=False)
    node_id = Column(String, nullable=False)
    node_name = Column(String, nullable=False)
    task_type = Column(String, nullable=False)
    assignee = Column(String, default="unassigned")
    status = Column(String, default="pending")
    variables = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    instance = relationship("WorkflowInstance", back_populates="tasks")
