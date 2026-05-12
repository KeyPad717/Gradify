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
        checkout([
            $class: 'GitSCM',
            branches: [[name: '*/master']],
            userRemoteConfigs: [[
                url: 'https://github.com/adityadave29/Gradify.git'
            ]],
            extensions: [
                [$class: 'CloneOption',
                    shallow: true,
                    depth: 1,
                    noTags: true
                ]
            ]
        ])
    }
}

        stage('Environment Verification') {
            steps {
                echo "Starting in a clean environment: Pruning unused Docker data to free up space..."
                sh 'docker system prune -af --volumes || true'
                
                script {
                    echo "Checking available storage space..."
                    // Get disk usage percentage of the root partition
                    def dfOutput = sh(script: ''' df -h / | awk 'NR==2 {print $5}' | sed 's/%//' ''',returnStdout: true).trim()                    
                    def usage = dfOutput.toInteger()
                    echo "Current disk usage is at ${usage}%"
                    
                    if (usage > 85) {
                        error("Disk usage is critically high (${usage}%). Failing pipeline to prevent deployment issues.")
                    } else {
                        echo "Sufficient storage available. Moving forward with the pipeline."
                    }
                }
            }
        }

        stage('Unit Testing') {
            steps {
                echo "Running tests for all microservices..."
                
                // Java Services
                dir('admin-service') { sh './mvnw clean package' }
                dir('professor-service') { sh './mvnw clean package' }
                dir('student-service') { sh './mvnw clean package' }
                dir('user-service') { sh './mvnw clean package' }

                // Go Services
                dir('api-gateway') { sh 'go test ./...' }
                dir('stats-service') { sh 'go test ./...' }

                // Front-end
                dir('front-end') {
                    sh 'npm ci'

                    // Run tests only if test script exists
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
                    def javaServices = ['admin-service', 'professor-service', 'student-service', 'user-service']
                    def otherServices = ['api-gateway', 'stats-service', 'front-end']
                    
                    for (int i = 0; i < javaServices.size(); ++i) {
                        def svc = javaServices[i]
                        dir(svc) {
                            echo "Building ${svc}..."
                            sh "cp target/*.jar app.jar"
                            sh "docker build -t ${env.DOCKER_USER}/${svc}:latest ."
                        }
                    }
                    
                    for (int i = 0; i < otherServices.size(); ++i) {
                        def svc = otherServices[i]
                        dir(svc) {
                            echo "Building ${svc}..."
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
                        for (int i = 0; i < services.size(); ++i) {
                            def svc = services[i]
                            dir(svc) {
                                echo "Pushing ${svc}..."
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
