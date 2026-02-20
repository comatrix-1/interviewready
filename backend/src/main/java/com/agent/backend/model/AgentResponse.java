package com.agent.backend.model;

import java.util.List;
import java.util.Map;
import java.util.Objects;

public class AgentResponse {
    private String agentName;
    private String content;
    private String reasoning; // Explainability
    private double confidenceScore; // Confidence Indicator
    private List<String> decisionTrace; // Auditability
    private Map<String, Object> sharpMetadata; // SHARP Compliance Data

    public AgentResponse() {}

    public AgentResponse(String agentName, String content, String reasoning, double confidenceScore, List<String> decisionTrace, Map<String, Object> sharpMetadata) {
        this.agentName = agentName;
        this.content = content;
        this.reasoning = reasoning;
        this.confidenceScore = confidenceScore;
        this.decisionTrace = decisionTrace;
        this.sharpMetadata = sharpMetadata;
    }

    // Getters and Setters
    public String getAgentName() { return agentName; }
    public void setAgentName(String agentName) { this.agentName = agentName; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getReasoning() { return reasoning; }
    public void setReasoning(String reasoning) { this.reasoning = reasoning; }
    public double getConfidenceScore() { return confidenceScore; }
    public void setConfidenceScore(double confidenceScore) { this.confidenceScore = confidenceScore; }
    public List<String> getDecisionTrace() { return decisionTrace; }
    public void setDecisionTrace(List<String> decisionTrace) { this.decisionTrace = decisionTrace; }
    public Map<String, Object> getSharpMetadata() { return sharpMetadata; }
    public void setSharpMetadata(Map<String, Object> sharpMetadata) { this.sharpMetadata = sharpMetadata; }

    // Builder pattern
    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private String agentName;
        private String content;
        private String reasoning;
        private double confidenceScore;
        private List<String> decisionTrace;
        private Map<String, Object> sharpMetadata;

        public Builder agentName(String agentName) { this.agentName = agentName; return this; }
        public Builder content(String content) { this.content = content; return this; }
        public Builder reasoning(String reasoning) { this.reasoning = reasoning; return this; }
        public Builder confidenceScore(double confidenceScore) { this.confidenceScore = confidenceScore; return this; }
        public Builder decisionTrace(List<String> decisionTrace) { this.decisionTrace = decisionTrace; return this; }
        public Builder sharpMetadata(Map<String, Object> sharpMetadata) { this.sharpMetadata = sharpMetadata; return this; }

        public AgentResponse build() {
            return new AgentResponse(agentName, content, reasoning, confidenceScore, decisionTrace, sharpMetadata);
        }
    }

    @Override
    public String toString() {
        return "AgentResponse{" +
                "agentName='" + agentName + '\'' +
                ", content='" + content + '\'' +
                ", reasoning='" + reasoning + '\'' +
                ", confidenceScore=" + confidenceScore +
                ", decisionTrace=" + decisionTrace +
                ", sharpMetadata=" + sharpMetadata +
                '}';
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        AgentResponse that = (AgentResponse) o;
        return Double.compare(that.confidenceScore, confidenceScore) == 0 && Objects.equals(agentName, that.agentName) && Objects.equals(content, that.content) && Objects.equals(reasoning, that.reasoning) && Objects.equals(decisionTrace, that.decisionTrace) && Objects.equals(sharpMetadata, that.sharpMetadata);
    }

    @Override
    public int hashCode() {
        return Objects.hash(agentName, content, reasoning, confidenceScore, decisionTrace, sharpMetadata);
    }
}
