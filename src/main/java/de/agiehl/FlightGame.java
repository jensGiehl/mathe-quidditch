package de.agiehl;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;

final class FlightGame {

    private static final long ANSWER_GRACE_MS = 1_500;
    private final String id = UUID.randomUUID().toString();
    private final String owner;
    private final GameConfiguration configuration;
    private final QuestionGenerator generator;
    private final Map<String, AnswerReceipt> requests = new HashMap<>();
    private final Map<String, GameSnapshot> answeredQuestions = new HashMap<>();
    private Phase phase = Phase.PLAYING;
    private boolean paused;
    private long pausedRemainingMs;
    private Instant deadline;
    private Instant lastAccess;
    private MathQuestion question;
    private long score;
    private int correctAnswers;
    private Boolean lastCorrect;
    private Integer lastCorrectAnswer;
    private String lastQuestionText;
    private GameSnapshot.Reward reward;

    FlightGame(String owner, GameConfiguration configuration, QuestionGenerator generator, Instant now) {
        this.owner = owner;
        this.configuration = configuration;
        this.generator = generator;
        lastAccess = now;
        startQuestion(now);
    }

    String id() {
        return id;
    }

    String owner() {
        return owner;
    }

    synchronized Instant lastAccess() {
        return lastAccess;
    }

    synchronized GameSnapshot snapshot(Instant now) {
        refresh(now);
        return currentSnapshot(now);
    }

    synchronized GameSnapshot answer(AnswerRequest answer, Instant now) {
        var existingRequest = requests.get(answer.requestId());
        if (existingRequest != null) {
            if (!existingRequest.request().equals(answer)) {
                throw conflict("Diese Eingabekennung wurde bereits verwendet.");
            }
            return existingRequest.snapshot();
        }
        var previousAnswer = answeredQuestions.get(answer.questionId());
        if (previousAnswer != null) {
            requests.put(answer.requestId(), new AnswerReceipt(answer, previousAnswer));
            return previousAnswer;
        }
        refresh(now);
        if (paused || phase != Phase.PLAYING) {
            throw conflict("Für diesen Flug kann gerade keine Antwort abgegeben werden.");
        }
        if (!question.id().equals(answer.questionId())) {
            throw conflict("Diese Aufgabe ist nicht mehr aktuell.");
        }
        lastCorrect = question.answers().get(answer.lane()) == question.correctAnswer();
        lastCorrectAnswer = question.correctAnswer();
        lastQuestionText = question.text();
        if (lastCorrect) {
            score += Math.round(100 * multiplier() * configuration.speed().scoreFactor());
            correctAnswers++;
            boolean milestone = correctAnswers % 10 == 0;
            reward = new GameSnapshot.Reward(UUID.randomUUID().toString(), correctAnswers, milestone,
                    (correctAnswers - 1) % 3);
            phase = Phase.REWARD;
            deadline = now.plusMillis(milestone ? 1_700 : 1_200);
        } else {
            phase = Phase.FINISHED;
            reward = null;
        }
        var result = currentSnapshot(now);
        answeredQuestions.put(answer.questionId(), result);
        requests.put(answer.requestId(), new AnswerReceipt(answer, result));
        return result;
    }

    synchronized GameSnapshot next(Instant now) {
        refresh(now);
        if (!paused && phase == Phase.REWARD && !now.isBefore(deadline)) {
            startQuestion(now);
        }
        return currentSnapshot(now);
    }

    synchronized GameSnapshot pause(Instant now) {
        refresh(now);
        if (!paused && phase != Phase.FINISHED) {
            pausedRemainingMs = Math.max(0, deadline.toEpochMilli() - now.toEpochMilli());
            paused = true;
        }
        return currentSnapshot(now);
    }

    synchronized GameSnapshot resume(Instant now) {
        lastAccess = now;
        if (paused) {
            deadline = now.plusMillis(pausedRemainingMs);
            paused = false;
        }
        return currentSnapshot(now);
    }

    synchronized GameSnapshot boost(Instant now) {
        refresh(now);
        if (!paused && phase == Phase.PLAYING) {
            var boostedDeadline = now.plusMillis(900);
            if (deadline.isAfter(boostedDeadline)) {
                deadline = boostedDeadline;
            }
        }
        return currentSnapshot(now);
    }

    synchronized GameSnapshot finish(Instant now) {
        refresh(now);
        if (phase == Phase.PLAYING) {
            lastQuestionText = question.text();
            lastCorrectAnswer = question.correctAnswer();
            lastCorrect = false;
        }
        phase = Phase.FINISHED;
        paused = false;
        reward = null;
        return currentSnapshot(now);
    }

    private void refresh(Instant now) {
        lastAccess = now;
        if (!paused && phase == Phase.PLAYING && now.isAfter(deadline.plusMillis(ANSWER_GRACE_MS))) {
            lastCorrect = false;
            lastCorrectAnswer = question.correctAnswer();
            lastQuestionText = question.text();
            phase = Phase.FINISHED;
        }
    }

    private void startQuestion(Instant now) {
        question = generator.create(configuration, correctAnswers + 1);
        deadline = now.plusMillis(question.durationMs());
        phase = Phase.PLAYING;
        reward = null;
        lastCorrect = null;
        lastCorrectAnswer = null;
        lastQuestionText = null;
    }

    private double multiplier() {
        return 1 + (question.index() - 1) / 10 * 0.25;
    }

    private GameSnapshot currentSnapshot(Instant now) {
        long remaining = paused ? pausedRemainingMs : Math.max(0, deadline.toEpochMilli() - now.toEpochMilli());
        return new GameSnapshot(id, paused ? "PAUSED" : phase.name(), phase.name(), score, correctAnswers * 100L,
                correctAnswers, multiplier(), phase == Phase.PLAYING ? question.view() : null,
                phase == Phase.PLAYING ? remaining : 0, phase == Phase.REWARD ? remaining : 0,
                lastCorrect, lastCorrectAnswer, lastQuestionText, reward);
    }

    private GameException conflict(String message) {
        return new GameException(HttpStatus.CONFLICT, message);
    }

    private enum Phase {
        PLAYING, REWARD, FINISHED
    }

    private record AnswerReceipt(AnswerRequest request, GameSnapshot snapshot) {
    }
}
