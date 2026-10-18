package de.agiehl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import java.util.HashSet;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class QuestionGeneratorTest {

    private final QuestionGenerator generator = new QuestionGenerator(new Random(42));

    @ParameterizedTest
    @EnumSource(MathOperation.class)
    void generatesValidArithmeticWithExactlyThreeDistinctAnswers(MathOperation operation) {
        for (int range : List.of(20, 100, 1_000)) {
            var configuration = new GameConfiguration(List.of(operation), range, FlightSpeed.NORMAL);
            for (int index = 1; index <= 500; index++) {
                var question = generator.create(configuration, index);
                var parts = question.text().split(" ");
                int first = Integer.parseInt(parts[0]);
                int second = Integer.parseInt(parts[2]);
                int expected = switch (operation) {
                    case ADD -> first + second;
                    case SUBTRACT -> first - second;
                    case MULTIPLY -> first * second;
                    case DIVIDE -> first / second;
                };
                assertThat(question.correctAnswer()).isEqualTo(expected);
                assertThat(question.answers()).hasSize(3).doesNotHaveDuplicates().contains(expected);
                assertThat(question.answers()).allMatch(answer -> answer >= 0);
                assertThat(question.id()).isNotBlank();
                assertThat(question.index()).isEqualTo(index);
                assertThat(question.durationMs()).isBetween(2_500L, 7_500L);
                switch (operation) {
                    case ADD, SUBTRACT -> {
                        assertThat(first).isBetween(0, range);
                        assertThat(second).isBetween(0, range);
                        assertThat(expected).isBetween(0, range);
                    }
                    case MULTIPLY -> {
                        assertThat(first).isBetween(1, 10);
                        assertThat(second).isBetween(1, 10);
                    }
                    case DIVIDE -> {
                        assertThat(second).isBetween(1, 10);
                        assertThat(expected).isBetween(1, 10);
                        assertThat(first % second).isZero();
                    }
                }
            }
        }
    }

    @Test
    void selectsAllConfiguredOperationsAndAllCorrectLanes() {
        var configuration = new GameConfiguration(List.of(MathOperation.values()), 100, FlightSpeed.FAST);
        var operators = new HashSet<String>();
        var correctLanes = new HashSet<Integer>();
        for (int index = 1; index <= 500; index++) {
            var question = generator.create(configuration, index);
            operators.add(question.text().split(" ")[1]);
            correctLanes.add(question.answers().indexOf(question.correctAnswer()));
        }
        assertThat(operators).containsExactlyInAnyOrder("+", "−", "×", "÷");
        assertThat(correctLanes).containsExactlyInAnyOrder(0, 1, 2);
    }

    @Test
    void validatesAndDeduplicatesConfiguration() {
        assertThatIllegalArgumentException().isThrownBy(() -> new GameConfiguration(List.of(), 100, FlightSpeed.NORMAL));
        assertThatIllegalArgumentException().isThrownBy(() -> new GameConfiguration(null, 100, FlightSpeed.NORMAL));
        assertThatIllegalArgumentException().isThrownBy(() -> new GameConfiguration(List.of(MathOperation.ADD), 50, FlightSpeed.NORMAL));
        assertThatIllegalArgumentException().isThrownBy(() -> new GameConfiguration(List.of(MathOperation.ADD), 100, null));
        assertThat(new GameConfiguration(List.of(MathOperation.ADD, MathOperation.ADD), 20, FlightSpeed.NORMAL).operations())
                .containsExactly(MathOperation.ADD);
    }

    @Test
    void acceleratesAtQuestionTenAndNeverGoesBelowMinimum() {
        assertThat(FlightSpeed.NORMAL.durationFor(9)).isEqualTo(7_500);
        assertThat(FlightSpeed.NORMAL.durationFor(10)).isEqualTo(7_000);
        assertThat(FlightSpeed.NORMAL.durationFor(20)).isEqualTo(6_500);
        assertThat(FlightSpeed.FAST.durationFor(1_000)).isEqualTo(2_500);
    }
}
