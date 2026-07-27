# We expect the JAR to be already built via Maven on the host (Jenkins workspace)
FROM eclipse-temurin:21-jre-jammy

WORKDIR /app

COPY app.jar app.jar

EXPOSE 8085

# Secrets injected at runtime via environment variables
CMD ["java", "-jar", "app.jar"]