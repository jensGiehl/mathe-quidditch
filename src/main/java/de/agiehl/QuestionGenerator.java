package de.agiehl;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.UUID;
import java.util.random.RandomGenerator;
import org.springframework.stereotype.Component;

@Component
public class QuestionGenerator {

    private final RandomGenerator random;

    public QuestionGenerator() {
        this(RandomGenerator.getDefault());
    }

    QuestionGenerator(RandomGenerator random) {
        this.random = random;
    }

    synchronized MathQuestion create(GameConfiguration configuration, int index) {
        var operation = configuration.operations().get(random.nextInt(configuration.operations().size()));
        var calculation = switch (operation) {
            case ADD -> addition(configuration.range());
            case SUBTRACT -> subtraction(configuration.range());
            case MULTIPLY -> multiplication();
            case DIVIDE -> division();
        };
        var answers = new LinkedHashSet<Integer>();
        answers.add(calculation.answer());
        int spread = Math.max(5, calculation.answer() / 5 + 1);
        while (answers.size() < 3) {
            answers.add(Math.max(0, calculation.answer() + random.nextInt(-spread, spread + 1)));
        }
        var shuffledAnswers = new ArrayList<>(answers);
        for (int position = shuffledAnswers.size() - 1; position > 0; position--) {
            int swapPosition = random.nextInt(position + 1);
            int previous = shuffledAnswers.get(position);
            shuffledAnswers.set(position, shuffledAnswers.get(swapPosition));
            shuffledAnswers.set(swapPosition, previous);
        }
        return new MathQuestion(UUID.randomUUID().toString(), index, calculation.text(), shuffledAnswers,
                calculation.answer(), configuration.speed().durationFor(index));
    }

    private Calculation addition(int range) {
        int first = random.nextInt(range + 1);
        int second = random.nextInt(range - first + 1);
        return new Calculation(first + " + " + second, first + second);
    }

    private Calculation subtraction(int range) {
        int first = random.nextInt(range + 1);
        int second = random.nextInt(first + 1);
        return new Calculation(first + " − " + second, first - second);
    }

    private Calculation multiplication() {
        int first = random.nextInt(1, 11);
        int second = random.nextInt(1, 11);
        return new Calculation(first + " × " + second, first * second);
    }

    private Calculation division() {
        int divisor = random.nextInt(1, 11);
        int quotient = random.nextInt(1, 11);
        return new Calculation(divisor * quotient + " ÷ " + divisor, quotient);
    }

    private record Calculation(String text, int answer) {
    }
}
