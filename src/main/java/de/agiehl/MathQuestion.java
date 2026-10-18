package de.agiehl;

import java.util.List;

record MathQuestion(String id, int index, String text, List<Integer> answers, int correctAnswer, long durationMs) {

    MathQuestion {
        answers = List.copyOf(answers);
    }

    QuestionView view() {
        return new QuestionView(id, index, text, answers, durationMs);
    }

    record QuestionView(String id, int index, String text, List<Integer> answers, long durationMs) {
    }
}
