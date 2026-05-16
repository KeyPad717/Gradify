pipeline {
    agent any
    // commeny added for poll SCM
    environment {
        DOCKERHUB_CRED = 'adityadave29-docker-creds'
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
                    
                    currentBuild.changeSets.each { changeLogSet ->
                        changeLogSet.items.each { entry ->
                            entry.affectedFiles.each { file ->
                                def path = file.path.toString()
                                echo "DEBUG-DETECTION-NEW: Detected file change: ${path}"
                                changedFiles.add(path)
                            }
                        }
                    }
                    
                    def allServices = ['admin-service', 'professor-service', 'student-service', 'user-service', 'api-gateway', 'stats-service', 'front-end']
                    def matchedServices = []
                    
                    if (changedFiles.isEmpty()) {
                        echo "No changesets found. Defaulting to FULL BUILD."
                        matchedServices = allServices
                    } else {
                        def hasGlobal = false
                        for (f in changedFiles) {
                            if (f == "Jenkinsfile" || f.startsWith("k8s/") || f.startsWith("ansible/") || !f.contains("/")) {
                                hasGlobal = true
                                break
                            }
                        }
                        
                        if (hasGlobal) {
                            echo "Global change detected. Building ALL."
                            matchedServices = allServices
                        } else {
                            for (svc in allServices) {
                                for (f in changedFiles) {
                                    if (f.startsWith(svc + "/")) {
                                        echo "MATCH FOUND: ${svc}"
                                        matchedServices.add(svc)
                                        break
                                    }
                                }
                            }
                        }
                    }
                    
                    if (matchedServices.isEmpty() && !changedFiles.isEmpty()) {
                        echo "Unknown changes. Falling back to FULL BUILD."
                        matchedServices = allServices
                    }
                    
                    // Manually build the comma-separated string for maximum compatibility
                    def uniqueList = matchedServices.unique()
                    def finalString = ""
                    for (int i = 0; i < uniqueList.size(); i++) {
                        if (i == 0) {
                            finalString = uniqueList[i]
                        } else {
                            finalString = finalString + "," + uniqueList[i]
                        }
                    }
                    
                    env.GRADIFY_BUILD_LIST = finalString
                    echo "PIPELINE_PLAN: Services to process: [${env.GRADIFY_BUILD_LIST}]"
                }
            }
        }

        stage('Unit Testing') {
            steps {
                script {
                    if (!env.GRADIFY_BUILD_LIST) {
                        echo "No services to test."
                        return
                    }
                    
                    def services = env.GRADIFY_BUILD_LIST.split(',')
                    def javaServices = ['admin-service', 'professor-service', 'student-service', 'user-service']
                    
                    for (svc in services) {
                        if (!svc) continue
                        if (javaServices.contains(svc)) {
                            dir(svc) {
                                echo "Running Java Tests and Building: ${svc}"
                                sh './mvnw clean package'
                            }
                        } else if (svc == 'api-gateway' || svc == 'stats-service') {
                            dir(svc) { sh 'go test -v ./...' }
                        } else if (svc == 'front-end') {
                            dir('front-end') {
                                sh 'npm install && npm test'
                            }
                        }
                    }
                }
            }
        }

        stage('Build Docker Images') {
            steps {
                script {
                    if (!env.GRADIFY_BUILD_LIST) return
                    def services = env.GRADIFY_BUILD_LIST.split(',')
                    def javaServices = ['admin-service', 'professor-service', 'student-service', 'user-service']
                    
                    for (svc in services) {
                        if (!svc) continue
                        dir(svc) {
                            echo "Building Image: ${svc}"
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
                        if (!env.GRADIFY_BUILD_LIST) return
                        def services = env.GRADIFY_BUILD_LIST.split(',')
                        
                        for (svc in services) {
                            if (!svc) continue
                            echo "Pushing: ${svc}"
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
