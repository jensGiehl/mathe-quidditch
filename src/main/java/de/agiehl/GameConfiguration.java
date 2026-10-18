package de.agiehl;

import java.util.List;

public record GameConfiguration(List<MathOperation> operations, int range, FlightSpeed speed) {

    public GameConfiguration {
        if (operations == null || operations.isEmpty() || operations.stream().anyMatch(operation -> operation == null)) {
            throw new IllegalArgumentException("Wähle mindestens eine Rechenart aus.");
        }
        if (range != 20 && range != 100 && range != 1_000) {
            throw new IllegalArgumentException("Der Zahlenraum muss 20, 100 oder 1.000 sein.");
        }
        if (speed == null) {
            throw new IllegalArgumentException("Wähle eine Startgeschwindigkeit aus.");
        }
        operations = operations.stream().distinct().toList();
    }
}
