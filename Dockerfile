FROM eclipse-temurin:27-jdk AS build
WORKDIR /build
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -ntp dependency:go-offline
COPY src/ src/
RUN ./mvnw -B -ntp verify

FROM eclipse-temurin:27-jre
WORKDIR /app
RUN groupadd --system quidditch && useradd --system --gid quidditch quidditch && mkdir /app/data && chown quidditch:quidditch /app/data
COPY --from=build /build/target/mathe-quidditch-1.0.0.jar /app/app.jar
USER quidditch
VOLUME ["/app/data"]
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-Dfile.encoding=UTF-8 -XX:MaxRAMPercentage=75"
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
