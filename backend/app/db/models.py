"""SQLAlchemy database models."""

from sqlalchemy import ARRAY, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

# Constants to avoid duplication
CASCADE_DELETE_ORPHAN = "all, delete-orphan"
RESUMES_ID_FK = "resumes.id"


class ResumeModel(Base):
    """SQLAlchemy model for resumes."""

    __tablename__ = "resumes"

    id = Column(String, primary_key=True)
    skills = Column(ARRAY(String), nullable=True)

    experiences = relationship("ExperienceModel", back_populates="resume", cascade=CASCADE_DELETE_ORPHAN)
    educations = relationship("EducationModel", back_populates="resume", cascade=CASCADE_DELETE_ORPHAN)
    projects = relationship("ProjectModel", back_populates="resume", cascade=CASCADE_DELETE_ORPHAN)
    certifications = relationship("CertificationModel", back_populates="resume", cascade=CASCADE_DELETE_ORPHAN)
    awards = relationship("AwardModel", back_populates="resume", cascade=CASCADE_DELETE_ORPHAN)


class ExperienceModel(Base):
    """SQLAlchemy model for work experience."""

    __tablename__ = "experiences"

    id = Column(Integer, primary_key=True, autoincrement=True)
    resume_id = Column(String, ForeignKey(RESUMES_ID_FK), nullable=False)
    title = Column(String, nullable=True)
    company = Column(String, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    description = Column(Text, nullable=True)

    resume = relationship("ResumeModel", back_populates="experiences")


class EducationModel(Base):
    """SQLAlchemy model for education."""

    __tablename__ = "educations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    resume_id = Column(String, ForeignKey(RESUMES_ID_FK), nullable=False)
    school = Column(String, nullable=True)
    degree = Column(String, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    gpa = Column(Float, nullable=True)
    gpa_max = Column(Float, nullable=True)
    description = Column(Text, nullable=True)

    resume = relationship("ResumeModel", back_populates="educations")


class ProjectModel(Base):
    """SQLAlchemy model for projects."""

    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    resume_id = Column(String, ForeignKey(RESUMES_ID_FK), nullable=False)
    title = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    technologies = Column(ARRAY(String), nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    url = Column(String, nullable=True)

    resume = relationship("ResumeModel", back_populates="projects")


class CertificationModel(Base):
    """SQLAlchemy model for certifications."""

    __tablename__ = "certifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    resume_id = Column(String, ForeignKey(RESUMES_ID_FK), nullable=False)
    name = Column(String, nullable=True)
    issuer = Column(String, nullable=True)
    issue_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)
    credential_id = Column(String, nullable=True)
    url = Column(String, nullable=True)

    resume = relationship("ResumeModel", back_populates="certifications")


class AwardModel(Base):
    """SQLAlchemy model for awards."""

    __tablename__ = "awards"

    id = Column(Integer, primary_key=True, autoincrement=True)
    resume_id = Column(String, ForeignKey(RESUMES_ID_FK), nullable=False)
    title = Column(String, nullable=True)
    issuer = Column(String, nullable=True)
    date = Column(Date, nullable=True)
    description = Column(Text, nullable=True)

    resume = relationship("ResumeModel", back_populates="awards")


class SessionModel(Base):
    """SQLAlchemy model for persisted chat sessions."""

    __tablename__ = "sessions"

    id = Column(String, primary_key=True)  # session_id
    user_id = Column(String, nullable=False, index=True)
    shared_memory = Column(JSONB, nullable=True)  # dict[str, Any]
    history = Column(JSONB, nullable=True)  # list[AgentResponse] as JSON
    decision_trace = Column(JSONB, nullable=True)  # list[str]
    resume_data = Column(Text, nullable=True)
    job_description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_active_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class SavedResumeModel(Base):
    """SQLAlchemy model for user-owned saved resume snapshots."""

    __tablename__ = "saved_resumes"

    id = Column(String, primary_key=True)
    # Plain indexed string, intentionally NOT a FK: matches SessionModel.user_id
    # and tolerates the dev-user fallback identity that has no users row.
    user_id = Column(String, nullable=False, index=True)
    filename = Column(String, nullable=False)
    resume_data = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class UserModel(Base):
    """SQLAlchemy model for registered users (simulated login identity)."""

    __tablename__ = "users"

    username = Column(String, primary_key=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
