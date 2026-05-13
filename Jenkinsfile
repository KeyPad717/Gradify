pipeline {
    agent any

    environment {
        DOCKERHUB_CRED = 'dockerhub-credentials'
        DOCKER_USER = 'adityadave29'
        EMAIL_RECIPIENT = 'keyworkmail2@gmail.com'
    }

    stages {
        stage('Unit Testing') {
            steps {
                echo "Running tests for all microservices using Docker containers..."
                
                // 1. Java Services (using Maven wrapper)
                script {
                    def javaServices = ['admin-service', 'professor-service', 'student-service', 'user-service']
                    for (svc in javaServices) {
                        dir(svc) {
                            echo "Testing ${svc}..."
                            sh './mvnw clean package -DskipTests=false'
                        }
                    }
                }

                // 2. Go Services (running inside Golang Docker container)
                echo "Testing Go services..."
                sh '''
                    docker run --rm -v $(pwd):/app -w /app/api-gateway golang:1.22-alpine go test ./...
                    docker run --rm -v $(pwd):/app -w /app/stats-service golang:1.22-alpine go test ./...
                '''

                // 3. Front-end (running inside Node Docker container)
                echo "Testing Front-end..."
                sh '''
                    docker run --rm -v $(pwd):/app -w /app/front-end node:20-alpine sh -c "npm ci && if npm run | grep -q 'test'; then npm run test; else echo 'No tests found'; fi"
                '''
            }
        }

        stage('Build Docker Images') {
            steps {
                script {
                    def services = ['admin-service', 'professor-service', 'student-service', 'user-service', 'api-gateway', 'stats-service', 'front-end']
                    for (svc in services) {
                        dir(svc) {
                            echo "Building ${svc}..."
                            // For Java services, ensure the jar is copied to app.jar
                            if (fileExists('target')) {
                                sh "cp target/*.jar app.jar || echo 'No jar found in target'"
                            }
                            sh "docker build -t ${env.DOCKER_USER}/${svc}:latest ."
                        }
                    }
                }
            }
        }

        stage('Push Docker Images') {
            steps {
                withCredentials([usernamePassword(credentialsId: env.DOCKERHUB_CRED, usernameVariable: 'DOCKER_USERNAME', passwordVariable: 'DOCKER_PASSWORD')]) {
                    sh 'echo $DOCKER_PASSWORD | docker login -u $DOCKER_USERNAME --password-stdin'
                    script {
                        def services = ['admin-service', 'professor-service', 'student-service', 'user-service', 'api-gateway', 'stats-service', 'front-end']
                        for (svc in services) {
                            echo "Pushing ${svc}..."
                            sh "docker push ${env.DOCKER_USER}/${svc}:latest"
                        }
                    }
                }
            }
        }

        stage('Deploy via Ansible') {
            steps {
                echo "Deploying via Ansible container..."
                // Using an ansible container to ensure the command is available
                sh '''
                    docker run --rm -v $(pwd):/app -w /app/ansible \
                    -v $HOME/.kube:/root/.kube \
                    willhallonline/ansible:latest \
                    ansible-playbook -i inventory.ini deploy-k8s.yml
                '''
            }
        }
    }

    post {
        failure {
            mail to: "${env.EMAIL_RECIPIENT}",
                 subject: "Pipeline Failed: ${currentBuild.fullDisplayName}",
                 body: "The Gradify Jenkins pipeline failed. Please check the Jenkins console output."
        }
        success {
            mail to: "${env.EMAIL_RECIPIENT}",
                 subject: "Pipeline Succeeded: ${currentBuild.fullDisplayName}",
                 body: "The Gradify application was successfully tested, built, pushed, and deployed."
        }
    }
}
