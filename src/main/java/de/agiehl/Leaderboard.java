package de.agiehl;

import java.util.List;

public record Leaderboard(List<HighscoreEntry> entries, HighscoreEntry own) {

    public Leaderboard {
        entries = List.copyOf(entries);
    }
}
