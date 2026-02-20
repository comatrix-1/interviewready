package com.agent.backend.agent;

import com.agent.backend.model.AgentResponse;
import com.agent.backend.model.SessionContext;

public interface BaseAgent {
    String getName();
    AgentResponse process(String input, SessionContext context);
    void updateSystemPrompt(String newPrompt);
    String getSystemPrompt();
}
