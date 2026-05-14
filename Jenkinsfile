pipeline {
    agent any
    // commeny added for poll SCM
    environment {
        DOCKERHUB_CRED = 'docker-creds'
        DOCKER_USER = 'adityadave29'
        EMAIL_RECIPIENT = 'daveadityan2004@gmail.com'
        PATH = "/opt/homebrew/bin:/usr/local/bin:/usr/local/go/bin:/usr/bin:/bin:/usr/sbin:/sbin:${env.PATH}"
        
        // This will store the list of services that actually changed
        CHANGED_SERVICES = ""
    }

    stages {
        stage('Detect Changes') {
            steps {
                script {
                    echo "Detecting which microservices changed..."
                    def changedFiles = []
                    
                    currentBuild.changeSets.each { changeLogSet ->
                        changeLogSet.items.each { entry ->
                            entry.affectedFiles.each { file ->
                                echo "FILE CHANGED: ${file.path}"
                                changedFiles.add(file.path)
                            }
                        }
                    }
                    
                    def allServices = ['admin-service', 'professor-service', 'student-service', 'user-service', 'api-gateway', 'stats-service', 'front-end']
                    def changed = []
                    
                    // FALLBACK: If manual build or root config change, build everything
                    def isManual = changedFiles.isEmpty()
                    def hasGlobalChanges = changedFiles.any { it == "Jenkinsfile" || it.startsWith("k8s/") || it.startsWith("ansible/") || !it.contains("/") }
                    
                    if (isManual || hasGlobalChanges) {
                        echo isManual ? "Manual build. Building all." : "Global/Root changes detected. Building all."
                        changed = allServices
                    } else {
                        allServices.each { svc ->
                            if (changedFiles.any { it.contains(svc + "/") }) {
                                changed.add(svc)
                            }
                        }
                    }
                    
                    // If we found files but they didn't match any service, build all to be safe
                    if (!isManual && changed.isEmpty()) {
                        echo "Unknown changes detected. Falling back to Full Build."
                        changed = allServices
                    }
                    
                    env.CHANGED_SERVICES = changed.unique().join(',')
                    echo "Final Services to build: ${env.CHANGED_SERVICES}"
                }
            }
        }

        stage('Unit Testing') {
            steps {
                script {
                    if (!env.CHANGED_SERVICES) {
                        echo "No services to test."
                        return
                    }
                    def services = env.CHANGED_SERVICES.split(',')
                    def javaServices = ['admin-service', 'professor-service', 'student-service', 'user-service']
                    
                    services.each { svc ->
                        if (!svc) return
                        if (javaServices.contains(svc)) {
                            dir(svc) {
                                echo "Building JAR for ${svc} (Skipping tests due to DB connectivity)..."
                                sh './mvnw clean package -DskipTests=true'
                            }
                        } else if (svc == 'api-gateway' || svc == 'stats-service') {
                            dir(svc) { 
                                echo "Testing Go service: ${svc}"
                                sh 'go test ./...' 
                            }
                        } else if (svc == 'front-end') {
                            dir('front-end') {
                                echo "Installing and building Frontend..."
                                sh 'npm install && npm run build'
                            }
                        }
                    }
                }
            }
        }

        stage('Build Docker Images') {
            steps {
                script {
                    if (!env.CHANGED_SERVICES) return
                    def services = env.CHANGED_SERVICES.split(',')
                    def javaServices = ['admin-service', 'professor-service', 'student-service', 'user-service']
                    
                    services.each { svc ->
                        if (!svc) return
                        dir(svc) {
                            echo "Building Docker Image: ${svc}..."
                            if (javaServices.contains(svc)) {
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
                        if (!env.CHANGED_SERVICES) return
                        def services = env.CHANGED_SERVICES.split(',')
                        
                        services.each { svc ->
                            if (!svc) return
                            echo "Pushing Image: ${svc}..."
                            retry(3) {
                                sh "docker push ${env.DOCKER_USER}/${svc}:latest"
                            }
                        }
                    }
                }
            }
        }

        stage('Deploy with Ansible') {
            steps {
                echo "Deploying Gradify using Ansible..."
                sh '''
                    # Create a temporary password file for Ansible Vault
                    echo "1089" > .vault_pass.txt
                    chmod 600 .vault_pass.txt
                    
                    # Run the Ansible playbook
                    ansible-playbook ansible/deploy-k8s.yml --vault-password-file .vault_pass.txt
                    
                    # Clean up the password file
                    rm .vault_pass.txt
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
