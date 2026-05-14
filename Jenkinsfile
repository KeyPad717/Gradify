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
        SERVICES_TO_BUILD = ""
    }

    stages {
        stage('Detect Changes') {
            steps {
                script {
                    echo "Starting Microservice Change Detection..."
                    def changedFiles = []
                    
                    // 1. Collect all changed files from the changeset
                    currentBuild.changeSets.each { changeLogSet ->
                        changeLogSet.items.each { entry ->
                            entry.affectedFiles.each { file ->
                                def path = file.path.toString()
                                echo "DEBUG: Detected file change: ${path}"
                                changedFiles.add(path)
                            }
                        }
                    }
                    
                    def allServices = ['admin-service', 'professor-service', 'student-service', 'user-service', 'api-gateway', 'stats-service', 'front-end']
                    def changed = []
                    
                    // 2. Identify manual vs automated builds
                    if (changedFiles.isEmpty()) {
                        echo "No changesets found. Defaulting to FULL BUILD for all services."
                        changed = allServices
                    } else {
                        // Check for global config changes first
                        def hasGlobal = false
                        for (f in changedFiles) {
                            if (f == "Jenkinsfile" || f.startsWith("k8s/") || f.startsWith("ansible/") || !f.contains("/")) {
                                hasGlobal = true
                                break
                            }
                        }
                        
                        if (hasGlobal) {
                            echo "Global configuration change detected. Building ALL services."
                            changed = allServices
                        } else {
                            // Match files to service folders
                            for (svc in allServices) {
                                echo "Checking if ${svc} needs building..."
                                for (f in changedFiles) {
                                    if (f.startsWith(svc + "/")) {
                                        echo "MATCH: ${f} belongs to ${svc}. Adding to build list."
                                        changed.add(svc)
                                        break
                                    }
                                }
                            }
                        }
                    }
                    
                    // 3. Finalize the build list
                    if (changed.isEmpty() && !changedFiles.isEmpty()) {
                        echo "Unknown changes detected. Falling back to FULL BUILD for safety."
                        changed = allServices
                    }
                    
                    env.SERVICES_TO_BUILD = changed.unique().join(',')
                    echo "PIPELINE_PLAN: The following services will be processed: [${env.SERVICES_TO_BUILD}]"
                }
            }
        }

        stage('Unit Testing') {
            steps {
                script {
                    if (!env.SERVICES_TO_BUILD) {
                        echo "No services identified for testing."
                        return
                    }
                    
                    def services = env.SERVICES_TO_BUILD.split(',')
                    def javaServices = ['admin-service', 'professor-service', 'student-service', 'user-service']
                    
                    for (svc in services) {
                        if (!svc) continue
                        
                        if (javaServices.contains(svc)) {
                            dir(svc) {
                                echo "Building JAR: ${svc} (Skipping tests)..."
                                sh './mvnw clean package -DskipTests=true'
                            }
                        } else if (svc == 'api-gateway' || svc == 'stats-service') {
                            dir(svc) { 
                                echo "Testing Go service: ${svc}"
                                sh 'go test ./...' 
                            }
                        } else if (svc == 'front-end') {
                            dir('front-end') {
                                echo "Building Frontend Production Bundle..."
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
                    if (!env.SERVICES_TO_BUILD) return
                    def services = env.SERVICES_TO_BUILD.split(',')
                    def javaServices = ['admin-service', 'professor-service', 'student-service', 'user-service']
                    
                    for (svc in services) {
                        if (!svc) continue
                        dir(svc) {
                            echo "Building Docker Image for: ${svc}"
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
                        if (!env.SERVICES_TO_BUILD) return
                        def services = env.SERVICES_TO_BUILD.split(',')
                        
                        for (svc in services) {
                            if (!svc) continue
                            echo "Pushing Image: ${svc} to DockerHub..."
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
