# 🛡️ MedGuardian AI

**An AI-assisted medical-imaging research platform for hospital staff.**

> 🎓 **Final Year Machine Learning Project** — developed **purely for educational purposes only**.

MedGuardian AI lets authenticated hospital staff upload medical images and receive model predictions with visual explanations (Grad-CAM) across multiple diagnostic modules. Every analysis is saved to a per-user history, and access is protected with token-based authentication and role-based admin controls.

> ⚠️ **Educational use & medical disclaimer:** MedGuardian is a **final year machine learning project created purely for educational purposes only**. It is a research application, not a certified medical device, and has not been clinically validated. Its outputs must **never** be used for real medical diagnosis, treatment decisions, or as a substitute for professional clinical judgment.

---

## 📑 Table of Contents

- [Features](#-features)
- [Supported Modules](#-supported-modules)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Configuration](#-configuration)
- [API Reference](#-api-reference)
- [Usage Example](#-usage-example)
- [About This Project](#-about-this-project)
- [Security & Privacy](#-security--privacy)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

- **Multi-module diagnostic support** – skin disease, brain tumor, diabetic retinopathy, and lung analysis in one platform.
- **Explainable AI** – Grad-CAM visualizations show which image regions influenced a prediction.
- **Secure staff access** – OAuth2 password flow with bearer tokens; all analysis endpoints require authentication.
- **Admin staff management** – administrators can create new staff accounts (minimum 12-character passwords enforced).
- **Per-user analysis history** – users only see their own past analyses, filterable by module, with a summary of total analyses and counts per module.
- **Documented REST API** – OpenAPI 3.1 specification included (`medguardian-openapi.json`).
- **Health check endpoint** for monitoring and deployment readiness.

---

## 🧠 Supported Modules

| Module | Input | Endpoint | Output |
|---|---|---|---|
| Skin Disease | Skin image | `/api/skin/predict`, `/api/skin/explain` | Class prediction, Grad-CAM visualization |
| Brain Tumor | Brain MRI image | `/api/brain/explain` | MRI prediction, saved history metadata |
| Diabetic Retinopathy | Retinal fundus image | `/api/retinopathy/explain` | Retinopathy prediction, saved history |
| Lung Analysis | Lung medical image | `/api/lung/explain` | Lung prediction, saved metadata |

---

## 🧰 Tech Stack

- **Backend:** Python, FastAPI (OpenAPI 3.1 auto-generated docs), OAuth2 password bearer authentication
- **ML / Explainability:** Deep-learning image classifiers with Grad-CAM
- **Frontend:** Web client in `frontend/`
- **API Spec:** `medguardian-openapi.json`

> 📝 *Update this section with the exact libraries and versions you use (e.g. PyTorch/TensorFlow, React/Vite, database).*

---

## 📁 Project Structure

```
MedGuardian/
├── backend/                  # FastAPI server, auth, ML inference, history storage
├── frontend/                 # Web user interface
├── medguardian-openapi.json  # OpenAPI 3.1 specification
└── .gitignore
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+ and npm (for the frontend)
- Git

### 1. Clone the repository

```bash
git clone https://github.com/Srushti-bit/MedGuardian.git
cd MedGuardian
```

### 2. Run the backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`, with interactive docs at `http://localhost:8000/docs`.

### 3. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

> 📝 *Adjust the commands above (entry point, package manager, ports) to match your actual setup.*

---

## ⚙️ Configuration

Create a `.env` file in `backend/` (never commit it). Typical settings:

```env
SECRET_KEY=change-me-to-a-long-random-string
ACCESS_TOKEN_EXPIRE_MINUTES=60
DATABASE_URL=sqlite:///./medguardian.db
```

> 📝 *Replace with the environment variables your backend actually reads.*

---

## 📡 API Reference

Base path: `/api` · Auth: `Authorization: Bearer <token>` (except login and health).

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Log in with username and password (form-encoded); returns an access token |
| `GET` | `/api/auth/me` | Get the current authenticated user |

### Analysis

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/skin/predict` | Skin-image class prediction |
| `POST` | `/api/skin/explain` | Skin prediction + Grad-CAM, saved to history |
| `POST` | `/api/brain/explain` | Brain MRI prediction, saved to history |
| `POST` | `/api/retinopathy/explain` | Retinopathy prediction, saved to history |
| `POST` | `/api/lung/explain` | Lung image analysis, saved to history |

All analysis endpoints accept `multipart/form-data` with a single `image` file field.

### History & Metadata

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/history` | Recent analyses for the current user (query: `module`, `limit` – default 100) |
| `GET` | `/api/history/summary` | Total analyses and per-module counts for the current user |
| `GET` | `/api/modules` | List available modules |

### Admin & System

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/admin/staff` | Create a staff account (`username` 1–100 chars, `password` 12–128 chars) |
| `GET` | `/api/health` | Health check |

The full specification is in [`medguardian-openapi.json`](./medguardian-openapi.json).

---

## 💡 Usage Example

```bash
# 1. Log in and get a token
curl -X POST http://localhost:8000/api/auth/login \
  -d "username=staff_user&password=your_password"

# 2. Run a skin-image analysis with Grad-CAM explanation
curl -X POST http://localhost:8000/api/skin/explain \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -F "image=@/path/to/skin_image.jpg"

# 3. View your analysis history for a module
curl "http://localhost:8000/api/history?module=skin&limit=10" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

## 🎓 About This Project

MedGuardian AI was built as a **final year machine learning project** to demonstrate the application of deep learning and explainable AI (Grad-CAM) to medical image analysis. It is intended **solely for educational and academic purposes**, not for clinical or commercial use.

---

## 🔒 Security & Privacy

- All analysis, history, and admin endpoints require a valid bearer token.
- History is scoped per user; staff cannot view each other's analyses.
- Admin-only staff creation with enforced minimum password length.
- Only analysis **metadata** is stored in history for most modules.
- If you handle real patient data, ensure compliance with applicable regulations (e.g. HIPAA, GDPR, or India's DPDP Act), and deploy behind HTTPS.

---

## 🗺️ Roadmap

- [ ] Add model performance metrics and dataset documentation
- [ ] Add Grad-CAM explanations to all modules
- [ ] Docker / docker-compose setup
- [ ] Automated tests and CI pipeline
- [ ] Role-based permissions beyond admin/staff
- [ ] Exportable PDF reports per analysis

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---


## 👤 Author

**Srushti** – [@Srushti-bit](https://github.com/Srushti-bit)
