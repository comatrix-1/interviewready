package com.agent.backend.agent;

import com.agent.backend.model.AgentResponse;
import com.agent.backend.model.SessionContext;
import org.springframework.ai.chat.ChatClient;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import java.util.List;

public abstract class AbstractAgent implements BaseAgent {
    protected final ChatClient chatClient;
    protected String systemPrompt;
    protected final String name;

    protected AbstractAgent(ChatClient chatClient, String initialPrompt, String name) {
        this.chatClient = chatClient;
        this.systemPrompt = initialPrompt;
        this.name = name;
    }

    @Override
    public String getName() {
        return this.name;
    }

    @Override
    public void updateSystemPrompt(String newPrompt) {
        this.systemPrompt = newPrompt;
    }

    @Override
    public String getSystemPrompt() {
        return this.systemPrompt;
    }

    protected String callGemini(String input, SessionContext context) {
        // Constructing prompt for Gemini
        SystemMessage systemMessage = new SystemMessage(this.systemPrompt);
        UserMessage userMessage = new UserMessage(input);
        
        // In a real RAG scenario, we would inject context here
        return chatClient.call(new Prompt(List.of(systemMessage, userMessage)))
                .getResult().getOutput().getContent();
    }
}
