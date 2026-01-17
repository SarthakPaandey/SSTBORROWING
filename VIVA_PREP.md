# 🎓 DevOps VIVA Preparation Guide

This guide covers the technical architecture and "Why" behind the decisions made in the SST Booking System DevOps project.

---

## 🏗️ Pillar 1: The CI/CD Pipeline (GitHub Actions)
Our pipeline has **10 Stages** implementing the "Shift-Left" security principle.

### Key Stages:
1.  **Lint & Code Quality**: Uses ESLint to ensure code follows standards and catches common errors before build.
2.  **Unit Tests**: Uses Vitest. *Critical for catching regressions.*
3.  **SAST (CodeQL)**: Static Application Security Testing. Analyzes source code for security flaws (XSS, SQL Injection).
4.  **SCA (pnpm audit)**: Software Composition Analysis. Scans `package.json` for libraries with known vulnerabilities.
5.  **Build Application**: Validates that Next.js can compile successfully.
6.  **Docker Build**: Creates the container image.
7.  **Trivy Scan**: Container scanner that finds vulnerabilities in the OS (Alpine) and system libraries.
8.  **Container Runtime Test**: A "Smoke Test" where we spin up the container briefly to see if it actually starts.
9.  **Push to DockerHub**: Automates artifact management.
10. **Kubernetes Deploy**: Applies manifests to the cluster.

---

## 🐋 Pillar 2: Docker & Containerization
We use a **Multi-Stage Dockerfile**.

### Why Multi-Stage?
1.  **Small Image Size**: Our final image is only ~150MB because we leave out the build tools (pnpm, devDependencies) in the final `runner` stage.
2.  **Security**: The production image doesn't contain the source code or build tools, making it harder to attack.
3.  **Layer Caching**: Speeds up reconstruction by reusing unchanged layers (like dependencies).

### Base Image:
- `node:20-alpine`: We use **Alpine** because it's tiny and secure.

---

## ☸️ Pillar 3: Kubernetes (K8s)
We deployed to **Minikube** using 5 main resource types.

1.  **Namespace**: Logical isolation for our app.
2.  **ConfigMap**: Handles non-sensitive config (NODE_ENV, URLs). 
3.  **Secret**: Handles sensitive data (MongoDB URI, Auth secrets).
4.  **Deployment**: 
    - **2 Replicas**: For High Availability. If one pod fails, the other keeps working.
    - **RollingUpdate**: Zero-downtime deployment. It starts new pods before killing old ones.
    - **Probes**: Liveness (restarts if unhealthy) and Readiness (stops traffic if busy).
5.  **Service (NodePort)**: Exposes the app to the external network.

---

## 🛠️ Pillar 4: Real-world Fixes (What we solved)
*This shows you actually DID the work.*

1.  **YAML Syntax Error**: Fixed indentation in `ci.yml` (YAML is whitespace sensitive).
2.  **Vitest Watch Mode**: Fixed the CI hang by changing `vitest` to `vitest run` (CI cannot be interactive).
3.  **Architecture Mismatch**: Built a local ARM64 image because your Mac (Apple Silicon) couldn't run the AMD64 (Intel) image built by GitHub's default runners.
4.  **Missing Env Vars**: Fixed build failures by injecting `QR_HMAC_SECRET` and `MONGODB_URI` placeholders during the build stage.

---

## ❓ 5 Hardest Questions & Answers

**Q1: What is the benefit of "Shift-Left" security?**
*A: It means security testing starts as early as possible in the development process (during Lint/Test). This prevents costly security fixes in production.*

**Q2: Why use Kubernetes instead of just running Docker containers?**
*A: Kubernetes provides **Orchestration**: auto-scaling, self-healing (auto-restarting pods), zero-downtime updates, and load balancing across nodes.*

**Q3: How do you manage secrets in K8s securely?**
*A: We use `kind: Secret` which is base64 encoded. In real production, we would use external tools like SealedSecrets, HashiCorp Vault, or AWS Secrets Manager.*

**Q4: What is the "12-Factor App" and name one rule you followed?**
*A: It's a methodology for building scalable SaaS. Rule followed: **Config in Env Vars**. We never hardcoded secrets; they are injected via GitHub Secrets and K8s ConfigMaps.*

**Q5: What happens if a K8s Pod fails?**
*A: The **Deployment Controller** detects that the current state doesn't match the desired state (2 replicas) and automatically spins up a new pod to replace the failed one.*

---

## 🎓 Final Advice
- **Don't panic.** You have the code and the manifests.
- **Show the green pipeline.** It's your best proof of work.
- **Explain the "Why".** Don't just say what tools you used; explain why they help (Security, Speed, Scalability).
