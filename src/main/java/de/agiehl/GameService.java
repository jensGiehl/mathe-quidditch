package de.agiehl;

import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class GameService {

    private final Map<String, FlightGame> games = new ConcurrentHashMap<>();
    private final QuestionGenerator generator;
    private final Clock clock;

    public GameService(QuestionGenerator generator, Clock clock) {
        this.generator = generator;
        this.clock = clock;
    }

    public GameSnapshot create(String owner, GameConfiguration configuration) {
        var now = clock.instant();
        games.values().removeIf(game -> game.lastAccess().isBefore(now.minus(Duration.ofDays(1))));
        var game = new FlightGame(owner, configuration, generator, now);
        games.put(game.id(), game);
        return game.snapshot(now);
    }

    public GameSnapshot get(String owner, String id) {
        return game(owner, id).snapshot(clock.instant());
    }

    public GameSnapshot answer(String owner, String id, AnswerRequest answer) {
        return game(owner, id).answer(answer, clock.instant());
    }

    public GameSnapshot next(String owner, String id) {
        return game(owner, id).next(clock.instant());
    }

    public GameSnapshot pause(String owner, String id) {
        return game(owner, id).pause(clock.instant());
    }

    public GameSnapshot resume(String owner, String id) {
        return game(owner, id).resume(clock.instant());
    }

    public GameSnapshot boost(String owner, String id) {
        return game(owner, id).boost(clock.instant());
    }

    public GameSnapshot finish(String owner, String id) {
        return game(owner, id).finish(clock.instant());
    }

    private FlightGame game(String owner, String id) {
        var game = games.get(id);
        if (game == null || !game.owner().equals(owner)) {
            throw new GameException(HttpStatus.NOT_FOUND, "Dieser Flug wurde nicht gefunden. Starte einen neuen Flug.");
        }
        return game;
    }
}
