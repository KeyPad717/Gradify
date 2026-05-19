# We expect the JAR to be already built via Maven on the host (Jenkins workspace)
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY app.jar app.jar

ENV SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhleXV2bHdlcGVwdm1lbnp3YXJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzkwNTEyOSwiZXhwIjoyMDg5NDgxMTI5fQ.RXax6RMpJPqRAN7cZsEoM-aTVhYkehDHDmfMPU-yMgs"
EXPOSE 8083

CMD ["java", "-jar", "app.jar"]
