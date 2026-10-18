package de.agiehl;

public enum FlightSpeed {
    RELAXED(10_000, 0.8),
    NORMAL(7_500, 1.0),
    FAST(5_000, 1.25);

    private final long initialDurationMs;
    private final double scoreFactor;

    FlightSpeed(long initialDurationMs, double scoreFactor) {
        this.initialDurationMs = initialDurationMs;
        this.scoreFactor = scoreFactor;
    }

    public long durationFor(int questionIndex) {
        return Math.max(2_500, initialDurationMs - questionIndex / 10 * 500L);
    }

    public double scoreFactor() {
        return scoreFactor;
    }
}
