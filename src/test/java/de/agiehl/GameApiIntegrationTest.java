package de.agiehl;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.net.CookieManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:api-test;DB_CLOSE_DELAY=-1",
        "spring.main.banner-mode=off"
})
class GameApiIntegrationTest {

    @LocalServerPort
    private int port;

    @Test
    void exposesPlayableSessionBoundGameAndPersistentScoreApi() throws Exception {
        var client = HttpClient.newBuilder().cookieHandler(new CookieManager()).build();
        var created = post(client, "/api/games", """
                {"operations":["ADD","MULTIPLY"],"range":100,"speed":"NORMAL"}
                """);
        assertThat(created.statusCode()).isEqualTo(200);
        assertThat(created.body()).contains("\"status\":\"PLAYING\"", "\"score\":0", "\"answers\":[");
        assertThat(created.body()).doesNotContain("\"correctAnswer\":0");
        String id = idFrom(created.body());
        var foreignClient = HttpClient.newHttpClient();
        assertThat(get(foreignClient, "/api/games/" + id).statusCode()).isEqualTo(404);
        var paused = post(client, "/api/games/" + id + "/pause", "{}");
        assertThat(paused.body()).contains("\"status\":\"PAUSED\"", "\"phase\":\"PLAYING\"");
        assertThat(post(client, "/api/games/" + id + "/resume", "{}").body()).contains("\"status\":\"PLAYING\"");
        assertThat(post(client, "/api/games/" + id + "/boost", "{}").statusCode()).isEqualTo(200);
        assertThat(post(client, "/api/highscores", "{\"gameId\":\"" + id + "\",\"name\":\"Alex\"}").statusCode()).isEqualTo(409);
        var questionId = Pattern.compile("\"question\":\\{\"id\":\"([^\"]+)\"").matcher(created.body());
        var questionText = Pattern.compile("\"text\":\"([^\"]+)\"").matcher(created.body());
        var answers = Pattern.compile("\"answers\":\\[([^]]+)\\]").matcher(created.body());
        assertThat(questionId.find()).isTrue();
        assertThat(questionText.find()).isTrue();
        assertThat(answers.find()).isTrue();
        var values = answers.group(1).split(",");
        int correctLane = -1;
        for (int lane = 0; lane < values.length; lane++) {
            if (Integer.parseInt(values[lane].strip()) == GameServiceTest.solution(questionText.group(1))) {
                correctLane = lane;
            }
        }
        assertThat(correctLane).isBetween(0, 2);
        String answer = "{\"questionId\":\"" + questionId.group(1) + "\",\"lane\":" + correctLane + ",\"requestId\":\"http-answer\"}";
        var rewarded = post(client, "/api/games/" + id + "/answers", answer);
        assertThat(rewarded.statusCode()).isEqualTo(200);
        assertThat(rewarded.body()).contains("\"status\":\"REWARD\"", "\"correctAnswers\":1", "\"correctCount\":1");
        assertThat(post(client, "/api/games/" + id + "/answers", answer).body()).isEqualTo(rewarded.body());
        assertThat(post(client, "/api/games/" + id + "/finish", "{}").body()).contains("\"status\":\"FINISHED\"");
        var saved = post(client, "/api/highscores", "{\"gameId\":\"" + id + "\",\"name\":\"Alex\",\"score\":999999}");
        assertThat(saved.statusCode()).isEqualTo(200);
        assertThat(saved.body()).contains("\"name\":\"Alex\"", "\"score\":100", "\"rank\":1");
        assertThat(saved.body()).doesNotContain("999999");
        assertThat(get(foreignClient, "/api/highscores").body()).contains("Alex");
    }

    @Test
    void rejectsInvalidConfigurationAndMalformedAnswerWithoutServerError() throws Exception {
        var client = HttpClient.newBuilder().cookieHandler(new CookieManager()).build();
        assertThat(post(client, "/api/games", "{\"operations\":[],\"range\":100,\"speed\":\"NORMAL\"}").statusCode()).isEqualTo(400);
        assertThat(post(client, "/api/games", "{\"operations\":[\"UNKNOWN\"],\"range\":100,\"speed\":\"NORMAL\"}").statusCode()).isEqualTo(400);
        assertThat(post(client, "/api/games", "{\"operations\":[\"ADD\"],\"range\":50,\"speed\":\"NORMAL\"}").statusCode()).isEqualTo(400);
        var created = post(client, "/api/games", "{\"operations\":[\"ADD\"],\"range\":20,\"speed\":\"RELAXED\"}");
        String id = idFrom(created.body());
        var invalid = post(client, "/api/games/" + id + "/answers", "{\"questionId\":\"unknown\",\"lane\":9,\"requestId\":\"invalid\"}");
        assertThat(invalid.statusCode()).isEqualTo(400);
        assertThat(invalid.body()).contains("message");
        assertThat(get(client, "/api/games/" + id).body()).contains("\"status\":\"PLAYING\"");
    }

    private String idFrom(String json) {
        var matcher = Pattern.compile("\"id\":\"([^\"]+)\"").matcher(json);
        assertThat(matcher.find()).isTrue();
        return matcher.group(1);
    }

    private HttpResponse<String> post(HttpClient client, String path, String json) throws IOException, InterruptedException {
        return client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(json)).build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> get(HttpClient client, String path) throws IOException, InterruptedException {
        return client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).GET().build(),
                HttpResponse.BodyHandlers.ofString());
    }
}
