package com.agent.backend.model;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public class SessionContext {
    private String sessionId;
    private String userId;
    private Map<String, Object> sharedMemory = new HashMap<>();
    private List<AgentResponse> history = new ArrayList<>();
    private List<String> decisionTrace = new ArrayList<>();

    public void addToHistory(AgentResponse response) {
        this.history.add(response);
    }

    // Getters and Setters
    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public Map<String, Object> getSharedMemory() { return sharedMemory; }
    public void setSharedMemory(Map<String, Object> sharedMemory) { this.sharedMemory = sharedMemory; }
    public List<AgentResponse> getHistory() { return history; }
    public void setHistory(List<AgentResponse> history) { this.history = history; }
    public List<String> getDecisionTrace() { return decisionTrace; }
    public void setDecisionTrace(List<String> decisionTrace) { this.decisionTrace = decisionTrace; }

    @Override
    public String toString() {
        return "SessionContext{" +
                "sessionId='" + sessionId + '\'' +
                ", userId='" + userId + '\'' +
                ", sharedMemory=" + sharedMemory +
                ", history=" + history +
                ", decisionTrace=" + decisionTrace +
                '}';
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        SessionContext that = (SessionContext) o;
        return Objects.equals(sessionId, that.sessionId) && Objects.equals(userId, that.userId) && Objects.equals(sharedMemory, that.sharedMemory) && Objects.equals(history, that.history) && Objects.equals(decisionTrace, that.decisionTrace);
    }

    @Override
    public int hashCode() {
        return Objects.hash(sessionId, userId, sharedMemory, history, decisionTrace);
    }
}
