# We expect the JAR to be already built via Maven on the host (Jenkins workspace)
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY app.jar app.jar

EXPOSE 8081

CMD ["java", "-jar", "app.jar"]
