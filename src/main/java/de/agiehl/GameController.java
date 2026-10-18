package de.agiehl;

import jakarta.servlet.http.HttpSession;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class GameController {

    private final GameService games;
    private final HighscoreService highscores;

    public GameController(GameService games, HighscoreService highscores) {
        this.games = games;
        this.highscores = highscores;
    }

    @PostMapping("/games")
    public GameSnapshot create(@RequestBody GameConfiguration configuration, HttpSession session) {
        return games.create(session.getId(), configuration);
    }

    @GetMapping("/games/{id}")
    public GameSnapshot get(@PathVariable String id, HttpSession session) {
        return games.get(session.getId(), id);
    }

    @PostMapping("/games/{id}/answers")
    public GameSnapshot answer(@PathVariable String id, @RequestBody AnswerRequest answer, HttpSession session) {
        return games.answer(session.getId(), id, answer);
    }

    @PostMapping("/games/{id}/next")
    public GameSnapshot next(@PathVariable String id, HttpSession session) {
        return games.next(session.getId(), id);
    }

    @PostMapping("/games/{id}/pause")
    public GameSnapshot pause(@PathVariable String id, HttpSession session) {
        return games.pause(session.getId(), id);
    }

    @PostMapping("/games/{id}/resume")
    public GameSnapshot resume(@PathVariable String id, HttpSession session) {
        return games.resume(session.getId(), id);
    }

    @PostMapping("/games/{id}/boost")
    public GameSnapshot boost(@PathVariable String id, HttpSession session) {
        return games.boost(session.getId(), id);
    }

    @PostMapping("/games/{id}/finish")
    public GameSnapshot finish(@PathVariable String id, HttpSession session) {
        return games.finish(session.getId(), id);
    }

    @GetMapping("/highscores")
    public Leaderboard leaderboard() {
        return highscores.leaderboard();
    }

    @PostMapping("/highscores")
    public Leaderboard save(@RequestBody HighscoreRequest request, HttpSession session) {
        return highscores.save(session.getId(), request);
    }
}
