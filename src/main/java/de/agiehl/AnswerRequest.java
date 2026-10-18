package de.agiehl;

public record AnswerRequest(String questionId, int lane, String requestId) {

    public AnswerRequest {
        if (questionId == null || questionId.isBlank() || questionId.length() > 100) {
            throw new IllegalArgumentException("Die Aufgabe fehlt.");
        }
        if (lane < 0 || lane > 2) {
            throw new IllegalArgumentException("Wähle eine der drei Flugbahnen.");
        }
        if (requestId == null || requestId.isBlank() || requestId.length() > 128) {
            throw new IllegalArgumentException("Die Eingabe benötigt eine eindeutige Kennung.");
        }
    }
}
