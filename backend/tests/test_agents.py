"""Test script for agent implementations."""

import json

from dotenv import load_dotenv

from app.agents import (
    ContentStrengthAgent,
    GeminiService,
<<<<<<< HEAD
    ContentStrengthAgent,
    GeminiService,
    InterviewCoachAgent,
    JobAlignmentAgent,
    ResumeCriticAgent,
    JobAlignmentAgent,
    ResumeCriticAgent,
)
from app.core.config import settings
from app.core.config import settings
=======
    InterviewCoachAgent,
    JobAlignmentAgent,
    ResumeCriticAgent,
)
from app.core.config import settings
>>>>>>> d4ad3a3680180078956713f7cb95169837622063
from app.models import AgentInput, Resume, Work
from app.models.session import SessionContext

# Load environment variables
load_dotenv()


<<<<<<< HEAD

def test_agents():
    """Test all agent implementations."""


=======
def test_agents():
    """Test all agent implementations."""

>>>>>>> d4ad3a3680180078956713f7cb95169837622063
    # Check if API key is available
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        return

<<<<<<< HEAD

    # Initialize Gemini service
    gemini_service = GeminiService(api_key=api_key)


=======
    # Initialize Gemini service
    gemini_service = GeminiService(api_key=api_key)

>>>>>>> d4ad3a3680180078956713f7cb95169837622063
    # Initialize agents
    agents = {
        "ResumeCriticAgent": ResumeCriticAgent(gemini_service),
        "ContentStrengthAgent": ContentStrengthAgent(gemini_service),
        "JobAlignmentAgent": JobAlignmentAgent(gemini_service),
        "InterviewCoachAgent": InterviewCoachAgent(gemini_service),
<<<<<<< HEAD
        "InterviewCoachAgent": InterviewCoachAgent(gemini_service),
    }


=======
    }

>>>>>>> d4ad3a3680180078956713f7cb95169837622063
    # Test data
    sample_resume = """
    John Doe
    Software Engineer

<<<<<<< HEAD

=======
>>>>>>> d4ad3a3680180078956713f7cb95169837622063
    Experience:
    - Senior Software Engineer at Tech Corp (2020-Present)
      * Led team of 5 developers
      * Improved system performance by 30%
      * Implemented microservices architecture

<<<<<<< HEAD

=======
>>>>>>> d4ad3a3680180078956713f7cb95169837622063
    - Software Developer at StartupXYZ (2018-2020)
      * Developed REST APIs using Python and Django
      * Worked on various projects to improve processes

<<<<<<< HEAD

=======
>>>>>>> d4ad3a3680180078956713f7cb95169837622063
    Skills:
    - Python, Java, JavaScript
    - AWS, Docker, Kubernetes
    - Agile, Scrum
    """

<<<<<<< HEAD

    sample_job_description = """
    Senior Software Engineer Position


=======
    sample_job_description = """
    Senior Software Engineer Position

>>>>>>> d4ad3a3680180078956713f7cb95169837622063
    Requirements:
    - 5+ years of software development experience
    - Strong experience with Python and cloud technologies
    - Experience leading development teams
    - Knowledge of microservices architecture
    - Excellent problem-solving skills
    """

<<<<<<< HEAD

=======
>>>>>>> d4ad3a3680180078956713f7cb95169837622063
    # Create session context
    context = SessionContext(
        session_id="test_session",
        user_id="test_user",
        resume_data=sample_resume,
        job_description=sample_job_description,
<<<<<<< HEAD
        job_description=sample_job_description,
=======
>>>>>>> d4ad3a3680180078956713f7cb95169837622063
    )

    resume = Resume(
        work=[
            Work(
                name="Tech Corp",
                position="Senior Software Engineer",
                highlights=[
                    "Led team of 5 developers",
                    "Improved system performance by 30%",
                    "Implemented microservices architecture",
                ],
            )
        ]
    )

    intent_map = {
        "ResumeCriticAgent": "RESUME_CRITIC",
        "ContentStrengthAgent": "CONTENT_STRENGTH",
        "JobAlignmentAgent": "ALIGNMENT",
        "InterviewCoachAgent": "INTERVIEW_COACH",
    }

<<<<<<< HEAD

    # Test each agent


=======
    # Test each agent

>>>>>>> d4ad3a3680180078956713f7cb95169837622063
    for agent_name, agent in agents.items():
        try:
            agent_input = AgentInput(
                intent=intent_map[agent_name],
                resume=resume,
                job_description=sample_job_description,
                message_history=[],
            )

            response = agent.process(agent_input, context)

<<<<<<< HEAD
            if response.content is not None:
                preview = json.dumps(response.content, ensure_ascii=False)
                _ = preview[:200] + "..." if len(preview) > 200 else preview
=======
            # Show first 200 characters of content
            if response.content:
                response.content[:200] + "..." if len(
                    response.content
                ) > 200 else response.content
>>>>>>> d4ad3a3680180078956713f7cb95169837622063

        except Exception:
            pass


if __name__ == "__main__":
    test_agents()
