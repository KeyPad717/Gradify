# We expect the JAR to be already built via Maven on the host (Jenkins workspace)
FROM eclipse-temurin:21-jre-jammy

WORKDIR /app

COPY target/user-service-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8081

CMD ["java", "-jar", "app.jar"]
