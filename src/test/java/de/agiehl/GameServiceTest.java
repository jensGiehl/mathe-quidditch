package de.agiehl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.Test;

class GameServiceTest {

    private final MutableClock clock = new MutableClock();
    private final GameService games = new GameService(new QuestionGenerator(new Random(1234)), clock);
    private final GameConfiguration configuration = new GameConfiguration(List.of(MathOperation.ADD, MathOperation.SUBTRACT),
            100, FlightSpeed.NORMAL);

    @Test
    void celebratesEachCorrectAnswerExactlyOnceWithMilestonesAtTenTwentyAndThirty() {
        var snapshot = games.create("owner", configuration);
        var rewardIds = new HashSet<String>();
        var rewardVariants = new HashSet<Integer>();
        var milestones = new HashSet<Integer>();
        for (int count = 1; count <= 30; count++) {
            var answer = correctAnswer(snapshot);
            var reward = games.answer("owner", snapshot.id(), answer);
            assertThat(reward.status()).isEqualTo("REWARD");
            assertThat(reward.question()).isNull();
            assertThat(reward.correct()).isTrue();
            assertThat(reward.correctAnswers()).isEqualTo(count);
            assertThat(reward.reward().correctCount()).isEqualTo(count);
            assertThat(reward.reward().variant()).isEqualTo((count - 1) % 3);
            rewardVariants.add(reward.reward().variant());
            assertThat(rewardIds.add(reward.reward().id())).isTrue();
            assertThat(games.answer("owner", snapshot.id(), answer)).isEqualTo(reward);
            var repeatedQuestion = new AnswerRequest(answer.questionId(), (answer.lane() + 1) % 3, UUID.randomUUID().toString());
            assertThat(games.answer("owner", snapshot.id(), repeatedQuestion)).isEqualTo(reward);
            if (reward.reward().milestone()) {
                milestones.add(count);
            }
            assertThat(games.next("owner", snapshot.id()).status()).isEqualTo("REWARD");
            clock.advance(reward.rewardRemainingMs() - 1);
            assertThat(games.next("owner", snapshot.id()).status()).isEqualTo("REWARD");
            clock.advance(1);
            snapshot = games.next("owner", snapshot.id());
            assertThat(snapshot.status()).isEqualTo("PLAYING");
            assertThat(snapshot.question().index()).isEqualTo(count + 1);
            assertThat(snapshot.remainingMs()).isEqualTo(snapshot.question().durationMs());
            assertThat(snapshot.reward()).isNull();
        }
        assertThat(milestones).containsExactlyInAnyOrder(10, 20, 30);
        assertThat(rewardIds).hasSize(30);
        assertThat(rewardVariants).containsExactlyInAnyOrder(0, 1, 2);
        assertThat(snapshot.score()).isEqualTo(3_750);
        assertThat(snapshot.distance()).isEqualTo(3_000);
        assertThat(snapshot.multiplier()).isEqualTo(1.75);
        assertThat(snapshot.question().durationMs()).isEqualTo(6_000);
    }

    @Test
    void pausesAndResumesTheExactRemainingQuestionTime() {
        var game = games.create("owner", configuration);
        clock.advance(1_350);
        var paused = games.pause("owner", game.id());
        assertThat(paused.status()).isEqualTo("PAUSED");
        assertThat(paused.phase()).isEqualTo("PLAYING");
        assertThat(paused.remainingMs()).isEqualTo(6_150);
        clock.advance(600_000);
        assertThat(games.get("owner", game.id()).remainingMs()).isEqualTo(6_150);
        assertThat(games.pause("owner", game.id()).remainingMs()).isEqualTo(6_150);
        assertThatThrownBy(() -> games.answer("owner", game.id(), correctAnswer(game))).isInstanceOf(GameException.class);
        assertThat(games.boost("owner", game.id()).remainingMs()).isEqualTo(6_150);
        var resumed = games.resume("owner", game.id());
        assertThat(resumed.status()).isEqualTo("PLAYING");
        assertThat(resumed.remainingMs()).isEqualTo(6_150);
        clock.advance(1_000);
        assertThat(games.resume("owner", game.id()).remainingMs()).isEqualTo(5_150);
    }

    @Test
    void pausesRewardAndStartsNextTimerOnlyWhenRewardHasFullyPlayed() {
        var game = games.create("owner", configuration);
        games.answer("owner", game.id(), correctAnswer(game));
        clock.advance(200);
        var paused = games.pause("owner", game.id());
        assertThat(paused.phase()).isEqualTo("REWARD");
        assertThat(paused.rewardRemainingMs()).isEqualTo(1_000);
        clock.advance(100_000);
        assertThat(games.next("owner", game.id()).status()).isEqualTo("PAUSED");
        var resumed = games.resume("owner", game.id());
        assertThat(resumed.rewardRemainingMs()).isEqualTo(1_000);
        clock.advance(999);
        assertThat(games.next("owner", game.id()).status()).isEqualTo("REWARD");
        clock.advance(1);
        var next = games.next("owner", game.id());
        assertThat(next.status()).isEqualTo("PLAYING");
        assertThat(next.remainingMs()).isEqualTo(7_500);
    }

    @Test
    void boostShortensApproachWithoutChangingPointsAndAllowsTransportLatency() {
        var game = games.create("owner", configuration);
        var boosted = games.boost("owner", game.id());
        assertThat(boosted.remainingMs()).isEqualTo(900);
        clock.advance(950);
        assertThat(games.boost("owner", game.id()).remainingMs()).isZero();
        var result = games.answer("owner", game.id(), correctAnswer(game));
        assertThat(result.correct()).isTrue();
        assertThat(result.score()).isEqualTo(100);
    }

    @Test
    void expiresMissingAnswersAndRevealsCorrectSolution() {
        var game = games.create("owner", configuration);
        clock.advance(9_000);
        assertThat(games.get("owner", game.id()).status()).isEqualTo("PLAYING");
        clock.advance(1);
        var finished = games.get("owner", game.id());
        assertThat(finished.status()).isEqualTo("FINISHED");
        assertThat(finished.correct()).isFalse();
        assertThat(finished.correctAnswer()).isEqualTo(solution(game.question().text()));
        assertThat(finished.questionText()).isEqualTo(game.question().text());
        assertThat(finished.score()).isZero();
        assertThat(finished.reward()).isNull();
        assertThat(games.next("owner", game.id()).status()).isEqualTo("FINISHED");
        assertThatThrownBy(() -> games.answer("owner", game.id(), correctAnswer(game))).isInstanceOf(GameException.class);
    }

    @Test
    void wrongLaneEndsFlightWithoutRewardAndNewGameResetsEverything() {
        var game = games.create("owner", configuration);
        var firstReward = games.answer("owner", game.id(), correctAnswer(game));
        clock.advance(firstReward.rewardRemainingMs());
        var second = games.next("owner", game.id());
        var answer = correctAnswer(second);
        var failed = games.answer("owner", game.id(), new AnswerRequest(answer.questionId(), (answer.lane() + 1) % 3, "wrong"));
        assertThat(failed.status()).isEqualTo("FINISHED");
        assertThat(failed.correct()).isFalse();
        assertThat(failed.correctAnswers()).isEqualTo(1);
        assertThat(failed.score()).isEqualTo(100);
        assertThat(failed.reward()).isNull();
        assertThat(failed.correctAnswer()).isEqualTo(solution(second.question().text()));
        var fresh = games.create("owner", configuration);
        assertThat(fresh.id()).isNotEqualTo(game.id());
        assertThat(fresh.correctAnswers()).isZero();
        assertThat(fresh.score()).isZero();
        assertThat(fresh.distance()).isZero();
        assertThat(fresh.multiplier()).isEqualTo(1);
        assertThat(fresh.question().index()).isEqualTo(1);
        assertThat(fresh.reward()).isNull();
    }

    @Test
    void verifiesOwnershipAndRejectsStaleOrReusedInput() {
        var game = games.create("owner", configuration);
        assertThatThrownBy(() -> games.get("someone-else", game.id())).isInstanceOf(GameException.class);
        assertThatThrownBy(() -> games.get("owner", "missing")).isInstanceOf(GameException.class);
        assertThatThrownBy(() -> games.answer("owner", game.id(), new AnswerRequest("stale", 0, "request")))
                .isInstanceOf(GameException.class);
        var answer = correctAnswer(game);
        games.answer("owner", game.id(), answer);
        assertThatThrownBy(() -> games.answer("owner", game.id(), new AnswerRequest(answer.questionId(),
                (answer.lane() + 1) % 3, answer.requestId()))).isInstanceOf(GameException.class);
    }

    @Test
    void simultaneousDuplicateInputsCannotAwardExtraPointsOrRewards() throws Exception {
        var game = games.create("owner", configuration);
        var answer = correctAnswer(game);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var responses = java.util.stream.IntStream.range(0, 24)
                    .mapToObj(index -> executor.submit(() -> {
                        start.await();
                        return games.answer("owner", game.id(),
                                new AnswerRequest(answer.questionId(), answer.lane(), "parallel-" + index));
                    })).toList();
            start.countDown();
            var rewards = new HashSet<String>();
            for (var response : responses) {
                var result = response.get();
                assertThat(result.correctAnswers()).isEqualTo(1);
                assertThat(result.score()).isEqualTo(100);
                rewards.add(result.reward().id());
            }
            assertThat(rewards).hasSize(1);
            assertThat(games.get("owner", game.id()).correctAnswers()).isEqualTo(1);
        }
    }

    @Test
    void serverUsesSelectedStartSpeedForScoreAndAbandonIsFinal() {
        for (var speed : FlightSpeed.values()) {
            var game = games.create("owner", new GameConfiguration(List.of(MathOperation.MULTIPLY), 20, speed));
            var reward = games.answer("owner", game.id(), correctAnswer(game));
            assertThat(reward.score()).isEqualTo(Math.round(100 * speed.scoreFactor()));
            var finished = games.finish("owner", game.id());
            assertThat(finished.status()).isEqualTo("FINISHED");
            assertThat(finished.reward()).isNull();
            assertThat(games.next("owner", game.id()).status()).isEqualTo("FINISHED");
        }
    }

    static AnswerRequest correctAnswer(GameSnapshot snapshot) {
        int lane = snapshot.question().answers().indexOf(solution(snapshot.question().text()));
        return new AnswerRequest(snapshot.question().id(), lane, UUID.randomUUID().toString());
    }

    static int solution(String question) {
        var parts = question.split(" ");
        int first = Integer.parseInt(parts[0]);
        int second = Integer.parseInt(parts[2]);
        return switch (parts[1]) {
            case "+" -> first + second;
            case "−" -> first - second;
            case "×" -> first * second;
            case "÷" -> first / second;
            default -> throw new IllegalArgumentException(question);
        };
    }
}
