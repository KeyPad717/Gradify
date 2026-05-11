pipeline {
    agent any

    environment {
        // Docker Hub credentials should be stored in Jenkins with this ID
        DOCKERHUB_CRED = 'dockerhub-credentials'
        DOCKER_USER = 'key717'
        EMAIL_RECIPIENT = 'keyworkmail2@gmail.com'
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'master', url: 'https://github.com/adityadave29/Gradify.git'
            }
        }

        stage('Unit Testing') {
            steps {
                echo "Running tests for all microservices..."
                
                // Java Services
                dir('admin-service') { sh './mvnw clean test' }
                dir('professor-service') { sh './mvnw clean test' }
                dir('student-service') { sh './mvnw clean test' }
                dir('user-service') { sh './mvnw clean test' }

                // Go Services
                dir('api-gateway') { sh 'go test ./...' }
                dir('stats-service') { sh 'go test ./...' }

                // Front-end
                dir('front-end') { 
                    sh 'npm install'
                    sh 'npm run test' 
                }
            }
        }

        stage('Build & Push Docker Images') {
            steps {
                withCredentials([usernamePassword(credentialsId: env.DOCKERHUB_CRED, usernameVariable: 'DOCKER_USERNAME', passwordVariable: 'DOCKER_PASSWORD')]) {
                    sh 'echo $DOCKER_PASSWORD | docker login -u $DOCKER_USERNAME --password-stdin'

                    script {
                        def services = ['admin-service', 'professor-service', 'student-service', 'user-service', 'api-gateway', 'stats-service', 'front-end']
                        for (int i = 0; i < services.size(); ++i) {
                            def svc = services[i]
                            dir(svc) {
                                echo "Building and Pushing ${svc}..."
                                sh "docker build -t ${env.DOCKER_USER}/${svc}:latest ."
                                sh "docker push ${env.DOCKER_USER}/${svc}:latest"
                            }
                        }
                    }
                }
            }
        }

        stage('Deploy via Ansible') {
            steps {
                dir('ansible') {
                    // This triggers the ansible playbook to apply the k8s manifests
                    sh 'ansible-playbook -i inventory.ini deploy-k8s.yml'
                }
            }
        }
    }

    post {
        failure {
            mail to: "${env.EMAIL_RECIPIENT}",
                 subject: "Pipeline Failed: ${currentBuild.fullDisplayName}",
                 body: "The Gradify Jenkins pipeline failed. Please check the Jenkins console output to find the error."
        }
        success {
            mail to: "${env.EMAIL_RECIPIENT}",
                 subject: "Pipeline Succeeded: ${currentBuild.fullDisplayName}",
                 body: "The Gradify application was successfully tested, built, pushed, and deployed via Ansible."
        }
    }
}
