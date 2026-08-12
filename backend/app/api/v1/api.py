"""Main API router for v1 endpoints."""

from fastapi import APIRouter

from app.api.v1.endpoints import agents, analysis, ats, chat, interview, resumes, sessions, users

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(analysis.router, prefix="/analysis", tags=["analysis"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(agents.router, prefix="/agents", tags=["agents"])
api_router.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
api_router.include_router(interview.router, prefix="/interview", tags=["interview"])
api_router.include_router(ats.router, prefix="/ats", tags=["ats"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(resumes.router, prefix="/resumes", tags=["resumes"])
