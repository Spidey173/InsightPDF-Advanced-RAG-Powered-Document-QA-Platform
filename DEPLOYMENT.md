# 🚀 Deployment Guide: InsightPDF

InsightPDF is containerized using a multi-stage Docker build. The Next.js frontend is built statically and served by the FastAPI backend, allowing you to run the entire app as a single service.

---

## 🔑 Environment Variables
Regardless of the platform, you need to configure the following environment variables on your dashboard:

| Variable | Description | Example |
|---|---|---|
| `LLM_PROVIDER` | LLM provider to use (`google`, `groq`, `openrouter`, `github`) | `google` |
| `GOOGLE_API_KEY` | Gemini API Key (if `LLM_PROVIDER=google`) | `AIzaSy...` |
| `GROQ_API_KEY` | Groq API Key (if `LLM_PROVIDER=groq`) | `gsk_...` |
| `OPENROUTER_API_KEY` | OpenRouter API Key (if `LLM_PROVIDER=openrouter`) | `sk-or-...` |
| `GITHUB_TOKEN` | GitHub Token (if `LLM_PROVIDER=github`) | `ghp_...` |

---

## 1. Deploying on Render (Recommended)
Render makes it easy to deploy Dockerized apps directly from a GitHub repository.

1. **Push your code to GitHub**.
2. Go to [Render Dashboard](https://dashboard.render.com/) and click **New > Web Service**.
3. Connect your GitHub repository.
4. Set the following settings:
   - **Name**: `insightpdf` (or any name)
   - **Environment**: `Docker`
   - **Branch**: `main` (or your default branch)
5. Choose your **Instance Type**.
   - *Note: Since FAISS and sentence-transformers run locally, we recommend at least 1 GB RAM (the Starter plan or higher).*
6. Click **Advanced** and add your **Environment Variables** (listed above).
7. Click **Create Web Service**. Render will automatically detect the `Dockerfile`, build it, and deploy it.

---

## 2. Deploying on Railway
Railway is another excellent choice for container-based deployments with high performance.

1. **Install the Railway CLI** (or connect via GitHub).
2. Create a new project on Railway:
   ```bash
   railway init
   ```
3. Add a service from your GitHub repo. Railway will auto-detect the `Dockerfile`.
4. Under the **Variables** tab for the service, add your environment variables.
5. Railway will automatically build and deploy. Once built, go to **Settings > Generate Domain** to get your public URL.

---

## 3. Deploying on Fly.io
Fly.io runs applications in micro-VMs close to users.

1. **Install Fly CLI** and sign in:
   ```bash
   fly auth login
   ```
2. Initialize the app:
   ```bash
   fly launch
   ```
   - Select your app name and organization.
   - Choose a region close to you.
   - Fly.io will automatically scan the project, detect the Dockerfile, and generate a `fly.toml` configuration.
3. Set your secrets:
   ```bash
   fly secrets set GOOGLE_API_KEY="your_api_key_here" LLM_PROVIDER="google"
   ```
4. Deploy the application:
   ```bash
   fly deploy
   ```

---

## 🐳 Local Verification
To test the Docker build locally before deploying:

1. Build the Docker image:
   ```bash
   docker build -t insightpdf .
   ```
2. Run the container:
   ```bash
   docker run -p 8000:8000 -e GOOGLE_API_KEY="YOUR_API_KEY" -e LLM_PROVIDER="google" insightpdf
   ```
3. Open `http://localhost:8000` in your web browser.
