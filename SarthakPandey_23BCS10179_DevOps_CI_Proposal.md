# DevOps CI/CD Project Proposal

---

**Project:** Automated CI/CD Pipeline for SST Equipment Borrowing System  
**Student Name:** Sarthak Pandey  
**Scaler ID:** 23BCS10179  
**Repository:** [https://github.com/SarthakPaandey/SSTBORROWING](https://github.com/SarthakPaandey/SSTBORROWING)  
**Date:** January 12, 2026  
**Course:** Basic DevOps & Cloud Computing  

---

## 1. Project Overview

This project implements a **Continuous Integration and Continuous Delivery (CI/CD)** pipeline for the SST Borrowing System. The goal is to automate the software delivery lifecycle using the principles and tools covered in our DevOps coursework, specifically focusing on **Docker containerization**, **GitHub Actions**, and **Security integration (SAST/SCA)**.

The project demonstrates the practical application of the **DevOps Lifecycle** (Plan, Code, Build, Test, Release, Deploy, Operate, Monitor) to solve real-world software delivery challenges.

## 2. Application Details

The application is a full-stack system following the **Microservices architecture** principles, containerized to ensure portability across environments.

| Component | Technology | Course Concept Applied |
|-----------|------------|------------------------|
| **Application** | Next.js 14 (React) | Web Application Development |
| **Container** | Docker | Containerization & Isolation |
| **Database** | MongoDB | NoSQL Database |
| **Pipeline** | GitHub Actions | CI/CD Automation |
| **Registry** | DockerHub | Artifact, Image Management |

---

## 3. Problem Statement & Motivation

### 3.1 The "Manual Deployment" Problem
Before applying DevOps practices, the development workflow suffered from issues highlighted in our **DevOps Principles** module:
*   **Manual Processes**: Builds and deployments were done manually, leading to human error.
*   **"Works on My Machine"**: Without **Docker**, code running locally often failed in production due to environmental differences.
*   **Lack of Feedback**: Bugs were found late in the cycle, violating the "Fast Feedback" principle.
*   **Security Risks**: Dependencies were not scanned, risking the inclusion of vulnerable libraries.

### 3.2 adherence to "12-Factor App" Methodology
This project moves the application towards **12-Factor compliance**:
*   **V. Build, release, run**: Strictly separating the build stage from the runtime stage using automation.
*   **X. Dev/prod parity**: Keeping development and production as similar as possible using **Docker**.

---

## 4. CI/CD Pipeline Design

The pipeline incorporates checking, building, and securing the application as taught in the **CI/CD** and **Docker** modules.

```mermaid
graph LR
    Push[Git Push] --> CI[CI & Quality]
    CI --> Lint[Linting]
    CI --> Ops[Unit Tests]
    
    CI --> Sec[Security (SAST/SCA)]
    Sec --> Audit[Dep Check]
    Sec --> CodeQL[Code Usage]
    
    Sec --> Build[Build Stage]
    Build --> Docker[Docker Build]
    
    Docker --> Valid[Validation]
    Valid --> Scan[Trivy Scan]
    Valid --> Smoke[Smoke Test]
    
    Valid --> PushReg[Registry Push]
    PushReg --> Hub[DockerHub]
```

---

## 5. Implementation Stages & Course Concepts

The pipeline is implemented using **GitHub Actions**, mapping directly to the syllabus topics:

### Stage 1: Continuous Integration (CI)
*   **Actions**: Checkout code, Install dependencies, Run Linting (ESLint), Run Unit Tests (Vitest).
*   **Course Concept**: **"Implement a simple CI using GitHub Actions"**.
*   **Why**: To ensure code integrity and prevent broken code from being committed (Continuous Integration principle).

### Stage 2: Security Integration (SAST & SCA)
*   **Actions**: 
    1.  **SCA (Software Composition Analysis)**: Run `pnpm audit` to check for vulnerable dependencies.
    2.  **SAST (Static Application Security Testing)**: Use **CodeQL** to scan source code for patterns like SQL Injection.
*   **Course Concept**: **"Improve the CI implemented earlier to include SCA and SAST"**.
*   **Why**: To identify security vulnerabilities early in the lifecycle (Shift-Left Security).

### Stage 3: Containerization
*   **Actions**: Build a **Docker Image** using a multi-stage `Dockerfile`.
*   **Course Concept**: **"Creating your own Docker image"** & **"Dockerfile commands"**.
*   **Why**: To package the application and its dependencies into a single immutable artifact, ensuring it runs the same everywhere (solving the "Matrix from Hell" problem).

### Stage 4: Container Validation
*   **Actions**: 
    1.  **Image Scan**: Use **Trivy** to scan the built Docker image for OS-level vulnerabilities.
    2.  **Smoke Test**: Run the container temporarily to verify it starts and listens on the correct port.
*   **Course Concept**: **"Docker container deep dive"**.
*   **Why**: To ensure the container image is secure and functional before publishing.

### Stage 5: CD (Continuous Delivery) - Registry Push
*   **Actions**: Tag the image and push it to **DockerHub**.
*   **Course Concept**: **"Docker images"** & **"Local vs Remote repository management"**.
*   **Why**: To store the trusted artifact in a central registry, ready for deployment to Kubernetes or any other orchestration platform.

---

## 6. Implementation Roadmap

### Phase 1: Docker Foundation (Completed ✅)
*   [x] Create optimized `Dockerfile` (Multi-stage build).
*   [x] Implement `.dockerignore` for efficient build context.

### Phase 2: Pipeline Configuration (Completed ✅)
*   [x] Configure **GitHub Actions** CI workflow (`.github/workflows/ci.yml`).
*   [x] Configure **GitHub Actions** CD workflow (`.github/workflows/cd.yml`).
*   [x] Integrate **CodeQL** for SAST.
*   [x] Integrate **Trivy** for Container Scanning.
*   [x] Integrate **DAST** for runtime security checks.

### Phase 3: Verification (Completed ✅)
*   [x] Verify pipeline success on GitHub.
*   [x] Check DockerHub for pushed images.
*   [x] Review Security tab for vulnerability reports.


---

## 7. Secrets Management Strategy

To adhere to the **III. Config** principle of **12-Factor Apps** and ensure no sensitive credentials are leaked, the following secrets will be configured in the GitHub repository:

| Secret Name | Purpose |
|-------------|---------|
| `DOCKERHUB_USERNAME` | For Docker Registry authentication |
| `DOCKERHUB_TOKEN` | Secure Access Token (PAT) for pushing images |

**Note:** No credentials will be hardcoded in the codebase or workflow files.

---

## 8. Conclusion

This project successfully bridges the gap between development and operations. By automating the build, test, and security processes, we demonstrate a functional understanding of **DevOps methodologies**, **Containerization**, and **CI/CD best practices** as covered in the course curriculum.

---

**Values Delivered:**
1.  **Automation**: Reduced manual effort.
2.  **Quality**: Automated testing and linting.
3.  **Security**: Automated vulnerability scanning.
4.  **Reliability**: Consistent Docker-based deployments.
