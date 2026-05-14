pipeline {
    agent any

    environment {
        DOCKERHUB_CRED = 'docker-creds'
        DOCKER_USER = 'adityadave29'
        EMAIL_RECIPIENT = 'daveadityan2004@gmail.com'
        // Add both Intel and Apple Silicon Mac tool paths
        PATH = "/opt/homebrew/bin:/usr/local/bin:/usr/local/go/bin:/usr/bin:/bin:/usr/sbin:/sbin:${env.PATH}"
    }

    stages {
        stage('Unit Testing') {
            steps {
                echo "Running tests for all microservices..."
                
                // 1. Java Services
                script {
                    def javaServices = ['admin-service', 'professor-service', 'student-service', 'user-service']
                    for (svc in javaServices) {
                        dir(svc) {
                            echo "Testing ${svc}..."
                            sh './mvnw clean package -DskipTests=false'
                        }
                    }
                }

                // 2. Go Services
                dir('api-gateway') { sh 'go test ./...' }
                dir('stats-service') { sh 'go test ./...' }

                // 3. Front-end
                dir('front-end') {
                    sh 'npm install' // Using npm install directly on host
                    sh '''
                        if npm run | grep -q "test"; then
                            npm run test
                        else
                            echo "No frontend tests found, skipping..."
                        fi
                    '''
                }
            }
        }

        stage('Build Docker Images') {
            steps {
                script {
                    def services = ['admin-service', 'professor-service', 'student-service', 'user-service', 'api-gateway', 'stats-service', 'front-end']
                    for (svc in services) {
                        dir(svc) {
                            echo "Building ${svc}..."
                            if (fileExists('target')) {
                                sh "cp target/*.jar app.jar || echo 'No jar found'"
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
                    retry(3) {
                        sh 'echo $DOCKER_PASSWORD | docker login -u $DOCKER_USERNAME --password-stdin'
                    }
                    script {
                        def services = ['admin-service', 'professor-service', 'student-service', 'user-service', 'api-gateway', 'stats-service', 'front-end']
                        for (svc in services) {
                            echo "Pushing ${svc}..."
                            retry(3) {
                                sh "docker push ${env.DOCKER_USER}/${svc}:latest"
                            }
                        }
                    }
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                echo "Checking Kubernetes cluster status..."
                sh '''
                    # Show current context for debugging
                    kubectl config current-context || echo "No context set"
                    
                    # Try to check connectivity
                    if ! kubectl cluster-info > /dev/null 2>&1; then
                        echo "Cluster unreachable. Attempting to start minikube..."
                        if command -v minikube > /dev/null 2>&1; then
                            minikube start --wait=all
                        else
                            echo "ERROR: Cluster is down and 'minikube' command not found. Please start your cluster manually."
                            exit 1
                        fi
                    fi
                '''
                
                echo "Deploying Gradify to Kubernetes..."
                sh '''
                    rm -rf /tmp/gradify-k8s-deploy
                    mkdir -p /tmp/gradify-k8s-deploy
                    cp k8s/*.yaml /tmp/gradify-k8s-deploy/
                    cp k8s/lpg/*.yaml /tmp/gradify-k8s-deploy/
                    kubectl apply -f /tmp/gradify-k8s-deploy/ --validate=false
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
