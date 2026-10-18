package de.agiehl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Path;
import java.util.List;
import java.util.Random;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class HighscoreServiceTest {

    private final MutableClock clock = new MutableClock();
    private final GameService games = new GameService(new QuestionGenerator(new Random(52)), clock);
    private final JdbcTemplate jdbc = jdbc("jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1");
    private final HighscoreService highscores = new HighscoreService(jdbc, games, clock);

    @Test
    void returnsTopThreeAndOwnRankOutsideThePodium() {
        assertThat(highscores.leaderboard().entries()).isEmpty();
        assertThat(highscores.leaderboard().own()).isNull();
        String lowestGame = null;
        for (int count = 1; count <= 5; count++) {
            var game = finishedFlight(count);
            if (count == 1) {
                lowestGame = game.id();
            }
            highscores.save("owner", new HighscoreRequest(game.id(), "Flieger " + count));
            clock.advance(1_000);
        }
        var leaderboard = highscores.save("owner", new HighscoreRequest(lowestGame, "Umbenannt"));
        assertThat(leaderboard.entries()).extracting(HighscoreEntry::name)
                .containsExactly("Flieger 5", "Flieger 4", "Flieger 3");
        assertThat(leaderboard.entries()).extracting(HighscoreEntry::rank).containsExactly(1L, 2L, 3L);
        assertThat(leaderboard.own().name()).isEqualTo("Flieger 1");
        assertThat(leaderboard.own().rank()).isEqualTo(5);
        assertThat(leaderboard.own().score()).isEqualTo(100);
        assertThat(leaderboard.own().distance()).isEqualTo(100);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM highscores", Integer.class)).isEqualTo(5);
    }

    @Test
    void savesServerResultOnlyOnceAndOrdersTiesByFirstSaved() {
        var first = finishedFlight(2);
        var firstResult = highscores.save("owner", new HighscoreRequest(first.id(), "  He\u0301lène\u00a0  Gold  "));
        assertThat(firstResult.own().name()).isEqualTo("Hélène Gold");
        assertThat(firstResult.own().score()).isEqualTo(first.score());
        var second = finishedFlight(2);
        highscores.save("owner", new HighscoreRequest(second.id(), "Alex"));
        var third = finishedFlight(2);
        highscores.save("owner", new HighscoreRequest(third.id(), "Alex"));
        var repeated = highscores.save("owner", new HighscoreRequest(first.id(), "Anderer Name"));
        assertThat(repeated.own().rank()).isEqualTo(1);
        assertThat(repeated.own().name()).isEqualTo("Hélène Gold");
        assertThat(repeated.entries()).extracting(HighscoreEntry::name).containsExactly("Hélène Gold", "Alex", "Alex");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM highscores WHERE game_id = ?", Integer.class, first.id())).isEqualTo(1);
    }

    @Test
    void rejectsUnfinishedGamesMissingNamesAndForeignGames() {
        var active = games.create("owner", new GameConfiguration(List.of(MathOperation.ADD), 20, FlightSpeed.NORMAL));
        assertThatThrownBy(() -> highscores.save("owner", new HighscoreRequest(active.id(), "Alex")))
                .isInstanceOf(GameException.class);
        var finished = games.finish("owner", active.id());
        assertThatIllegalArgumentException().isThrownBy(() -> highscores.save("owner", new HighscoreRequest(finished.id(), "   ")));
        assertThatThrownBy(() -> highscores.save("someone-else", new HighscoreRequest(finished.id(), "Alex")))
                .isInstanceOf(GameException.class);
        assertThatIllegalArgumentException().isThrownBy(() -> highscores.save("owner", new HighscoreRequest(null, "Alex")));
    }

    @Test
    void normalizesNamesToAtMostTwentyFourCodePoints() {
        assertThat(HighscoreService.normalizeName("  Luna\u200b  Lovegood  ")).isEqualTo("Luna Lovegood");
        assertThat(HighscoreService.normalizeName(" Luna\t\nLovegood ")).isEqualTo("Luna Lovegood");
        assertThat(HighscoreService.normalizeName("a".repeat(30))).hasSize(24);
        var emojiName = HighscoreService.normalizeName("🧙".repeat(30));
        assertThat(emojiName.codePointCount(0, emojiName.length())).isEqualTo(24);
        assertThatIllegalArgumentException().isThrownBy(() -> HighscoreService.normalizeName(null));
        assertThatIllegalArgumentException().isThrownBy(() -> HighscoreService.normalizeName("\u200b\u0001"));
        assertThatIllegalArgumentException().isThrownBy(() -> HighscoreService.normalizeName("a".repeat(1_001)));
    }

    @Test
    void storesUnicodeNamesAtTheMaximumAllowedLength() {
        var flight = finishedFlight(1);
        var leaderboard = highscores.save("owner", new HighscoreRequest(flight.id(), "🧙".repeat(24)));
        assertThat(leaderboard.own().name()).isEqualTo("🧙".repeat(24));
    }

    @Test
    void keepsScoresWhenTheFileDatabaseIsReopened(@TempDir Path directory) {
        String url = "jdbc:h2:file:" + directory.resolve("highscores").toAbsolutePath().toString().replace('\\', '/')
                + ";DB_CLOSE_ON_EXIT=FALSE";
        var firstConnection = jdbc(url);
        var firstService = new HighscoreService(firstConnection, games, clock);
        var game = finishedFlight(3);
        firstService.save("owner", new HighscoreRequest(game.id(), "Dauerhaft"));
        firstConnection.execute("SHUTDOWN");
        var secondConnection = jdbc(url);
        var reopened = new HighscoreService(secondConnection, games, clock);
        assertThat(reopened.leaderboard().entries()).singleElement().satisfies(entry -> {
            assertThat(entry.name()).isEqualTo("Dauerhaft");
            assertThat(entry.score()).isEqualTo(300);
            assertThat(entry.correctAnswers()).isEqualTo(3);
        });
        secondConnection.execute("SHUTDOWN");
    }

    private GameSnapshot finishedFlight(int correctAnswers) {
        var game = games.create("owner", new GameConfiguration(List.of(MathOperation.ADD), 20, FlightSpeed.NORMAL));
        for (int count = 0; count < correctAnswers; count++) {
            var reward = games.answer("owner", game.id(), GameServiceTest.correctAnswer(game));
            clock.advance(reward.rewardRemainingMs());
            game = games.next("owner", game.id());
        }
        return games.finish("owner", game.id());
    }

    private static JdbcTemplate jdbc(String url) {
        return new JdbcTemplate(new DriverManagerDataSource(url, "sa", ""));
    }
}
