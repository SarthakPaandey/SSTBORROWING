# VIVA Preparation Guide: Advanced DevOps CI/CD Project

Use this guide to prepare for your VIVA. The examiners will focus on the **"Why"** behind your decisions, not just the tools.

---

## 1. CI/CD Pipeline Architecture
### **Q: Why did you separate the CI and CD pipelines?**
*   **Separation of Concerns**: CI is about **validation** (linting, testing, security scans); CD is about **delivery** (pushing images, deploying to environments).
*   **Efficiency**: You don't want to push a Docker image to the registry if the tests fail. By separating them, the CD pipeline only triggers if the CI pipeline is successful (Gatekeeping).
*   **Governance**: In a real-world scenario, you might have a manual approval step between CI and CD.

### **Q: Explain the flow of your pipeline.**
1.  **CI (ci.yml)**: Triggered on code push. Runs Linting -> Unit Tests -> SAST (CodeQL) -> SCA (Audit) -> Build -> Docker Build -> Trivy Scan -> Smoke Test.
2.  **CD (cd.yml)**: Triggered after CI succeeds on `main`. Runs Registry Push -> Kubernetes Deploy -> DAST Scan.

---

## 2. DevSecOps & Security Gates
### **Q: What is the difference between SAST, SCA, and DAST?**
*   **SAST (Static Application Security Testing)**: 
    *   **Tool**: GitHub CodeQL.
    *   **Focus**: Scans the **source code** for vulnerabilities (e.g., SQL injection, XSS) before the app is built. (White-box testing).
*   **SCA (Software Composition Analysis)**:
    *   **Tool**: `pnpm audit`.
    *   **Focus**: Scans **third-party dependencies** for known vulnerabilities (supply chain security).
*   **DAST (Dynamic Application Security Testing)**:
    *   **Tool**: Custom script / Baseline scan.
    *   **Focus**: Scans the **running application** for runtime issues like missing security headers or exposed paths. (Black-box testing).

### **Q: What is Shift-Left Security?**
*   It means moving security practices earlier in the development lifecycle. Instead of scanning for bugs once the app is in production, we catch them during the CI phase (SAST/SCA).

---

## 3. Containerization (Docker)
### **Q: Why did you use a Multi-Stage Dockerfile?**
*   **Smaller Image Size**: We use a large image for building (node) but copy only the final `standalone` files to a tiny image (alpine).
*   **Security**: The production image doesn't contain build tools (like `npm` or `git`), reducing the attack surface.
*   **Performance**: Smaller images pull and deploy faster in Kubernetes.

### **Q: What risk does the "Container Smoke Test" mitigate?**
*   It ensures that the container actually starts and listens on its port before we push it to the registry. This prevents "broken" images from ever reaching DockerHub.

---

## 4. Kubernetes (CD)
### **Q: Why did you use Kind for deployment?**
*   Kind (Kubernetes in Docker) allows us to simulate a production-grade Kubernetes environment directly inside our CI runner without needing a cloud provider (AWS/GCP).

### **Q: What are the core Kubernetes manifests you used?**
*   **Deployment**: Manages the pods and ensures the desired number of replicas are running.
*   **Service**: Exposes the application to the network.
*   **ConfigMap/Secret**: Handles environment variables and sensitive credentials.

---

## 5. Secrets Management & Security
### **Q: Why don't you have secrets hardcoded in your Kubernetes YAML?**
*   **Best Practice**: Hardcoding secrets in version control (Git) is a major security risk. 
*   **Mechanism**: I use **Placeholders** (e.g., `MONGODB_URI_PLACEHOLDER`) in the `secret.yaml` file.
*   **Secret Injection**: During the CD pipeline (`cd.yml`), I use a **Secret Injection** step (via `sed`) to replace these placeholders with real values. In a production environment, these real values would be fetched from GitHub Actions Secrets.

### **Q: What is the risk of "Secrets in Git"?**
*   If anyone gets access to the repository (or if it accidentally becomes public), they gain access to your database, API keys, and sensitive user data. This violates the **III. Config** principle of the 12-Factor App.

---

## 6. Manifest Optimization & Environment
### **Q: Why are there placeholders in your deployment.yaml?**
*   **Avoid Hardcoding**: Just like secrets, the Docker image name/tag should not be hardcoded. This allows the same YAML to be used for different images (e.g., `staging` vs `production`).
*   **Dynamic Injection**: The CD pipeline injects the correct image tag using `sed` during deployment.

### **Q: Why did you add a MongoDB manifest (mongodb.yaml)?**
*   **Self-Contained Env**: To make the Kind cluster realistic, it needs a database. By deploying Mongo inside the cluster, the application can verify database connectivity during the DAST and Runtime tests.
*   **Service Discovery**: The application connects to `mongodb://mongo-service:27017` using Kubernetes internal DNS.

---

## 7. Metrics & Success


### **Q: How does this pipeline improve software delivery? (The "DORA" Metrics)**
*   **Deployment Frequency**: Automated pipelines allow us to deploy more often.
*   **Lead Time for Changes**: Manual work is eliminated, so code goes to prod faster.
*   **Change Failure Rate**: Automated testing and security gates ensure only high-quality code is deployed.

---

## 8. Advanced / Troubleshooting
### **Q: Your DAST stage only checks headers. Is that enough?**
*   **Answer**: For this project, it's a **Baseline DAST**. In a full production environment, I would integrate a tool like **OWASP ZAP** or **Burp Suite** to perform active scanning (SQLi, XSS probing). The current stage proof-of-concept shows *where* and *how* DAST fits into the lifecycle.

### **Q: What happens if a critical vulnerability is found in the Trivy scan?**
*   **Answer**: The pipeline is configured to **Fail-Fast**. The `trivy-action` will exit with a non-zero code if it finds "CRITICAL" or "HIGH" issues, stopping the pipeline and preventing the image from being pushed to the registry.

### **Q: How do you handle "False Positives" in security scans?**
*   **Answer**: I would use a **.trivyignore** or **CodeQL suppression** file to document and skip vulnerabilities that are verified as not applicable to our specific environment, ensuring they don't break the build repeatedly.

---

## Pro-Tips for the VIVA:
1.  **Don't just name tools**: Instead of saying "I used Trivy," say "I used Trivy to scan my container images for OS-level vulnerabilities to prevent shipping insecure images."
2.  **Mention the 12-Factor App**: Explain that your app follows the 12-factor principles (especially **III. Config** for secrets and **V. Build, release, run** for the separation of CI/CD).
3.  **Be Honest**: If asked about the DAST, explain it's a baseline implementation focused on security headers and path probing to demonstrate the DevSecOps lifecycle.
