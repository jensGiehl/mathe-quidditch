package de.agiehl;

import java.time.Clock;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class MatheQuidditchApplication {

    public static void main(String[] args) {
        SpringApplication.run(MatheQuidditchApplication.class, args);
    }

    @Bean
    Clock gameClock() {
        return Clock.systemUTC();
    }
}
