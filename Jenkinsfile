pipeline {
    agent any

    environment {
        DOCKERHUB_CRED = credentials('gradify-dockerhub-creds')
        DOCKER_USER = "${DOCKERHUB_CRED_USR}"
        EMAIL_RECIPIENT = credentials('gradify-email-recipient')
        PATH = "/usr/local/bin:/usr/local/go/bin:/usr/bin:/bin:/usr/sbin:/sbin:${env.PATH}"
        IMAGE_TAG = "${env.GIT_COMMIT ?: 'latest'}"
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
                            echo "Building Image: ${svc}:${env.IMAGE_TAG}"
                            if (javaServices.contains(svc)) {
                                sh "cp target/*.jar app.jar || echo 'No jar found'"
                            }
                            sh "docker build -t ${env.DOCKER_USER}/${svc}:${env.IMAGE_TAG} ."
                            sh "docker tag ${env.DOCKER_USER}/${svc}:${env.IMAGE_TAG} ${env.DOCKER_USER}/${svc}:latest"
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
                            echo "Pushing: ${svc}:${env.IMAGE_TAG}"
                            retry(3) {
                                sh "docker push ${env.DOCKER_USER}/${svc}:${env.IMAGE_TAG}"
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
                withCredentials([string(credentialsId: 'ansible-vault-password', variable: 'ANSIBLE_VAULT_PASS')]) {
                    sh '''
                        echo "$ANSIBLE_VAULT_PASS" > .vault_pass.txt
                        chmod 600 .vault_pass.txt
                        ansible-playbook ansible/deploy-k8s.yml --vault-password-file .vault_pass.txt
                        rm .vault_pass.txt
                    '''
                }
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