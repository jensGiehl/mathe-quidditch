package de.agiehl;

public record GameSnapshot(String id, String status, String phase, long score, long distance, int correctAnswers,
        double multiplier, MathQuestion.QuestionView question, long remainingMs, long rewardRemainingMs,
        Boolean correct, Integer correctAnswer, String questionText, Reward reward) {

    public record Reward(String id, int correctCount, boolean milestone, int variant) {
    }
}
